import { NextRequest } from "next/server";
import { handleApiRoute } from "@/lib/api-helper";
import { requireAuth } from "@/lib/auth";
import { MembershipRepository } from "@/features/documents/repositories/membership-repository";
import { DocumentRepository } from "@/features/documents/repositories/document-repository";
import { AuthorizationError, NotFoundError } from "@/lib/errors";
import crypto from "crypto";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleApiRoute(async () => {
    const user = await requireAuth();
    const { id: documentId } = await params;

    const body = await request.json();
    const { token } = body;

    if (!token) {
      throw new AuthorizationError("Invite token is required");
    }

    const secret = process.env.AUTH_SECRET || "fallback-secret-for-signing-token";

    // Verify token structure
    const parts = token.split(".");
    if (parts.length !== 2) {
      throw new AuthorizationError("Invalid invite token format");
    }

    const [payloadBase64, signature] = parts;
    let payload;
    try {
      const payloadStr = Buffer.from(payloadBase64, "base64").toString("utf-8");
      
      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(payloadStr)
        .digest("hex");

      if (signature !== expectedSignature) {
        throw new AuthorizationError("Invalid invite token signature");
      }

      payload = JSON.parse(payloadStr);
    } catch (err) {
      throw new AuthorizationError("Failed to parse invite token");
    }

    // Validate payload values
    if (payload.documentId !== documentId) {
      throw new AuthorizationError("Token is not valid for this document");
    }

    if (payload.expiresAt < Date.now()) {
      throw new AuthorizationError("Invite token has expired");
    }

    // Verify document exists
    const docRepo = new DocumentRepository();
    const doc = await docRepo.findById(documentId);
    if (!doc) {
      throw new NotFoundError("Document not found");
    }

    const membershipRepo = new MembershipRepository();
    let membership = await membershipRepo.findMembership(documentId, user.id!);

    if (!membership) {
      membership = await membershipRepo.createMembership(documentId, user.id!, payload.role);
    }

    return { membership };
  });
}
