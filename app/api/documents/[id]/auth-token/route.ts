import { NextRequest } from "next/server";
import { handleApiRoute } from "@/lib/api-helper";
import { requireAuth } from "@/lib/auth";
import { DocumentService } from "@/features/documents/services/document-service";
import { DocumentRole } from "@prisma/client";
import crypto from "crypto";

/**
 * Endpoint to request a short-lived token to authenticate the WebSocket collaboration connection.
 * Validates document membership and passes user profile information along with their authorization role.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleApiRoute(async () => {
    const user = await requireAuth();
    const { id: documentId } = await params;

    const documentService = new DocumentService();
    
    // Verify user is a collaborator on the document (OWNER, EDITOR, or VIEWER)
    const membership = await documentService.verifyAccess(documentId, user.id!, [
      DocumentRole.OWNER,
      DocumentRole.EDITOR,
      DocumentRole.VIEWER,
    ]);

    const secret = process.env.AUTH_SECRET || "fallback-secret-for-signing-token";

    // Build the user payload for the WebSocket session
    const payload = {
      userId: user.id,
      userName: user.name || user.email?.split("@")[0] || "Anonymous",
      userEmail: user.email,
      userImage: user.image || null,
      documentId,
      role: membership.role,
      expiresAt: Date.now() + 60 * 60 * 1000, // Token valid for 1 hour
    };

    const payloadStr = JSON.stringify(payload);
    const signature = crypto
      .createHmac("sha256", secret)
      .update(payloadStr)
      .digest("hex");

    const token = `${Buffer.from(payloadStr).toString("base64")}.${signature}`;

    return { token };
  });
}
