import { prisma } from "@/lib/prisma";
import { Version } from "@prisma/client";

export class VersionRepository {
  async findById(id: string): Promise<Version | null> {
    return prisma.version.findUnique({
      where: { id },
    });
  }

  async createVersion(data: {
    documentId: string;
    title: string;
    description?: string | null;
    snapshot: Uint8Array;
    createdBy: string;
    isAutomatic?: boolean;
    parentVersionId?: string | null;
  }): Promise<Version> {
    return prisma.version.create({
      data: {
        documentId: data.documentId,
        title: data.title,
        description: data.description,
        snapshot: data.snapshot as unknown as Uint8Array<ArrayBuffer>,
        createdBy: data.createdBy,
        isAutomatic: data.isAutomatic ?? false,
        parentVersionId: data.parentVersionId,
      },
    });
  }

  async findVersionsByDocumentId(documentId: string): Promise<any[]> {
    return prisma.version.findMany({
      where: { documentId },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async deleteVersion(id: string): Promise<Version> {
    return prisma.version.delete({
      where: { id },
    });
  }
}
