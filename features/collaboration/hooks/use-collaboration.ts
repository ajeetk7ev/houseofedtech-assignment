"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import * as Y from "yjs";
import { WebSocketCollabProvider } from "../providers/websocket-provider";

const USER_COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#06b6d4", // Cyan
  "#14b8a6", // Teal
];

function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % USER_COLORS.length;
  return USER_COLORS[index];
}

interface UseCollaborationResult {
  provider: WebSocketCollabProvider | null;
  userColor: string;
}

/**
 * Custom React Hook to initialize and clean up collaborative Yjs websocket sessions.
 * Automatically handles populating local client profile details for cursor presence.
 */
export function useCollaboration(documentId: string, yDoc: Y.Doc): UseCollaborationResult {
  const { data: session } = useSession();
  const [provider, setProvider] = useState<WebSocketCollabProvider | null>(null);
  const [userColor, setUserColor] = useState<string>("#9ca3af"); // Default gray

  useEffect(() => {
    const user = session?.user;
    if (!user || !user.id) return;

    const collabProvider = new WebSocketCollabProvider(documentId, yDoc);
    const localUserId = user.id;
    const localColor = getUserColor(localUserId);

    setUserColor(localColor);

    // Initialize local awareness user details
    const initLocalAwareness = () => {
      collabProvider.provider.awareness.setLocalStateField("user", {
        id: localUserId,
        name: user.name || user.email?.split("@")[0] || "Anonymous",
        image: user.image || null,
        color: localColor,
      });
      collabProvider.provider.awareness.setLocalStateField("lastActive", Date.now());
      collabProvider.provider.awareness.setLocalStateField("isTyping", false);
    };

    initLocalAwareness();
    setProvider(collabProvider);

    // Start WebSocket connection manager
    collabProvider.connectionManager.connect();

    // Setup local user activity ticker (every 10 seconds of active editing/focus)
    const activityInterval = setInterval(() => {
      collabProvider.provider.awareness.setLocalStateField("lastActive", Date.now());
    }, 15000);

    return () => {
      clearInterval(activityInterval);
      collabProvider.destroy();
      setProvider(null);
    };
  }, [documentId, yDoc, session?.user?.id, session?.user?.name, session?.user?.email, session?.user?.image]);

  return {
    provider,
    userColor,
  };
}
export default useCollaboration;
