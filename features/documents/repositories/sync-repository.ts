import { prisma } from "@/lib/prisma";
import { SyncState } from "@prisma/client";

export class SyncRepository {
  async getSyncState(documentId: string, deviceId: string): Promise<SyncState | null> {
    return prisma.syncState.findUnique({
      where: {
        documentId_deviceId: {
          documentId,
          deviceId,
        },
      },
    });
  }

  async upsertSyncState(
    documentId: string,
    deviceId: string,
    data: {
      lastServerOperation: number;
      lastClientOperation: number;
    }
  ): Promise<SyncState> {
    return prisma.syncState.upsert({
      where: {
        documentId_deviceId: {
          documentId,
          deviceId,
        },
      },
      update: {
        lastServerOperation: data.lastServerOperation,
        lastClientOperation: data.lastClientOperation,
        lastSyncAt: new Date(),
      },
      create: {
        documentId,
        deviceId,
        lastServerOperation: data.lastServerOperation,
        lastClientOperation: data.lastClientOperation,
      },
    });
  }

  async findSyncStatesByDocument(documentId: string): Promise<SyncState[]> {
    return prisma.syncState.findMany({
      where: { documentId },
      orderBy: { lastSyncAt: "desc" },
    });
  }
}
