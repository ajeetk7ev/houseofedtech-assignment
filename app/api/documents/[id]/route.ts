import { NextRequest } from "next/server";
import { handleApiRoute } from "@/lib/api-helper";
import { requireAuth } from "@/lib/auth";
import { UpdateDocumentSchema } from "@/lib/validation/schemas";
import { DocumentService } from "@/features/documents/services/document-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleApiRoute(async () => {
    const user = await requireAuth();
    const { id } = await params;

    const documentService = new DocumentService();
    const doc = await documentService.getDocument(id, user.id!);

    return doc;
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleApiRoute(async () => {
    const user = await requireAuth();
    const { id } = await params;

    const body = await request.json();
    const validatedData = UpdateDocumentSchema.parse(body);

    const documentService = new DocumentService();

    // Process update data
    const updateData: { title?: string; latestSnapshot?: Buffer; isArchived?: boolean } = {};
    
    if (validatedData.title !== undefined) {
      updateData.title = validatedData.title;
    }
    
    if (validatedData.latestSnapshot !== undefined) {
      updateData.latestSnapshot = Buffer.from(validatedData.latestSnapshot, "base64");
    }

    if (validatedData.isArchived !== undefined) {
      updateData.isArchived = validatedData.isArchived;
    }

    const doc = await documentService.updateDocument(id, user.id!, updateData);
    return doc;
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleApiRoute(async () => {
    const user = await requireAuth();
    const { id } = await params;

    const documentService = new DocumentService();
    const deletedDoc = await documentService.deleteDocument(id, user.id!);

    return deletedDoc;
  });
}
