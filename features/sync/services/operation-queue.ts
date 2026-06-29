import { localDb, LocalOperation } from "./local-db";

export class OperationQueue {
  /**
   * Appends an operational change to the local persistence queue.
   */
  async addOperation(
    documentId: string,
    clientId: string,
    baseVersion: number,
    operation: Uint8Array,
    checksum: string
  ): Promise<number> {
    // Determine the next sequential local sequence number
    const maxOp = await localDb.operations
      .where("documentId")
      .equals(documentId)
      .reverse()
      .sortBy("sequenceNumber")
      .then((arr) => arr[0]);

    const nextSeq = maxOp ? maxOp.sequenceNumber + 1 : 1;

    const opRecord: LocalOperation = {
      documentId,
      clientId,
      sequenceNumber: nextSeq,
      baseVersion,
      operation,
      checksum,
      createdAt: new Date().toISOString(),
      status: "pending",
      retryCount: 0,
      lastAttempt: null,
    };

    await localDb.operations.add(opRecord);
    return nextSeq;
  }

  /**
   * Retrieves all operations that are queued and ready for synchronization.
   */
  async getPendingOperations(documentId: string): Promise<LocalOperation[]> {
    return localDb.operations
      .where("documentId")
      .equals(documentId)
      .filter((op) => op.status === "pending" || op.status === "failed")
      .sortBy("sequenceNumber");
  }

  /**
   * Updates status metadata for a batch of operations.
   */
  async updateStatus(
    ids: number[],
    status: LocalOperation["status"],
    incrementRetry: boolean = false
  ): Promise<void> {
    if (ids.length === 0) return;

    await localDb.transaction("rw", localDb.operations, async () => {
      for (const id of ids) {
        const op = await localDb.operations.get(id);
        if (!op) continue;

        const updateData: Partial<LocalOperation> = {
          status,
          lastAttempt: incrementRetry ? new Date().toISOString() : op.lastAttempt,
        };

        if (incrementRetry) {
          updateData.retryCount = op.retryCount + 1;
        }

        await localDb.operations.update(id, updateData);
      }
    });
  }

  /**
   * Cleans successfully synced operations from IndexedDB to reclaim memory storage.
   */
  async pruneSyncedOperations(documentId: string): Promise<void> {
    const syncedIds = await localDb.operations
      .where("documentId")
      .equals(documentId)
      .filter((op) => op.status === "synced")
      .primaryKeys();

    if (syncedIds.length > 0) {
      await localDb.operations.bulkDelete(syncedIds);
    }
  }

  /**
   * Resets syncing operations back to pending (e.g. after a crash or page refresh).
   */
  async resetStuckSyncingOperations(): Promise<void> {
    const stuckIds = await localDb.operations
      .where("status")
      .equals("syncing")
      .primaryKeys();

    if (stuckIds.length > 0) {
      await localDb.transaction("rw", localDb.operations, async () => {
        for (const id of stuckIds) {
          await localDb.operations.update(id, { status: "pending" });
        }
      });
    }
  }
}

export const operationQueue = new OperationQueue();
