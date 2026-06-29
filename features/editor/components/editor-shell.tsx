"use client";

import React, { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { ArrowLeft, Save, Share2, AlertCircle, Loader2, History as HistoryIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import * as Y from "yjs";
import { useCollaborativeEditor } from "../hooks/use-editor";
import { EditorProvider } from "./editor-provider";
import { EditorToolbar } from "./editor-toolbar";
import { EditorContent } from "./editor-content";
import { EditorFooter } from "./editor-footer";
import { EditorStatus } from "./editor-status";
import { localDb } from "../../sync/services/local-db";
import { syncEngine } from "../../sync/services/sync-engine";
import { AwarenessProvider } from "../../collaboration/providers/awareness-provider";
import { PresenceProvider } from "../../collaboration/providers/presence-provider";
import PresenceAvatars from "../../collaboration/components/presence-avatars";
import ShareModal from "../../collaboration/components/share-modal";
import VersionSidebar from "./version-sidebar";
import VersionPreview from "./version-preview";

export interface EditorShellProps {
  documentId: string;
  onBack?: () => void;
}

export const EditorShell: React.FC<EditorShellProps> = ({ documentId, onBack }) => {
  const { editor, yDoc, syncStatus, pendingOpsCount, isLoading, loadError, awareness, role } = useCollaborativeEditor(documentId);
  const [title, setTitle] = useState<string>("Untitled Document");
  
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isAcceptingInvite, setIsAcceptingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  
  // Versioning & Snapshot States
  const [isVersionSidebarOpen, setIsVersionSidebarOpen] = useState(false);
  const [previewVersionId, setPreviewVersionId] = useState<string | null>(null);

  // Derive role convenience flags from the hook
  const currentUserRole = role as "OWNER" | "EDITOR" | "VIEWER";

  // Reactively query local document from IndexedDB
  const localDoc = useLiveQuery(() => localDb.documents.get(documentId), [documentId]);

  // Synchronize state title when local DB record changes (e.g. on load or server sync)
  useEffect(() => {
    if (localDoc) {
      setTitle(localDoc.title);
    }
  }, [localDoc?.title]);

  // Issue 12: Role is now sourced from useCollaborativeEditor hook — no duplicate fetch needed.

  const handleRestoreVersion = async (versionId: string) => {
    try {
      setIsAcceptingInvite(true); // Reuse loading screen
      const res = await fetch(`/api/documents/${documentId}/versions/${versionId}/restore`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success && json.data?.snapshot) {
        // Issue 6: Browser-safe base64 decoding
        const snapshotBytes = base64ToUint8Array(json.data.snapshot);
        
        // Wrap the update in a Yjs transaction to cleanly clear current and apply snapshot state
        yDoc?.transact(() => {
          const fragment = yDoc.getXmlFragment("default");
          if (fragment.length > 0) {
            fragment.delete(0, fragment.length);
          }
          Y.applyUpdate(yDoc, snapshotBytes);
        });

        // Issue 7: Persist restored state to IndexedDB and trigger sync/broadcast
        if (yDoc) {
          const currentSnapshot = Y.encodeStateAsUpdate(yDoc);
          await localDb.documents.update(documentId, {
            latestSnapshot: currentSnapshot,
            updatedAt: new Date().toISOString(),
          });
          syncEngine.syncDocument(documentId, yDoc);
        }
        
        setPreviewVersionId(null);
      } else {
        alert(json.error?.message || "Failed to restore version");
      }
    } catch (err) {
      alert("Error restoring version");
    } finally {
      setIsAcceptingInvite(false);
    }
  };

  // Handle invitation link parameters
  useEffect(() => {
    const inviteToken = searchParams?.get("invite");
    if (!inviteToken) return;

    const acceptInvite = async () => {
      try {
        setIsAcceptingInvite(true);
        setInviteError(null);
        
        const res = await fetch(`/api/documents/${documentId}/accept-invite`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: inviteToken }),
        });
        
        const json = await res.json();
        if (json.success) {
          // Remove invite parameter from the browser URL address bar
          const newUrl = window.location.pathname;
          window.history.replaceState({}, "", newUrl);
        } else {
          setInviteError(json.error?.message || "Failed to accept invite");
        }
      } catch (err) {
        setInviteError("Network error accepting collaboration invite");
      } finally {
        setIsAcceptingInvite(false);
      }
    };

    acceptInvite();
  }, [documentId, searchParams]);

  const handleTitleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);

    // Debounced or direct local IndexedDB save (direct is fine for titles)
    try {
      await localDb.documents.update(documentId, {
        title: newTitle,
        updatedAt: new Date().toISOString(),
      });
      
      // Enforce sync call to push title to backend
      syncEngine.syncDocument(documentId, yDoc || undefined);
    } catch (err) {
      console.error("Failed to save title locally:", err);
    }
  };

  const forceSync = () => {
    if (yDoc) {
      syncEngine.syncDocument(documentId, yDoc);
    }
  };

  if (isAcceptingInvite) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <h2 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">Joining Document Room...</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Verifying authorization invite credentials</p>
        </div>
      </div>
    );
  }

  if (inviteError) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
        <div className="flex max-w-sm flex-col items-center text-center gap-3 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
          <AlertCircle className="h-10 w-10 text-rose-500" />
          <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">Unable to Join Collaboration</h2>
          <p className="text-sm text-zinc-550 dark:text-zinc-400">{inviteError}</p>
          <Link
            href="/dashboard"
            className="mt-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
        <div className="flex max-w-sm flex-col items-center text-center gap-3 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
          <AlertCircle className="h-10 w-10 text-rose-500" />
          <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">Access Denied</h2>
          <p className="text-sm text-zinc-550 dark:text-zinc-400">{loadError}</p>
          <Link
            href="/dashboard"
            className="mt-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-500 border-t-transparent dark:border-zinc-400"></div>
          <h2 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">Retrieving document...</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Primary database source is IndexedDB cache</p>
        </div>
      </div>
    );
  }

  return (
    <PresenceProvider awareness={awareness}>
      <AwarenessProvider awareness={awareness}>
        <EditorProvider
      value={{
        editor,
        yDoc: yDoc!,
        syncStatus,
        pendingOpsCount,
        documentId,
      }}
    >
      {previewVersionId ? (
        <VersionPreview
          documentId={documentId}
          versionId={previewVersionId}
          isOwner={currentUserRole === "OWNER"}
          onClose={() => setPreviewVersionId(null)}
          onRestore={() => {
            if (window.confirm("Are you sure you want to restore this version? This will sync to all connected collaborators.")) {
              handleRestoreVersion(previewVersionId);
            }
          }}
        />
      ) : (
        <div className="flex h-screen w-full flex-col bg-zinc-50 dark:bg-zinc-950">
          {/* Header bar */}
          <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/dashboard"
                onClick={(e) => {
                  if (onBack) {
                    e.preventDefault();
                    onBack();
                  }
                }}
                className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                title="Return to Dashboard"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              
              <input
                type="text"
                value={title}
                onChange={handleTitleChange}
                className="truncate border-0 bg-transparent text-sm font-semibold text-zinc-800 focus:outline-none focus:ring-0 dark:text-zinc-100 w-48 sm:w-64"
                placeholder="Untitled Document"
                title="Click to rename"
              />
            </div>

            <div className="flex items-center gap-4">
              <PresenceAvatars />
              
              <button
                onClick={() => setIsShareOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-xs"
                title="Share document and manage collaborators"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>Share</span>
              </button>

              <button
                onClick={() => setIsVersionSidebarOpen(!isVersionSidebarOpen)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  isVersionSidebarOpen
                    ? "bg-zinc-100 border-zinc-300 text-zinc-800 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
                    : "bg-white border-zinc-250 text-zinc-700 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
                title="Open document version history"
              >
                <HistoryIcon className="h-3.5 w-3.5" />
                <span>History</span>
              </button>

              {pendingOpsCount > 0 && (
                <button
                  onClick={forceSync}
                  className="flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  title="Force Synchronization now"
                >
                  <Save className="h-3 w-3" />
                  <span>Force Sync</span>
                </button>
              )}
              <EditorStatus />
            </div>
          </header>

          {/* Toolbar */}
          <EditorToolbar />

          {/* Core Content Area & Sidebar flex layout */}
          <div className="flex flex-1 overflow-hidden">
            <EditorContent />
            {isVersionSidebarOpen && (
              <VersionSidebar
                documentId={documentId}
                currentUserRole={currentUserRole}
                yDoc={yDoc!}
                onPreviewVersion={(vId) => setPreviewVersionId(vId)}
                onRestoreVersion={(vId, vTitle) => {
                  if (window.confirm(`Are you sure you want to restore the document to "${vTitle}"?`)) {
                    handleRestoreVersion(vId);
                  }
                }}
                onClose={() => setIsVersionSidebarOpen(false)}
              />
            )}
          </div>

          {/* Status Footer */}
          <EditorFooter />
        </div>
      )}

      {isShareOpen && (
        <ShareModal documentId={documentId} onClose={() => setIsShareOpen(false)} />
      )}
    </EditorProvider>
      </AwarenessProvider>
    </PresenceProvider>
  );
};
export default EditorShell;

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
