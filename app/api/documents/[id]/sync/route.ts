import { NextRequest } from "next/server";
import { handleApiRoute } from "@/lib/api-helper";
import { requireAuth } from "@/lib/auth";
import { DocumentService } from "@/features/documents/services/document-service";
import { OperationService } from "@/features/documents/services/operation-service";
import { DocumentRole } from "@prisma/client";
import { AuthorizationError } from "@/lib/errors";
import { z } from "zod";

const SyncRequestSchema = z.object({
  deviceId: z.string().min(1, "deviceId is required"),
  lastServerOperation: z.number().int().nonnegative(),
  operations: z.array(
    z.object({
      clientId: z.string().min(1),
      sequenceNumber: z.number().int().nonnegative(),
      baseVersion: z.number().int().nonnegative(),
      update: z.string().min(1), // Base64 encoded update payload
      checksum: z.string().optional(),
    })
  ),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleApiRoute(async () => {
    const user = await requireAuth();
    const { id: documentId } = await params;

    const body = await request.json();
    const validatedData = SyncRequestSchema.parse(body);

    const documentService = new DocumentService();
    // Validate that the user is OWNER, EDITOR, or VIEWER
    const membership = await documentService.verifyAccess(documentId, user.id!, [
      DocumentRole.OWNER,
      DocumentRole.EDITOR,
      DocumentRole.VIEWER,
    ]);

    // Block viewers from pushing updates
    if (membership.role === DocumentRole.VIEWER && validatedData.operations.length > 0) {
      throw new AuthorizationError("Access denied: VIEWERS are not allowed to submit document updates");
    }

    const operationService = new OperationService();

    // 1. Submit client operations (push) if they exist
    if (validatedData.operations.length > 0) {
      const opsToSubmit = validatedData.operations.map((op) => ({
        clientId: op.clientId,
        sequenceNumber: op.sequenceNumber,
        baseVersion: op.baseVersion,
        update: Buffer.from(op.update, "base64"), // Decode base64 to binary buffer
        checksum: op.checksum,
      }));

      await operationService.submitOperations(documentId, user.id!, opsToSubmit);
    }

    // 2. Fetch server operations that the client is missing (pull)
    const serverOps = await operationService.getOperationsSince(
      documentId,
      user.id!,
      validatedData.lastServerOperation
    );

    // 3. Format server operations back to base64 for JSON transport
    const formattedNewOps = serverOps.map((op) => ({
      clientId: op.clientId,
      sequenceNumber: op.sequenceNumber,
      baseVersion: op.baseVersion,
      update: Buffer.from(op.update).toString("base64"), // Encode binary to base64
      checksum: op.checksum,
    }));

    // Find the latest sequence number on the server
    const latestServerSeq = serverOps.length > 0
      ? serverOps[serverOps.length - 1].sequenceNumber
      : validatedData.lastServerOperation;

    return {
      newOperations: formattedNewOps,
      lastServerOperation: latestServerSeq,
    };
  });
}
