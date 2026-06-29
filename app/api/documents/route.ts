import { NextRequest } from "next/server";
import { handleApiRoute } from "@/lib/api-helper";
import { requireAuth } from "@/lib/auth";
import { CreateDocumentSchema } from "@/lib/validation/schemas";
import { DocumentService } from "@/features/documents/services/document-service";

export async function GET(request: NextRequest) {
  return handleApiRoute(async () => {
    const user = await requireAuth();
    
    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const includeArchived = searchParams.get("includeArchived") === "true";

    const documentService = new DocumentService();
    const result = await documentService.listDocuments(user.id!, {
      page,
      limit,
      includeArchived,
    });

    return result;
  });
}

export async function POST(request: NextRequest) {
  return handleApiRoute(async () => {
    const user = await requireAuth();
    
    const body = await request.json();
    const validatedData = CreateDocumentSchema.parse(body);

    const documentService = new DocumentService();
    const newDoc = await documentService.createDocument(validatedData.title, user.id!, validatedData.id);

    return newDoc;
  });
}
