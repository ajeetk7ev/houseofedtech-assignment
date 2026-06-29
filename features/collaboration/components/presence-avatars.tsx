"use client";

import React from "react";
import { usePresence } from "../hooks/use-presence";

/**
 * Reusable UI component displaying active collaborator avatars in an overlapping stack,
 * highlighting their color assignment, online status (online/idle/offline), and typing activity.
 */
export const PresenceAvatars: React.FC = () => {
  const presences = usePresence();

  if (presences.length === 0) return null;

  const maxVisible = 4;
  const visiblePresences = presences.slice(0, maxVisible);
  const remainingCount = presences.length - maxVisible;

  return (
    <div className="flex items-center gap-2">
      {/* Overlapping Avatar Stack */}
      <div className="flex -space-x-2 overflow-hidden py-1 px-2">
        {visiblePresences.map((presence) => {
          const initials = presence.userName
            .split(" ")
            .map((n) => n[0])
            .join("")
            .substring(0, 2)
            .toUpperCase();

          const statusColor =
            presence.status === "online"
              ? "bg-emerald-500 animate-pulse"
              : presence.status === "idle"
              ? "bg-amber-500"
              : "bg-zinc-500";

          return (
            <div
              key={presence.userId}
              className="relative inline-block h-7 w-7 rounded-full ring-2 ring-white dark:ring-zinc-950 group transition-transform duration-200 hover:-translate-y-0.5 hover:z-10 cursor-pointer"
            >
              {presence.userImage ? (
                <img
                  className="h-full w-full rounded-full object-cover"
                  src={presence.userImage}
                  alt={presence.userName}
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm"
                  style={{ backgroundColor: presence.userColor }}
                >
                  {initials}
                </div>
              )}

              {/* Status Badge */}
              <span className={`absolute bottom-0 right-0 block h-2 w-2 rounded-full ring-1 ring-white dark:ring-zinc-950 ${statusColor}`} />
              
              {/* Rich Tooltip on Hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col items-center z-50 pointer-events-none">
                <div className="bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-200 px-2 py-1 rounded shadow-md whitespace-nowrap">
                  <span className="font-semibold" style={{ color: presence.userColor }}>
                    {presence.userName}
                  </span>
                  {presence.isTyping && <span className="ml-1 text-emerald-400 font-medium">typing...</span>}
                  <span className="block text-[8px] text-zinc-500 capitalize">
                    {presence.status} {presence.status === "idle" ? "(inactive)" : ""}
                  </span>
                </div>
                <div className="w-1.5 h-1.5 bg-zinc-900 border-r border-b border-zinc-800 rotate-45 -mt-1" />
              </div>
            </div>
          );
        })}

        {remainingCount > 0 && (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-900 ring-2 ring-white dark:ring-zinc-950 text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
            +{remainingCount}
          </div>
        )}
      </div>
      
      {/* Real-time typing message banner */}
      {presences.some((p) => p.isTyping) && (
        <span className="text-[10px] text-zinc-400 animate-pulse hidden sm:inline-block ml-1">
          {presences
            .filter((p) => p.isTyping)
            .map((p) => p.userName)
            .join(", ")}{" "}
          {presences.filter((p) => p.isTyping).length > 1 ? "are typing..." : "is typing..."}
        </span>
      )}
    </div>
  );
};
export default PresenceAvatars;
