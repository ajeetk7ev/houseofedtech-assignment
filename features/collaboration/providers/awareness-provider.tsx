"use client";

import React, { createContext, useState, useEffect } from "react";

export interface RemoteCursor {
  clientId: number;
  userId: string;
  userName: string;
  userColor: string;
  userImage: string | null;
  cursor: { anchor: number; head: number } | null;
  lastActive: number;
  isTyping: boolean;
}

export const AwarenessContext = createContext<RemoteCursor[]>([]);

interface AwarenessProviderProps {
  awareness: any;
  children: React.ReactNode;
}

/**
 * React Context Provider that listens to Yjs awareness updates and publishes
 * cursors, selection highlights, and cursor states of remote clients.
 */
export const AwarenessProvider: React.FC<AwarenessProviderProps> = ({ awareness, children }) => {
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);

  useEffect(() => {
    if (!awareness) return;

    const handleUpdate = () => {
      const states = awareness.getStates();
      const cursors: RemoteCursor[] = [];

      states.forEach((state: any, client: number) => {
        // Exclude our own client state
        if (client === awareness.clientID) return;

        if (state.user) {
          cursors.push({
            clientId: client,
            userId: state.user.id,
            userName: state.user.name,
            userColor: state.user.color,
            userImage: state.user.image,
            cursor: state.cursor || null,
            lastActive: state.lastActive || Date.now(),
            isTyping: state.isTyping || false,
          });
        }
      });

      setRemoteCursors(cursors);
    };

    awareness.on("change", handleUpdate);
    handleUpdate();

    return () => {
      awareness.off("change", handleUpdate);
    };
  }, [awareness]);

  return (
    <AwarenessContext.Provider value={remoteCursors}>
      {children}
    </AwarenessContext.Provider>
  );
};
export default AwarenessProvider;
