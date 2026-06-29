import { NextRequest } from "next/server";
import { handleApiRoute } from "@/lib/api-helper";
import { requireAuth } from "@/lib/auth";
import { VersionService } from "@/features/documents/services/version-service";
import { z } from "zod";

const CreateVersionSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().nullable(),
  snapshot: z.string().min(1, "Snapshot is required"), // Base64 Yjs state update
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleApiRoute(async () => {
    const user = await requireAuth();
    const { id: documentId } = await params;

    const versionService = new VersionService();
    const versions = await versionService.listVersions(documentId, user.id!);

    return versions.map((v) => ({
      id: v.id,
      documentId: v.documentId,
      title: v.title,
      description: v.description,
      createdAt: v.createdAt,
      createdBy: v.createdBy,
      isAutomatic: v.isAutomatic,
      parentVersionId: v.parentVersionId,
      user: v.user ? {
        id: v.user.id,
        name: v.user.name,
        email: v.user.email,
      } : undefined,
    }));
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleApiRoute(async () => {
    const user = await requireAuth();
    const { id: documentId } = await params;

    const body = await request.json();
    const validatedData = CreateVersionSchema.parse(body);

    const versionService = new VersionService();
    const newVersion = await versionService.createVersion(documentId, user.id!, {
      title: validatedData.title,
      description: validatedData.description,
      snapshot: Buffer.from(validatedData.snapshot, "base64"),
    });

    return {
      id: newVersion.id,
      title: newVersion.title,
      description: newVersion.description,
      createdAt: newVersion.createdAt,
    };
  });
}
