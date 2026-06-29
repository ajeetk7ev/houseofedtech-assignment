import { NextRequest } from "next/server";
import { handleApiRoute } from "@/lib/api-helper";
import { requireAuth } from "@/lib/auth";
import { VersionService } from "@/features/documents/services/version-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  return handleApiRoute(async () => {
    const user = await requireAuth();
    const { versionId } = await params;

    const versionService = new VersionService();
    const restoredVersion = await versionService.restoreVersion(versionId, user.id!);

    return {
      id: restoredVersion.id,
      title: restoredVersion.title,
      snapshot: Buffer.from(restoredVersion.snapshot).toString("base64"),
      success: true,
    };
  });
}
