import { prisma } from "@/lib/prisma";
import { Document } from "@prisma/client";

export interface FindDocumentsOptions {
  page?: number;
  limit?: number;
  includeArchived?: boolean;
}

export class DocumentRepository {
  async findById(id: string): Promise<Document | null> {
    return prisma.document.findUnique({
      where: { id },
    });
  }

  async createDocument(title: string, createdBy: string): Promise<Document> {
    return prisma.document.create({
      data: {
        title,
        createdBy,
        // Document begins with an empty snapshot
        latestSnapshot: null,
      },
    });
  }

  async createDocumentWithMembership(title: string, createdBy: string, id?: string): Promise<Document> {
    return prisma.$transaction(
      async (tx) => {
        const doc = await tx.document.create({
          data: {
            id,
            title,
            createdBy,
          },
        });

        await tx.documentMembership.create({
          data: {
            documentId: doc.id,
            userId: createdBy,
            role: "OWNER",
          },
        });

        return doc;
      },
      {
        maxWait: 15000,
        timeout: 20000,
      }
    );
  }

  async updateDocument(
    id: string,
    data: {
      title?: string;
      latestSnapshot?: Uint8Array | null;
      lastOperationNumber?: number;
      isArchived?: boolean;
    }
  ): Promise<Document> {
    return prisma.document.update({
      where: { id },
      data: {
        title: data.title,
        lastOperationNumber: data.lastOperationNumber,
        isArchived: data.isArchived,
        latestSnapshot: data.latestSnapshot !== undefined
          ? (data.latestSnapshot as unknown as Uint8Array<ArrayBuffer> | null)
          : undefined,
      },
    });
  }

  async deleteDocument(id: string): Promise<Document> {
    return prisma.document.delete({
      where: { id },
    });
  }

  async findUserDocuments(userId: string, options: FindDocumentsOptions = {}): Promise<{ items: Document[]; total: number }> {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const skip = (page - 1) * limit;

    const whereClause = {
      memberships: {
        some: {
          userId,
        },
      },
      isArchived: options.includeArchived ? undefined : false,
    };

    const [items, total] = await Promise.all([
      prisma.document.findMany({
        where: whereClause,
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.document.count({
        where: whereClause,
      }),
    ]);

    return { items, total };
  }
}
