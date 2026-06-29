import { NextRequest } from "next/server";
import { handleApiRoute } from "@/lib/api-helper";
import { requireAuth } from "@/lib/auth";
import { VersionService } from "@/features/documents/services/version-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  return handleApiRoute(async () => {
    const user = await requireAuth();
    const { versionId } = await params;

    const versionService = new VersionService();
    const version = await versionService.getVersion(versionId, user.id!);

    return {
      id: version.id,
      documentId: version.documentId,
      title: version.title,
      description: version.description,
      createdAt: version.createdAt,
      createdBy: version.createdBy,
      isAutomatic: version.isAutomatic,
      parentVersionId: version.parentVersionId,
      snapshot: Buffer.from(version.snapshot).toString("base64"), // Return Base64 snapshot
    };
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  return handleApiRoute(async () => {
    throw new Error("Versions are immutable and cannot be deleted");
  });
}
