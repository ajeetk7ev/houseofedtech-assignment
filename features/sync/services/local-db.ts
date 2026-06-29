import Dexie, { type Table } from "dexie";

export interface LocalDocument {
  id: string;
  title: string;
  latestSnapshot: Uint8Array | null;
  lastOperationNumber: number;
  createdBy: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  syncedTitle?: string;
  syncedIsArchived?: boolean;
}

export interface LocalOperation {
  id?: number; // Auto-incrementing local ID
  documentId: string;
  clientId: string;
  sequenceNumber: number;
  baseVersion: number;
  operation: Uint8Array; // Binary update payload
  checksum: string; // Sha256 hash of operation binary payload
  createdAt: string;
  status: "pending" | "syncing" | "synced" | "failed";
  retryCount: number;
  lastAttempt: string | null;
}

export interface LocalSyncState {
  documentId: string;
  deviceId: string;
  lastServerOperation: number;
  lastClientOperation: number;
  lastSyncAt: string;
}

export interface LocalVersion {
  id: string;
  documentId: string;
  title: string;
  description: string | null;
  snapshot: Uint8Array;
  createdBy: string;
  createdAt: string;
  isPendingSync?: boolean;
}

export interface LocalMetadata {
  key: string;
  value: unknown;
}

export interface LocalSettings {
  key: string;
  value: unknown;
}

class LocalDatabase extends Dexie {
  documents!: Table<LocalDocument, string>;
  operations!: Table<LocalOperation, number>;
  sync_state!: Table<LocalSyncState, string>;
  versions!: Table<LocalVersion, string>;
  metadata!: Table<LocalMetadata, string>;
  settings!: Table<LocalSettings, string>;

  constructor() {
    super("LocalCollaborativeEditorDB");
    
    this.version(2).stores({
      documents: "id, title, isArchived, updatedAt",
      operations: "++id, documentId, status, [documentId+sequenceNumber]",
      sync_state: "documentId, deviceId",
      versions: "id, documentId, createdAt",
      metadata: "key",
      settings: "key",
    });
  }
}

// Singleton export
export const localDb = new LocalDatabase();
