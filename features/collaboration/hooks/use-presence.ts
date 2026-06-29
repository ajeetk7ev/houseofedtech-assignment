"use client";

import { useContext } from "react";
import { PresenceContext, UserPresence } from "../providers/presence-provider";

/**
 * React hook to retrieve the list of active user presences and their connection states.
 */
export function usePresence(): UserPresence[] {
  return useContext(PresenceContext);
}
export default usePresence;
