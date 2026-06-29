"use client";

import { useEffect, useState } from "react";

type ConnectionListener = (isOnline: boolean) => void;

class NetworkManagerClass {
  private isOnlineState: boolean = true;
  private listeners: Set<ConnectionListener> = new Set();
  private isInitialized: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.isOnlineState = navigator.onLine;
      this.initListeners();
    }
  }

  private initListeners() {
    if (this.isInitialized) return;
    
    window.addEventListener("online", this.handleOnline);
    window.addEventListener("offline", this.handleOffline);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    
    this.isInitialized = true;
  }

  private handleOnline = () => {
    this.updateStatus(true);
  };

  private handleOffline = () => {
    this.updateStatus(false);
  };

  private handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      // Re-evaluate actual online state when tab is focused
      this.updateStatus(navigator.onLine);
    }
  };

  private updateStatus(newStatus: boolean) {
    if (this.isOnlineState === newStatus) return;
    
    this.isOnlineState = newStatus;
    this.listeners.forEach((listener) => {
      try {
        listener(newStatus);
      } catch (err) {
        console.error("Error in NetworkManager listener:", err);
      }
    });
  }

  get isOnline(): boolean {
    if (typeof window === "undefined") return true;
    return this.isOnlineState;
  }

  subscribe(listener: ConnectionListener): () => void {
    if (typeof window !== "undefined") {
      this.initListeners();
    }
    
    this.listeners.add(listener);
    
    // Return unsubscribe callback
    return () => {
      this.listeners.delete(listener);
    };
  }

  destroy() {
    if (typeof window === "undefined") return;
    
    window.removeEventListener("online", this.handleOnline);
    window.removeEventListener("offline", this.handleOffline);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.listeners.clear();
    this.isInitialized = false;
  }
}

// Global Singleton for service access
export const NetworkManager = new NetworkManagerClass();

/**
 * Reusable React hook that reflects current browser connectivity state.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(NetworkManager.isOnline);

  useEffect(() => {
    // Listen to changes
    const unsubscribe = NetworkManager.subscribe((status) => {
      setIsOnline(status);
    });

    return unsubscribe;
  }, []);

  return isOnline;
}
