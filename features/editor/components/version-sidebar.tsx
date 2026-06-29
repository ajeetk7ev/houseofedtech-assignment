"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { History, Plus, Loader2, Eye, RotateCcw, Trash2, Calendar, User, X, AlertCircle } from "lucide-react";
import * as Y from "yjs";
import { localDb } from "../../sync/services/local-db";

interface VersionItem {
  id: string;
  documentId: string;
  title: string;
  description: string | null;
  createdAt: string;
  createdBy: string;
  isAutomatic: boolean;
  parentVersionId: string | null;
  user?: {
    name: string | null;
    email: string | null;
  };
}

interface VersionSidebarProps {
  documentId: string;
  currentUserRole: "OWNER" | "EDITOR" | "VIEWER";
  yDoc: Y.Doc;
  onPreviewVersion: (versionId: string) => void;
  onRestoreVersion: (versionId: string, versionTitle: string) => void;
  onClose: () => void;
}

export const VersionSidebar: React.FC<VersionSidebarProps> = ({
  documentId,
  currentUserRole,
  yDoc,
  onPreviewVersion,
  onRestoreVersion,
  onClose,
}) => {
  const { data: session } = useSession();
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Manual save input states
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [isSavingMode, setIsSavingMode] = useState(false);

  const isOwner = currentUserRole === "OWNER";
  const isEditor = currentUserRole === "EDITOR" || isOwner;

  useEffect(() => {
    fetchVersions();
  }, [documentId]);

  const fetchVersions = async () => {
    const fallbackToLocal = async () => {
      try {
        const localVers = await localDb.versions.where("documentId").equals(documentId).toArray();
        // Sort by createdAt descending
        localVers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setVersions(localVers.map((v) => ({
          id: v.id,
          documentId: v.documentId,
          title: v.title,
          description: v.description,
          createdAt: v.createdAt,
          createdBy: v.createdBy,
          isAutomatic: false,
          parentVersionId: null,
          user: {
            name: v.createdBy === "me" || v.createdBy === session?.user?.id ? (session?.user?.name || "Me") : "Collaborator",
            email: null,
          }
        })));
      } catch (err) {
        console.error("Failed to read local versions:", err);
      }
    };

    try {
      setLoading(true);
      setError(null);

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await fallbackToLocal();
        return;
      }

      const res = await fetch(`/api/documents/${documentId}/versions`);
      const json = await res.json();
      if (json.success && json.data) {
        setVersions(json.data);
        
        // Cache in IndexedDB (delete old ones and save new ones)
        try {
          await localDb.versions.where("documentId").equals(documentId).delete();
          for (const v of json.data) {
            const existing = await localDb.versions.get(v.id);
            await localDb.versions.put({
              id: v.id,
              documentId: v.documentId,
              title: v.title,
              description: v.description,
              snapshot: existing?.snapshot || new Uint8Array(),
              createdBy: v.createdBy,
              createdAt: v.createdAt,
            });
          }
        } catch (e) {
          console.error("Failed to cache versions in local DB:", e);
        }
      } else {
        await fallbackToLocal();
      }
    } catch (err) {
      await fallbackToLocal();
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setActionLoading("create");
      setError(null);

      // 1. Serialize local Yjs document state
      const snapshotBytes = Y.encodeStateAsUpdate(yDoc);
      const snapshotBase64 = uint8ArrayToBase64(snapshotBytes);
      
      const newVersionId = typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).substring(2, 15);

      const timestamp = new Date().toISOString();
      const currentUserId = session?.user?.id || "me";

      // 2. Always save locally to IndexedDB first (marked as pending sync)
      await localDb.versions.put({
        id: newVersionId,
        documentId,
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        snapshot: snapshotBytes,
        createdBy: currentUserId,
        createdAt: timestamp,
        isPendingSync: true,
      });

      // 3. If online, attempt to POST to the server immediately
      if (typeof navigator !== "undefined" && navigator.onLine) {
        try {
          const res = await fetch(`/api/documents/${documentId}/versions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: newTitle.trim(),
              description: newDesc.trim() || null,
              snapshot: snapshotBase64,
            }),
          });

          const json = await res.json();
          if (json.success && json.data) {
            // Replace local placeholder with official synchronized version
            await localDb.versions.delete(newVersionId);
            await localDb.versions.put({
              id: json.data.id,
              documentId,
              title: json.data.title,
              description: json.data.description || null,
              snapshot: snapshotBytes,
              createdBy: currentUserId,
              createdAt: json.data.createdAt || timestamp,
            });
          }
        } catch (serverErr) {
          console.warn("Failed to push snapshot to server immediately, will sync in background:", serverErr);
        }
      }

      setNewTitle("");
      setNewDesc("");
      setIsSavingMode(false);
      await fetchVersions();
    } catch (err) {
      setError("Error occurred while saving document snapshot");
    } finally {
      setActionLoading(null);
    }
  };



  return (
    <div className="w-80 flex flex-col border-l border-zinc-200 bg-white h-full dark:border-zinc-800 dark:bg-zinc-950 animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-zinc-150 px-4 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-indigo-500" />
          <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">Version History</h3>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Manual Snapshot Form Toggle */}
      {isEditor && (
        <div className="p-3 border-b border-zinc-150 dark:border-zinc-800">
          {isSavingMode ? (
            <form onSubmit={handleCreateSnapshot} className="space-y-2.5">
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Version Name (e.g. Rough Draft)"
                className="w-full rounded-lg border border-zinc-250 bg-white px-2.5 py-1.5 text-xs text-zinc-800 focus:outline-none dark:border-zinc-850 dark:bg-zinc-900 dark:text-zinc-100"
              />
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                className="w-full rounded-lg border border-zinc-250 bg-white px-2.5 py-1.5 text-xs text-zinc-800 focus:outline-none dark:border-zinc-850 dark:bg-zinc-900 dark:text-zinc-100 resize-none"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={actionLoading === "create"}
                  className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {actionLoading === "create" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <span>Save</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsSavingMode(false)}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setIsSavingMode(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 py-2 text-xs font-semibold text-zinc-500 hover:border-zinc-450 hover:text-zinc-700 dark:border-zinc-800 dark:text-zinc-450 dark:hover:text-zinc-300 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Save Version Snapshot</span>
            </button>
          )}
        </div>
      )}

      {/* Version List Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {error && (
          <div className="flex items-center gap-1.5 rounded-lg bg-red-50 p-2.5 text-[11px] text-red-650 dark:bg-red-950/20 dark:text-red-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
            <span className="text-xs text-zinc-400">Loading history...</span>
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-zinc-400 dark:text-zinc-500 space-y-2">
            <History className="h-8 w-8 stroke-[1.5]" />
            <p className="text-xs font-medium">No saved versions</p>
            <p className="text-[10px] max-w-[160px]">Create snapshots of your work manually above.</p>
          </div>
        ) : (
          versions.map((version) => {
            const dateStr = new Date(version.createdAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
            const isDeleting = actionLoading === `delete-${version.id}`;

            return (
              <div
                key={version.id}
                className="group relative rounded-xl border border-zinc-150 p-3 hover:border-zinc-300 bg-zinc-50/50 hover:bg-zinc-50 dark:border-zinc-850 dark:bg-zinc-900/40 dark:hover:border-zinc-800 dark:hover:bg-zinc-900/80 transition-all space-y-2"
              >
                <div>
                  <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate pr-4">
                    {version.title}
                  </h4>
                  {version.description && (
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2">
                      {version.description}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1 text-[9px] text-zinc-400 dark:text-zinc-500 pt-0.5 border-t border-zinc-200/50 dark:border-zinc-850/50">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-2.5 w-2.5" />
                    <span>{dateStr}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <User className="h-2.5 w-2.5" />
                    <span className="truncate">
                      By {version.user?.name || "Unknown Collaborator"}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1.5 pt-1">
                  <button
                    onClick={() => onPreviewVersion(version.id)}
                    className="flex items-center gap-1 rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-[9px] font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    <Eye className="h-2.5 w-2.5" />
                    <span>Preview</span>
                  </button>

                  {isOwner && (
                    <button
                      onClick={() => onRestoreVersion(version.id, version.title)}
                      className="flex items-center gap-1 rounded-md bg-indigo-50 dark:bg-indigo-950/40 px-2 py-1 text-[9px] font-bold text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
                    >
                      <RotateCcw className="h-2.5 w-2.5" />
                      <span>Restore</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
export default VersionSidebar;

function uint8ArrayToBase64(arr: Uint8Array): string {
  let binary = "";
  const len = arr.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return window.btoa(binary);
}
