import { localDb } from "./local-db";
import { operationQueue } from "./operation-queue";
import { syncApi } from "./sync-api";
import { retryManager } from "./retry-manager";
import { NetworkManager } from "./network-manager";
import * as Y from "yjs";

export type SyncStatusType = "synced" | "syncing" | "offline" | "failed" | "reconnecting";

type SyncStatusListener = (documentId: string, status: SyncStatusType, pendingCount: number) => void;

class SyncEngineClass {
  private activeSyncs: Set<string> = new Set();
  private deviceId: string | null = null;
  private listeners: Map<string, Set<SyncStatusListener>> = new Map();
  private isListeningToNetwork: boolean = false;

  constructor() {
    this.setupNetworkListener();
  }

  private setupNetworkListener() {
    if (this.isListeningToNetwork || typeof window === "undefined") return;

    NetworkManager.subscribe((isOnline) => {
      if (isOnline) {
        // Automatically trigger sync for all active documents when connection is restored
        this.triggerGlobalSync();
      } else {
        // Broadcast offline status for currently loaded/listening documents
        this.listeners.forEach((_, docId) => {
          this.notifyStatus(docId, "offline");
        });
      }
    });

    this.isListeningToNetwork = true;
  }

  /**
   * Generates or retrieves a unique device UUID, stored strictly in IndexedDB settings.
   */
  async getDeviceId(): Promise<string> {
    if (this.deviceId) return this.deviceId;

    const storedDevice = await localDb.settings.get("deviceId");
    if (storedDevice && typeof storedDevice.value === "string") {
      this.deviceId = storedDevice.value;
      return this.deviceId;
    }

    // Generate standard v4 UUID
    const uuid = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : "device-" + Math.random().toString(36).substring(2, 15);

    await localDb.settings.put({ key: "deviceId", value: uuid });
    this.deviceId = uuid;
    return uuid;
  }

