import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";
import { ConnectionManager } from "../services/connection-manager";

/**
 * Custom client-side provider wrapper that couples Yjs WebsocketProvider
 * with our ConnectionManager to coordinate token validation and reconnect logic.
 */
export class WebSocketCollabProvider {
  public provider: WebsocketProvider;
  public connectionManager: ConnectionManager;
  public documentId: string;
  public yDoc: Y.Doc;

  constructor(documentId: string, yDoc: Y.Doc) {
    this.documentId = documentId;
    this.yDoc = yDoc;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname === "localhost" ? "localhost:3001" : window.location.host;
    // serverUrl is the base WS server; roomname is appended automatically as `serverUrl/roomname`
    const serverUrl = `${protocol}//${host}`;
    const roomname = `ws/documents/${documentId}`;

    // Initialize WebsocketProvider with connect:false — ConnectionManager fetches the
    // auth token first, then sets provider.params = { token } before calling connect().
    this.provider = new WebsocketProvider(serverUrl, roomname, yDoc, {
      connect: false,
    });

    this.connectionManager = new ConnectionManager(documentId);
    this.connectionManager.setProvider(this.provider);
  }

  /**
   * Cleans up provider and socket connection.
   */
  destroy() {
    this.connectionManager.destroy();
    this.provider.destroy();
  }
}
export default WebSocketCollabProvider;
