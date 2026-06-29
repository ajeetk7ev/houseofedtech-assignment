import { prisma } from "@/lib/prisma";
import { Operation } from "@prisma/client";

export class OperationRepository {
  async findById(id: string): Promise<Operation | null> {
    return prisma.operation.findUnique({
      where: { id },
    });
  }

  async createOperation(data: {
    documentId: string;
    userId: string;
    clientId: string;
    sequenceNumber: number;
    baseVersion: number;
    update: Uint8Array;
    checksum?: string | null;
  }): Promise<Operation> {
    return prisma.operation.create({
      data: {
        documentId: data.documentId,
        userId: data.userId,
        clientId: data.clientId,
        sequenceNumber: data.sequenceNumber,
        baseVersion: data.baseVersion,
        update: data.update as unknown as Uint8Array<ArrayBuffer>,
        checksum: data.checksum ?? null,
      },
    });
  }

  async findOperationsSince(documentId: string, sequenceNumber: number): Promise<Operation[]> {
    return prisma.operation.findMany({
      where: {
        documentId,
        sequenceNumber: {
          gt: sequenceNumber,
        },
      },
      orderBy: {
        sequenceNumber: "asc",
      },
    });
  }

  async getLastOperationNumber(documentId: string): Promise<number> {
    const lastOp = await prisma.operation.findFirst({
      where: { documentId },
      orderBy: { sequenceNumber: "desc" },
      select: { sequenceNumber: true },
    });
    return lastOp?.sequenceNumber ?? 0;
  }

  async bulkCreateOperations(
    ops: {
      documentId: string;
      userId: string;
      clientId: string;
      sequenceNumber: number;
      baseVersion: number;
      update: Uint8Array;
      checksum?: string | null;
    }[]
  ) {
    return prisma.operation.createMany({
      data: ops.map((op) => ({
        documentId: op.documentId,
        userId: op.userId,
        clientId: op.clientId,
        sequenceNumber: op.sequenceNumber,
        baseVersion: op.baseVersion,
        update: op.update as unknown as Uint8Array<ArrayBuffer>,
        checksum: op.checksum ?? null,
      })),
    });
  }
}
