import { ReconnectManager } from "./reconnect-manager";

export type ConnectionState = "connected" | "connecting" | "reconnecting" | "offline" | "disconnected";

export interface ConnectionStateListener {
  (state: ConnectionState, attempts: number): void;
}

/**
 * Manages client WebSocket lifecycle: token acquisition, connection state tracking,
 * pings, heartbeats, timeouts, and backoff scheduling.
 */
export class ConnectionManager {
  private documentId: string;
  private state: ConnectionState = "disconnected";
  private reconnectManager = new ReconnectManager();
  private listeners: Set<ConnectionStateListener> = new Set();
  
  private provider: any = null; // Reference to WebsocketProvider
  private isDestroyed = false;
  private tokenTimeout: any = null;
  private reconnectTimeout: any = null;
  private heartbeatInterval: any = null;
  private heartbeatTimeout: any = null;
  
  constructor(documentId: string) {
    this.documentId = documentId;
  }

  /**
   * Binds the connection manager to a y-websocket WebsocketProvider instance.
   */
  setProvider(provider: any) {
    this.provider = provider;
  }

  subscribe(listener: ConnectionStateListener): () => void {
    this.listeners.add(listener);
    // Fire immediately with current state
    listener(this.state, this.reconnectManager.currentAttempts);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitStateChange() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.state, this.reconnectManager.currentAttempts);
      } catch (err) {
        console.error("Error in connection listener:", err);
      }
    });
  }

  private updateState(newState: ConnectionState) {
    if (this.state === newState) return;
    this.state = newState;
    this.emitStateChange();
  }

  /**
   * Fetches a fresh auth token from the API.
   * Returns `{ token, permanent: false }` on success,
   * `{ token: null, permanent: true }` on non-retryable errors (e.g. 404 = document not yet in DB),
   * or `{ token: null, permanent: false }` on transient errors.
   */
  private async fetchAuthToken(): Promise<{ token: string | null; permanent: boolean }> {
    try {
      const response = await fetch(`/api/documents/${this.documentId}/auth-token`);

      // 404 = document doesn't exist on the server yet (offline-created doc).
      // 401/403 = auth issue. Neither will resolve by retrying — treat as permanent.
      if (response.status === 404 || response.status === 401 || response.status === 403) {
        console.warn(`[Collab] Auth token fetch permanent failure (${response.status}) for doc ${this.documentId}. Staying offline.`);
        return { token: null, permanent: true };
      }

      if (!response.ok) {
        console.error(`[Collab] Auth API transient error: ${response.statusText}`);
        return { token: null, permanent: false };
      }

      const json = await response.json();
      if (json.success && json.data?.token) {
        return { token: json.data.token, permanent: false };
      }
      return { token: null, permanent: false };
    } catch (err) {
      // Network error (server down, no connection) — transient
      console.warn("[Collab] Failed to fetch collaboration auth token (network error):", err);
      return { token: null, permanent: false };
    }
  }

  /**
   * Initializes the WebSocket connection.
   */
  async connect(): Promise<void> {
    if (this.isDestroyed || this.state === "connected" || this.state === "connecting") {
      return;
    }

    if (this.state === "disconnected") {
      this.updateState("connecting");
    } else {
      this.updateState("reconnecting");
    }

    const { token, permanent } = await this.fetchAuthToken();
    if (!token) {
      if (permanent) {
        // Permanent failure: document not on server yet — go offline, don't retry
        this.updateState("offline");
        return;
      }
      this.handleConnectionFailure();
      return;
    }

    if (this.isDestroyed) return;

    if (this.provider) {
      // `params` is documented as safely mutable in y-websocket. The computed `url`
      // getter automatically embeds them as query params on the next connection.
      this.provider.params = { token };
      this.provider.connect();

      // Bind events after connect() kicks off setupWS asynchronously
      setTimeout(() => this.bindSocketEvents(), 0);
    }
  }

  private bindSocketEvents() {
    const ws = this.provider.ws;
    if (!ws) return;

    const originalOnOpen = ws.onopen;
    const originalOnClose = ws.onclose;
    const originalOnError = ws.onerror;
    const originalOnMessage = ws.onmessage;

    ws.onopen = (event: any) => {
      if (originalOnOpen) originalOnOpen(event);
      this.handleOpen();
    };

    ws.onclose = (event: any) => {
      if (originalOnClose) originalOnClose(event);
      this.handleClose();
    };

    ws.onerror = (event: any) => {
      if (originalOnError) originalOnError(event);
      console.warn("Collaboration socket error:", event);
    };

    ws.onmessage = (event: any) => {
      this.resetHeartbeatTimeout();
      
      // Heartbeat pong check: if the server responds with a pong
      if (event.data instanceof ArrayBuffer) {
        const view = new Uint8Array(event.data);
        if (view.length === 1 && view[0] === 254) {
          // Heartbeat pong
          return;
        }
      } else if (typeof event.data === "string" && event.data === "pong") {
        return;
      }

      if (originalOnMessage) originalOnMessage(event);
    };
  }

  private handleOpen() {
    this.reconnectManager.reset();
    this.updateState("connected");
    this.startHeartbeat();
  }

  private handleClose() {
    this.stopHeartbeat();
    this.handleConnectionFailure();
  }

  private handleConnectionFailure() {
    if (this.isDestroyed) return;

    if (navigator.onLine === false) {
      this.updateState("offline");
      // Wait for browser online event to trigger reconnect
      window.addEventListener("online", this.handleBrowserOnline, { once: true });
      return;
    }

    const delay = this.reconnectManager.getNextDelay();
    if (delay === -1) {
      console.error("Max reconnection attempts reached. Disconnecting.");
      this.updateState("disconnected");
      return;
    }

    this.updateState("reconnecting");
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private handleBrowserOnline = () => {
    this.connect();
  };

  /**
   * Heartbeat check to prevent proxy dropouts and detect stale connections.
   */
  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      this.sendPing();
    }, 30000); // Send ping every 30 seconds
  }

  private sendPing() {
    const ws = this.provider?.ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        // Send a binary ping byte 255
        ws.send(new Uint8Array([255]));
        
        // Timeout if server doesn't respond in 10 seconds
        this.heartbeatTimeout = setTimeout(() => {
          console.warn("Heartbeat timeout. Closing stale connection.");
          ws.close();
        }, 10000);
      } catch (err) {
        console.error("Failed to send heartbeat ping:", err);
      }
    }
  }

  private resetHeartbeatTimeout() {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.resetHeartbeatTimeout();
  }

  /**
   * Graceful disconnect.
   */
  disconnect() {
    this.stopHeartbeat();
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    if (this.tokenTimeout) clearTimeout(this.tokenTimeout);
    window.removeEventListener("online", this.handleBrowserOnline);

    if (this.provider) {
      this.provider.disconnect();
    }
    this.updateState("disconnected");
  }

  /**
   * Destroy manager.
   */
  destroy() {
    this.isDestroyed = true;
    this.disconnect();
    this.listeners.clear();
  }
}
export default ConnectionManager;
