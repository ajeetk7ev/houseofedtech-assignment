"use client";

import { useEffect } from "react";

/**
 * Service Worker registration component.
 * Mounts client-side and registers sw.js on window load.
 */
export default function SwRegister() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator
    ) {
      const register = () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("ServiceWorker registered successfully with scope: ", registration.scope);
          })
          .catch((err) => {
            console.error("ServiceWorker registration failed: ", err);
          });
      };

      if (document.readyState === "complete" || document.readyState === "interactive") {
        register();
      } else {
        window.addEventListener("load", register);
        return () => window.removeEventListener("load", register);
      }
    }
  }, []);

  return null;
}
