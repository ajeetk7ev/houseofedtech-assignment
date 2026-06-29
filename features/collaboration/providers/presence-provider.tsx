"use client";

import React, { createContext, useState, useEffect } from "react";

export interface UserPresence {
  userId: string;
  userName: string;
  userImage: string | null;
  userColor: string;
  status: "online" | "idle" | "offline";
  lastSeen: number;
  isTyping: boolean;
}

export const PresenceContext = createContext<UserPresence[]>([]);

interface PresenceProviderProps {
  awareness: any;
  children: React.ReactNode;
}

/**
 * React Context Provider that handles evaluating remote presence details
 * (Online, Idle, Offline) dynamically using state metrics and periodic polling.
 */
export const PresenceProvider: React.FC<PresenceProviderProps> = ({ awareness, children }) => {
  const [presences, setPresences] = useState<UserPresence[]>([]);

  useEffect(() => {
    if (!awareness) return;

    const handleUpdate = () => {
      const states = awareness.getStates();
      const userMap = new Map<string, UserPresence>();

      states.forEach((state: any, clientId: number) => {
        if (!state.user) return;
        // Exclude our own client state from the presence list
        if (clientId === awareness.clientID) return;

        const lastActive = state.lastActive || Date.now();
        const timeDiff = Date.now() - lastActive;

        let status: "online" | "idle" | "offline" = "online";
        if (timeDiff > 5 * 60 * 1000) {
          // Offline after 5 minutes of total inactivity
          status = "offline";
        } else if (timeDiff > 1 * 60 * 1000) {
          // Idle after 1 minute of inactivity
          status = "idle";
        }

        const existing = userMap.get(state.user.id);
        // Take the latest/most active connection state for this user ID
        if (!existing || existing.lastSeen < lastActive) {
          userMap.set(state.user.id, {
            userId: state.user.id,
            userName: state.user.name,
            userImage: state.user.image,
            userColor: state.user.color,
            status,
            lastSeen: lastActive,
            isTyping: state.isTyping || false,
          });
        }
      });

      setPresences(Array.from(userMap.values()));
    };

    awareness.on("change", handleUpdate);
    handleUpdate();

    // Check status intervals periodically to transition active users to idle/offline status
    const interval = setInterval(handleUpdate, 15000);

    return () => {
      awareness.off("change", handleUpdate);
      clearInterval(interval);
    };
  }, [awareness]);

  return (
    <PresenceContext.Provider value={presences}>
      {children}
    </PresenceContext.Provider>
  );
};
export default PresenceProvider;
