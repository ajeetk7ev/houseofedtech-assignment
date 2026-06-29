import { NextRequest } from "next/server";
import { handleApiRoute } from "@/lib/api-helper";
import { requireAuth } from "@/lib/auth";
import { MembershipService } from "@/features/documents/services/membership-service";
import { DocumentRole } from "@prisma/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleApiRoute(async () => {
    const user = await requireAuth();
    const { id: documentId } = await params;

    const membershipService = new MembershipService();
    const collaborators = await membershipService.listCollaborators(documentId, user.id!);

    return collaborators.map((c) => ({
      userId: c.userId,
      role: c.role,
      user: {
        id: c.user.id,
        name: c.user.name,
        email: c.user.email,
      },
    }));
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleApiRoute(async () => {
    const user = await requireAuth();
    const { id: documentId } = await params;

    const body = await request.json();
    const { userId: targetUserId, role: newRole } = body;

    if (!targetUserId || !newRole) {
      throw new Error("userId and role are required");
    }

    if (!Object.values(DocumentRole).includes(newRole)) {
      throw new Error(`Invalid role. Must be one of: ${Object.values(DocumentRole).join(", ")}`);
    }

    const membershipService = new MembershipService();
    const updated = await membershipService.updateCollaboratorRole(
      documentId,
      user.id!,
      targetUserId,
      newRole as DocumentRole
    );

    return updated;
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleApiRoute(async () => {
    const user = await requireAuth();
    const { id: documentId } = await params;

    const { searchParams } = request.nextUrl;
    const targetUserId = searchParams.get("userId");

    if (!targetUserId) {
      throw new Error("userId query parameter is required");
    }

    const membershipService = new MembershipService();
    const deleted = await membershipService.removeCollaborator(
      documentId,
      user.id!,
      targetUserId
    );

    return deleted;
  });
}
