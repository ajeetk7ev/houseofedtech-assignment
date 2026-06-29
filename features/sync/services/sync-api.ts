import { LocalOperation } from "./local-db";

export interface SyncPayloadItem {
  clientId: string;
  sequenceNumber: number;
  baseVersion: number;
  update: string; // Base64 encoded update payload
  checksum: string;
}

export interface SyncResponseItem {
  clientId: string;
  sequenceNumber: number;
  baseVersion: number;
  update: string; // Base64 encoded update payload
  checksum: string | null;
}

export interface SyncResponse {
  success: boolean;
  data: {
    newOperations: SyncResponseItem[];
    lastServerOperation: number;
  };
}

export class SyncApi {
  /**
   * Translates local queue items to base64 API payloads and syncs them with the backend.
   */
  async syncOperations(
    documentId: string,
    deviceId: string,
    lastServerOperation: number,
    pendingOps: LocalOperation[]
  ): Promise<{ newOperations: SyncResponseItem[]; lastServerOperation: number }> {
    // Map binary payloads to base64 transport strings
    const payloadOps: SyncPayloadItem[] = pendingOps.map((op) => ({
      clientId: op.clientId,
      sequenceNumber: op.sequenceNumber,
      baseVersion: op.baseVersion,
      update: this.uint8ArrayToBase64(op.operation),
      checksum: op.checksum,
    }));

    const response = await fetch(`/api/documents/${documentId}/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        deviceId,
        lastServerOperation,
        operations: payloadOps,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = `Sync request failed with status ${response.status}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMsg = errorJson?.error?.message || errorMsg;
      } catch {
        // Fallback to raw text
      }
      throw new Error(errorMsg);
    }

    const json: SyncResponse = await response.json();
    return json.data;
  }

  private uint8ArrayToBase64(arr: Uint8Array): string {
    if (typeof window !== "undefined" && window.btoa) {
      // Browser environment binary conversion
      let binary = "";
      const len = arr.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(arr[i]);
      }
      return window.btoa(binary);
    } else {
      // Node.js fallback (if executing server-side tests)
      return Buffer.from(arr).toString("base64");
    }
  }
}

export const syncApi = new SyncApi();
