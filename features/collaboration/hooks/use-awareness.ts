"use client";

import { useContext } from "react";
import { AwarenessContext, RemoteCursor } from "../providers/awareness-provider";

/**
 * React hook to retrieve remote client cursor positions, colors, and profile details.
 */
export function useAwareness(): RemoteCursor[] {
  return useContext(AwarenessContext);
}
export default useAwareness;
