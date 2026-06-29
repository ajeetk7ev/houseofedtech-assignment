"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Global boundary caught error:", error);
  }, [error]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-zinc-100 antialiased selection:bg-zinc-800 selection:text-white">
      {/* Dynamic Background Patterns */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-black pointer-events-none" />
      <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-red-600/10 blur-3xl pointer-events-none opacity-20" />
      <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-amber-600/10 blur-3xl pointer-events-none opacity-20" />

      <div className="relative w-full max-w-md space-y-6 text-center">
        {/* Warning Icon Badge */}
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-500 shadow-lg shadow-red-500/5 backdrop-blur-md">
            <AlertTriangle className="h-7 w-7" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-white">Something went wrong</h1>
          <p className="text-sm text-zinc-400 max-w-sm mx-auto">
            An unexpected error occurred in the canvas application. Our systems have logged this incident.
          </p>
        </div>

        {/* Glassmorphic Error Box */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-2xl backdrop-blur-md text-left space-y-3">
          <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider text-zinc-500">
            <span>Diagnostics</span>
            {error.digest && <span>Digest: {error.digest}</span>}
          </div>
          <div className="rounded-lg bg-zinc-950/70 p-3.5 border border-zinc-800/50 font-mono text-xs text-red-400 break-all overflow-x-auto max-h-32">
            {error.message || "Unknown runtime exception"}
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            onClick={() => reset()}
            className="flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-zinc-950 transition-all hover:bg-zinc-200"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Try Again</span>
          </button>
          
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-2.5 text-sm font-semibold text-zinc-300 transition-all hover:bg-zinc-900 hover:text-white"
          >
            <Home className="h-4 w-4" />
            <span>Go to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
