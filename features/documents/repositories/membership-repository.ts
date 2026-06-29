import { prisma } from "@/lib/prisma";
import { DocumentMembership, DocumentRole } from "@prisma/client";

export class MembershipRepository {
  async findMembership(documentId: string, userId: string): Promise<DocumentMembership | null> {
    return prisma.documentMembership.findUnique({
      where: {
        documentId_userId: {
          documentId,
          userId,
        },
      },
    });
  }

  async createMembership(documentId: string, userId: string, role: DocumentRole): Promise<DocumentMembership> {
    return prisma.documentMembership.create({
      data: {
        documentId,
        userId,
        role,
      },
    });
  }

  async updateMembership(documentId: string, userId: string, role: DocumentRole): Promise<DocumentMembership> {
    return prisma.documentMembership.update({
      where: {
        documentId_userId: {
          documentId,
          userId,
        },
      },
      data: {
        role,
      },
    });
  }

  async deleteMembership(documentId: string, userId: string): Promise<DocumentMembership> {
    return prisma.documentMembership.delete({
      where: {
        documentId_userId: {
          documentId,
          userId,
        },
      },
    });
  }

  async findDocumentMembers(documentId: string) {
    return prisma.documentMembership.findMany({
      where: { documentId },
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
}
