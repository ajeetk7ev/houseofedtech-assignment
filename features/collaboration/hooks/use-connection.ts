"use client";

import { useEffect, useState } from "react";
import { ConnectionState } from "../services/connection-manager";
import { WebSocketCollabProvider } from "../providers/websocket-provider";

interface UseConnectionResult {
  connectionState: ConnectionState;
  attempts: number;
}

/**
 * React hook to watch WebSocket connection states (Connected, Reconnecting, Offline, etc.).
 * Listens to active events on the provider's ConnectionManager.
 */
export function useConnection(provider: WebSocketCollabProvider | null): UseConnectionResult {
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [attempts, setAttempts] = useState<number>(0);

  useEffect(() => {
    if (!provider) {
      setConnectionState("disconnected");
      setAttempts(0);
      return;
    }

    // Subscribe to connection lifecycle status updates
    const unsubscribe = provider.connectionManager.subscribe((state, currentAttempts) => {
      setConnectionState(state);
      setAttempts(currentAttempts);
    });

    return unsubscribe;
  }, [provider]);

  return {
    connectionState,
    attempts,
  };
}
export default useConnection;
