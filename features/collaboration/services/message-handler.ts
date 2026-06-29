import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import * as sync from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as Y from "yjs";


export enum MessageType {
  SYNC = 0,
  AWARENESS = 1,
}

export class MessageHandler {
  /**
   * Encodes a standard Sync Step 1 message.
   */
  static encodeSyncStep1(doc: Y.Doc): Uint8Array {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MessageType.SYNC);
    sync.writeSyncStep1(encoder, doc);
    return encoding.toUint8Array(encoder);
  }

  /**
   * Encodes an awareness state update payload for a list of client IDs.
   */
  static encodeAwarenessUpdate(awareness: any, clients: number[]): Uint8Array {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MessageType.AWARENESS);
    const update = awarenessProtocol.encodeAwarenessUpdate(awareness, clients);
    encoding.writeVarUint8Array(encoder, update);
    return encoding.toUint8Array(encoder);
  }

  /**
   * Decodes and applies a sync payload to the given Yjs document.
   * If a reply is required (e.g. sync step 2 / state vector back), returns the reply payload.
   */
  static handleSyncMessage(
    payload: Uint8Array,
    doc: Y.Doc,
    origin: string = "websocket"
  ): Uint8Array | null {
    const decoder = decoding.createDecoder(payload);
    const encoder = encoding.createEncoder();

    // Read top-level WebSocket message type byte
    const messageType = decoding.readVarUint(decoder);
    if (messageType !== MessageType.SYNC) {
      return null;
    }

    // Write reply header
    encoding.writeVarUint(encoder, MessageType.SYNC);

    // Parse sync message (syncStep1, syncStep2, or update)
    sync.readSyncMessage(decoder, encoder, doc, origin);

    // If reply encoder has elements beyond the type header, return the reply
    if (encoding.length(encoder) > 1) {
      return encoding.toUint8Array(encoder);
    }
    return null;
  }

  /**
   * Decodes and applies an awareness state update payload to the given Yjs awareness instance.
   */
  static handleAwarenessMessage(
    payload: Uint8Array,
    awareness: any,
    origin: any = "websocket"
  ): void {
    const decoder = decoding.createDecoder(payload);
    
    const messageType = decoding.readVarUint(decoder);
    if (messageType !== MessageType.AWARENESS) {
      return;
    }

    const update = decoding.readVarUint8Array(decoder);
    awarenessProtocol.applyAwarenessUpdate(awareness, update, origin);
  }
}