  /**
   * Programmatic entrypoint to sync a document's local queue with the database.
   */
  async syncDocument(documentId: string, yDoc?: Y.Doc): Promise<void> {
    if (this.activeSyncs.has(documentId)) return;

    if (!NetworkManager.isOnline) {
      this.notifyStatus(documentId, "offline");
      return;
    }

    this.activeSyncs.add(documentId);
    this.notifyStatus(documentId, "syncing");

    try {
      const deviceId = await this.getDeviceId();

      // 1. If the document was created offline, create it on the server first
      let docRecord = await localDb.documents.get(documentId);
      if (!docRecord) {
        if (NetworkManager.isOnline) {
          const response = await fetch(`/api/documents/${documentId}`);
          if (response.ok) {
            const json = await response.json();
            if (json.success && json.data) {
              const serverDoc = json.data;
              await localDb.documents.add({
                id: serverDoc.id,
                title: serverDoc.title,
                syncedTitle: serverDoc.title,
                latestSnapshot: serverDoc.latestSnapshot ? this.base64ToUint8Array(serverDoc.latestSnapshot) : null,
                lastOperationNumber: serverDoc.lastOperationNumber,
                createdBy: serverDoc.createdBy,
                isArchived: serverDoc.isArchived,
                syncedIsArchived: serverDoc.isArchived,
                createdAt: serverDoc.createdAt,
                updatedAt: serverDoc.updatedAt,
              });
              docRecord = await localDb.documents.get(documentId);
            }
          }
        }
      }

      if (docRecord && docRecord.createdBy === "me") {
        const response = await fetch("/api/documents", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: docRecord.id,
            title: docRecord.title,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to create offline document on server: ${response.statusText}`);
        }

        const json = await response.json();
        if (json.success && json.data) {
          await localDb.documents.update(documentId, {
            createdBy: json.data.createdBy,
            createdAt: json.data.createdAt,
            updatedAt: json.data.updatedAt,
            syncedTitle: docRecord.title,
            syncedIsArchived: docRecord.isArchived,
          });
          docRecord = await localDb.documents.get(documentId);
        } else {
          throw new Error("Invalid response when creating offline document on server");
        }
      }

      // 2. Sync title or archive changes to server if they were modified locally
      if (docRecord && (docRecord.title !== docRecord.syncedTitle || docRecord.isArchived !== docRecord.syncedIsArchived)) {
        const updateData: { title?: string; isArchived?: boolean } = {};
        if (docRecord.title !== docRecord.syncedTitle) {
          updateData.title = docRecord.title;
        }
        if (docRecord.isArchived !== docRecord.syncedIsArchived) {
          updateData.isArchived = docRecord.isArchived;
        }

        const response = await fetch(`/api/documents/${documentId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updateData),
        });

        if (response.ok) {
          await localDb.documents.update(documentId, {
            syncedTitle: docRecord.title,
            syncedIsArchived: docRecord.isArchived,
          });
        }
      }

      // Retrieve last synced state
      let syncState = await localDb.sync_state.get(documentId);
      if (!syncState) {
        syncState = {
          documentId,
          deviceId,
          lastServerOperation: 0,
          lastClientOperation: 0,
          lastSyncAt: new Date().toISOString(),
        };
        await localDb.sync_state.add(syncState);
      }

      // Grab pending operations
      const pendingOps = await operationQueue.getPendingOperations(documentId);
      const pendingIds = pendingOps.map((op) => op.id!).filter(Boolean);

      if (pendingIds.length > 0) {
        await operationQueue.updateStatus(pendingIds, "syncing");
      }

      // Send updates to API and pull down fresh server changes
      const syncResult = await syncApi.syncOperations(
        documentId,
        deviceId,
        syncState.lastServerOperation,
        pendingOps
      );

      // On successful push/pull validation:
      await localDb.transaction("rw", [localDb.operations, localDb.sync_state, localDb.documents], async () => {
        // Mark pushed operations as synced
        if (pendingIds.length > 0) {
          await operationQueue.updateStatus(pendingIds, "synced");
        }

        // Apply server operations to local Y.Doc in memory & Dexie
        if (syncResult.newOperations.length > 0) {
          if (yDoc) {
            // Apply straight to active Yjs instance (which will automatically paint the editor)
            Y.transact(yDoc, () => {
              for (const op of syncResult.newOperations) {
                const updateBuffer = this.base64ToUint8Array(op.update);
                Y.applyUpdate(yDoc, updateBuffer);
              }
            }, "server-sync");
          }

          // Compile a new consolidated snapshot for IndexedDB documents table
          const docRecord = await localDb.documents.get(documentId);
          if (docRecord) {
            const tempDoc = new Y.Doc();
            if (docRecord.latestSnapshot) {
              Y.applyUpdate(tempDoc, docRecord.latestSnapshot);
            }
            
            for (const op of syncResult.newOperations) {
              Y.applyUpdate(tempDoc, this.base64ToUint8Array(op.update));
            }

            const mergedSnapshot = Y.encodeStateAsUpdate(tempDoc);
            await localDb.documents.update(documentId, {
              latestSnapshot: mergedSnapshot,
              lastOperationNumber: syncResult.lastServerOperation,
              updatedAt: new Date().toISOString(),
            });
          }
        }

        // Update sequence offsets index
        await localDb.sync_state.update(documentId, {
          lastServerOperation: syncResult.lastServerOperation,
          lastClientOperation: pendingOps.length > 0 ? pendingOps[pendingOps.length - 1].sequenceNumber : syncState!.lastClientOperation,
          lastSyncAt: new Date().toISOString(),
        });
      });

      // Prune successfully completed queue logs
      await operationQueue.pruneSyncedOperations(documentId);

      // 3. Sync pending manual version snapshots
      try {
        const pendingVersions = await localDb.versions
          .where("documentId")
          .equals(documentId)
          .filter((v) => !!v.isPendingSync)
          .toArray();

        for (const pv of pendingVersions) {
          const res = await fetch(`/api/documents/${documentId}/versions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: pv.title,
              description: pv.description,
              snapshot: this.uint8ArrayToBase64(pv.snapshot),
            }),
          });

          if (res.ok) {
            const json = await res.json();
            if (json.success && json.data) {
              await localDb.transaction("rw", localDb.versions, async () => {
                await localDb.versions.delete(pv.id);
                await localDb.versions.put({
                  id: json.data.id,
                  documentId: pv.documentId,
                  title: pv.title,
                  description: pv.description,
                  snapshot: pv.snapshot,
                  createdBy: pv.createdBy,
                  createdAt: json.data.createdAt || pv.createdAt,
                });
              });
            }
          }
        }
      } catch (err) {
        console.warn("Failed to synchronize pending versions in background:", err);
      }

      this.notifyStatus(documentId, "synced");
    } catch (err) {
      console.error(`Sync error on document ${documentId}:`, err);

      // Restore failed operation queue back, increasing retry counters
      const pendingOps = await operationQueue.getPendingOperations(documentId);
      const syncingIds = pendingOps.filter((op) => op.status === "syncing").map((op) => op.id!);
      
      if (syncingIds.length > 0) {
        await operationQueue.updateStatus(syncingIds, "failed", true);
      }

      this.notifyStatus(documentId, "failed");

      // Check retry limits and schedule backoff loop
      const nextOpToRetry = pendingOps.find((op) => op.status === "failed");
      if (nextOpToRetry && retryManager.shouldRetry(nextOpToRetry.retryCount)) {
        retryManager.scheduleRetry(() => {
          this.notifyStatus(documentId, "reconnecting");
          this.syncDocument(documentId, yDoc);
        }, nextOpToRetry.retryCount);
      }
    } finally {
      this.activeSyncs.delete(documentId);
    }
  }

  private async triggerGlobalSync() {
    // 1. Process pending deletions first
    if (NetworkManager.isOnline) {
      const deletedDocs = (await localDb.settings.get("pending-deletions"))?.value as string[] || [];
      if (deletedDocs.length > 0) {
        const remaining: string[] = [];
        for (const id of deletedDocs) {
          try {
            const response = await fetch(`/api/documents/${id}`, {
              method: "DELETE",
            });
            if (!response.ok && response.status !== 404) {
              remaining.push(id);
            }
          } catch (err) {
            console.error(`Failed to sync deletion for document ${id}:`, err);
            remaining.push(id);
          }
        }
        await localDb.settings.put({ key: "pending-deletions", value: remaining });
      }
    }

    // 2. Sync active/unsynced documents
    const documents = await localDb.documents.toArray();
    for (const doc of documents) {
      const pending = await operationQueue.getPendingOperations(doc.id);
      if (pending.length > 0 || doc.createdBy === "me" || doc.title !== doc.syncedTitle || doc.isArchived !== doc.syncedIsArchived) {
        this.syncDocument(doc.id);
      }
    }
  }

  private async notifyStatus(documentId: string, status: SyncStatusType) {
    const docListeners = this.listeners.get(documentId);
    if (!docListeners) return;

    const pendingCount = await localDb.operations
      .where("documentId")
      .equals(documentId)
      .filter((op) => op.status === "pending" || op.status === "failed")
      .count();

    docListeners.forEach((listener) => {
      try {
        listener(documentId, status, pendingCount);
      } catch (err) {
        console.error("Error notifying status listener:", err);
      }
    });
  }

  subscribe(documentId: string, listener: SyncStatusListener): () => void {
    if (!this.listeners.has(documentId)) {
      this.listeners.set(documentId, new Set());
    }

    this.listeners.get(documentId)!.add(listener);

    // Initial status fire
    localDb.operations
      .where("documentId")
      .equals(documentId)
      .filter((op) => op.status === "pending" || op.status === "failed")
      .count()
      .then((pendingCount) => {
        const initialStatus: SyncStatusType = NetworkManager.isOnline ? "synced" : "offline";
        listener(documentId, initialStatus, pendingCount);
      });

    return () => {
      const docListeners = this.listeners.get(documentId);
      if (docListeners) {
        docListeners.delete(listener);
        if (docListeners.size === 0) {
          this.listeners.delete(documentId);
        }
      }
    };
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    if (typeof window !== "undefined" && window.atob) {
      const binaryString = window.atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes;
    } else {
      return new Uint8Array(Buffer.from(base64, "base64"));
    }
  }

  private uint8ArrayToBase64(arr: Uint8Array): string {
    if (typeof window !== "undefined" && window.btoa) {
      let binary = "";
      const len = arr.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(arr[i]);
      }
      return window.btoa(binary);
    } else {
      return Buffer.from(arr).toString("base64");
    }
  }
}

export const syncEngine = new SyncEngineClass();
