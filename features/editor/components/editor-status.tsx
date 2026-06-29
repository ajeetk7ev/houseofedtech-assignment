"use client";

import React from "react";
import { useEditorContext } from "./editor-provider";
import { Wifi, WifiOff, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";

export const EditorStatus: React.FC = () => {
  const { syncStatus, pendingOpsCount } = useEditorContext();

  const getStatusConfig = () => {
    switch (syncStatus) {
      case "synced":
        return {
          icon: <CheckCircle className="h-4 w-4 text-emerald-500" />,
          text: "Synced",
          color: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-900/50",
        };
      case "syncing":
        return {
          icon: <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />,
          text: "Syncing...",
          color: "text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/30 dark:border-blue-900/50",
        };
      case "offline":
        return {
          icon: <WifiOff className="h-4 w-4 text-amber-500" />,
          text: pendingOpsCount > 0 ? `Offline - ${pendingOpsCount} pending` : "Offline",
          color: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-900/50",
        };
      case "failed":
        return {
          icon: <AlertCircle className="h-4 w-4 text-rose-500" />,
          text: pendingOpsCount > 0 ? `Sync Failed (${pendingOpsCount} pending)` : "Sync Failed",
          color: "text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-950/30 dark:border-rose-900/50",
        };
      case "reconnecting":
        return {
          icon: <RefreshCw className="h-4 w-4 animate-spin text-purple-500" />,
          text: "Reconnecting...",
          color: "text-purple-700 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-950/30 dark:border-purple-900/50",
        };
      default:
        return {
          icon: <Wifi className="h-4 w-4 text-zinc-500" />,
          text: "Status checking",
          color: "text-zinc-700 bg-zinc-50 border-zinc-200 dark:text-zinc-400 dark:bg-zinc-950/30 dark:border-zinc-900/50",
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium shadow-xs transition-colors duration-250 ${config.color}`}>
      {config.icon}
      <span>{config.text}</span>
    </div>
  );
};
export default EditorStatus;
