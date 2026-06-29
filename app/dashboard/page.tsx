"use client";

import React, { useState, useEffect, useCallback } from "react";
import { signOut, useSession } from "next-auth/react";
import { useLiveQuery } from "dexie-react-hooks";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  FileText,
  LogOut,
  Trash2,
  Wifi,
  WifiOff,
  RefreshCw,
  FolderOpen,
} from "lucide-react";
import { localDb, LocalDocument } from "../../features/sync/services/local-db";
import { useOnlineStatus } from "../../features/sync/services/network-manager";
import EditorShell from "@/features/editor/components/editor-shell";
import Logo from "@/components/Logo";

export default function DashboardPage() {
  const isOnline = useOnlineStatus();
  const router = useRouter();
  const { data: session } = useSession();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  
  // Track document IDs explicitly authorized/returned by the server
  const [authorizedDocIds, setAuthorizedDocIds] = useState<Set<string>>(new Set());

  // Load persisted authorized document IDs on mount/session change
  useEffect(() => {
    const loadAuthorizedIds = async () => {
      if (session?.user?.id) {
        try {
          const record = await localDb.settings.get(`authorized_docs_${session.user.id}`);
          if (record && Array.isArray(record.value)) {
            setAuthorizedDocIds(new Set(record.value));
          }
        } catch (err) {
          console.error("Failed to load offline authorized doc IDs:", err);
        }
      }
    };
    loadAuthorizedIds();
  }, [session?.user?.id]);

  // Listen to popstate to react to browser back/forward routing
  useEffect(() => {
    const handlePopState = () => {
      const match = window.location.pathname.match(/\/documents\/([^/]+)/);
      if (match) {
        setActiveDocumentId(match[1]);
      } else {
        setActiveDocumentId(null);
      }
    };

    // Evaluate current path on mount
    handlePopState();

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Reactive Dexie query for local documents
  const documents = useLiveQuery(
    async () => {
      const currentUserId = session?.user?.id;
      if (!currentUserId) return [];

      let list = await localDb.documents.toArray();
      
      // Filter: only show if created by me, created offline ("me"), or explicitly authorized by server
      list = list.filter((doc) => 
        doc.createdBy === currentUserId || 
        doc.createdBy === "me" || 
        authorizedDocIds.has(doc.id)
      );

      // Apply search query
      if (searchQuery.trim()) {
        const queryText = searchQuery.toLowerCase();
        list = list.filter((doc) => doc.title.toLowerCase().includes(queryText));
      }

      // Sort by updatedAt descending
      return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    },
    [searchQuery, authorizedDocIds, session?.user?.id]
  );

  // Background fetch server documents when online
  const refreshDocumentsFromServer = useCallback(async () => {
    if (!isOnline || !session?.user?.id) return;
    setIsRefreshing(true);

    try {
      const response = await fetch("/api/documents");
      if (response.ok) {
        const json = await response.json();
        if (json.success && json.data?.items) {
          const serverDocs = json.data.items;
          const ids = new Set<string>(serverDocs.map((d: any) => d.id));
          setAuthorizedDocIds(ids);

          // Persist the authorized document IDs for this user to local DB settings
          await localDb.settings.put({
            key: `authorized_docs_${session.user.id}`,
            value: Array.from(ids),
          });

          const serverDocsTyped = serverDocs as Array<{
            id: string;
            title: string;
            latestSnapshot: string | null;
            lastOperationNumber: number;
            createdBy: string;
            isArchived: boolean;
            createdAt: string;
            updatedAt: string;
          }>;

          await localDb.transaction("rw", [localDb.documents, localDb.operations, localDb.sync_state], async () => {
            // Upsert server documents
            for (const sDoc of serverDocsTyped) {
              const localDoc = await localDb.documents.get(sDoc.id);
              
              if (!localDoc) {
                // Add new document
                await localDb.documents.add({
                  id: sDoc.id,
                  title: sDoc.title,
                  syncedTitle: sDoc.title,
                  latestSnapshot: sDoc.latestSnapshot ? base64ToUint8Array(sDoc.latestSnapshot) : null,
                  lastOperationNumber: sDoc.lastOperationNumber,
                  createdBy: sDoc.createdBy,
                  isArchived: sDoc.isArchived,
                  syncedIsArchived: sDoc.isArchived,
                  createdAt: sDoc.createdAt,
                  updatedAt: sDoc.updatedAt,
                });
              } else {
                // Update title and archive status if server version is newer
                const localUpdated = new Date(localDoc.updatedAt).getTime();
                const serverUpdated = new Date(sDoc.updatedAt).getTime();

                if (serverUpdated > localUpdated) {
                  await localDb.documents.update(sDoc.id, {
                    title: sDoc.title,
                    syncedTitle: sDoc.title,
                    isArchived: sDoc.isArchived,
                    syncedIsArchived: sDoc.isArchived,
                    updatedAt: sDoc.updatedAt,
                  });
                }
              }
            }

            // Issue 15: Remove local documents whose access was revoked
            // (not in server set and not pending offline creation)
            const allLocalDocs = await localDb.documents.toArray();
            for (const localDoc of allLocalDocs) {
              if (
                !ids.has(localDoc.id) &&
                localDoc.createdBy !== "me" // Don't remove offline-created docs pending sync
              ) {
                await localDb.documents.delete(localDoc.id);
                await localDb.operations.where("documentId").equals(localDoc.id).delete();
                await localDb.sync_state.where("documentId").equals(localDoc.id).delete();
              }
            }
          });
        }
      }
    } catch (err) {
      console.error("Failed to sync documents list from server:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, [isOnline, session?.user?.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshDocumentsFromServer();
    }, 0);
    return () => clearTimeout(timer);
  }, [refreshDocumentsFromServer]);

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsCreating(true);
    const docId = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).substring(2, 15);

    try {
      const trimmedTitle = newTitle.trim();
      const timestamp = new Date().toISOString();
      const localDoc: LocalDocument = {
        id: docId,
        title: trimmedTitle,
        latestSnapshot: null,
        lastOperationNumber: 0,
        createdBy: "me", // Will be mapped dynamically on sync
        isArchived: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      // 1. Add to local database instantly
      await localDb.documents.add(localDoc);

      // 2. Redirect immediately — never block UI waiting for server
      setShowCreateModal(false);
      setNewTitle("");
      window.history.pushState(null, "", `/documents/${docId}`);
      setActiveDocumentId(docId);

      // 3. Fire server create in background (fire-and-forget)
      if (isOnline) {
        fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: docId, title: trimmedTitle }),
        })
          .then(async (response) => {
            if (response.ok) {
              const json = await response.json();
              if (json.success && json.data) {
                const serverDoc = json.data;
                await localDb.documents.update(docId, {
                  createdBy: serverDoc.createdBy,
                  createdAt: serverDoc.createdAt,
                  updatedAt: serverDoc.updatedAt,
                  syncedTitle: serverDoc.title,
                  syncedIsArchived: serverDoc.isArchived,
                });
              }
            }
          })
          .catch((err) => {
            console.warn("Background server create failed, will sync later:", err);
          });
      }
    } catch (err) {
      console.error("Failed to create document:", err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteDocument = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!window.confirm("Are you sure you want to delete this document locally and on the server?")) {
      return;
    }

    try {
      // 1. Delete locally from Dexie cache
      await localDb.documents.delete(id);
      await localDb.operations.where("documentId").equals(id).delete();
      await localDb.sync_state.where("documentId").equals(id).delete();

      // 2. Call delete API if online, otherwise queue for offline sync
      if (isOnline) {
        await fetch(`/api/documents/${id}`, {
          method: "DELETE",
        });
      } else {
        const deletedDocs = (await localDb.settings.get("pending-deletions"))?.value as string[] || [];
        deletedDocs.push(id);
        await localDb.settings.put({ key: "pending-deletions", value: deletedDocs });
      }
    } catch (err) {
      console.error("Failed to delete document:", err);
    }
  };

  const handleLogout = () => {
    signOut({ callbackUrl: "/login" });
  };

  if (activeDocumentId) {
    return (
      <EditorShell
        documentId={activeDocumentId}
        onBack={() => {
          window.history.pushState(null, "", "/dashboard");
          setActiveDocumentId(null);
        }}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 px-4 py-8 text-zinc-100 antialiased sm:px-6 lg:px-8 selection:bg-zinc-800 selection:text-white">
      {/* Glow shapes */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-black pointer-events-none" />

      <div className="relative mx-auto w-full max-w-5xl flex-1 space-y-8">
        {/* Header section */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-900 pb-6">
          <div className="flex items-center gap-3">
            <Logo className="h-8 w-8" iconOnly />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">EdTech Canvas</h1>
              <p className="text-xs text-zinc-400">Distributed Collaborative Editor</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Online Badge */}
            <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
              isOnline 
                ? "text-emerald-400 bg-emerald-950/20 border-emerald-900/50" 
                : "text-amber-400 bg-amber-950/20 border-amber-900/50"
            }`}>
              {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              <span>{isOnline ? "Online" : "Offline Mode"}</span>
            </div>

            {/* Refresh Button */}
            {isOnline && (
              <button
                onClick={refreshDocumentsFromServer}
                disabled={isRefreshing}
                className="rounded-lg p-2 text-zinc-400 border border-zinc-800 hover:bg-zinc-900 disabled:opacity-40 transition-colors"
                title="Fetch updates from server"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </button>
            )}

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/30 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-900 hover:text-white transition-colors"
            >
              <LogOut className="h-4.5 w-4.5" />
              <span>Log out</span>
            </button>
          </div>
        </header>

        {/* Action bar */}
        <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute top-2.5 left-3 h-4.5 w-4.5 text-zinc-600" />
            <input
              type="text"
              placeholder="Search offline documents cache..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900/40 pl-10 pr-4 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-700"
            />
          </div>

          {/* New Document CTA */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200"
          >
            <Plus className="h-4.5 w-4.5" />
            <span>New Document</span>
          </button>
        </section>

        {/* Documents Grid */}
        <main className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-500">My Workspace</h2>
          
          {documents === undefined ? (
            <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-zinc-800">
              <div className="flex flex-col items-center gap-2 text-zinc-600">
                <RefreshCw className="h-6 w-6 animate-spin" />
                <p className="text-sm">Reading local database store...</p>
              </div>
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-850 p-12 text-center bg-zinc-900/10">
              <FolderOpen className="h-10 w-10 text-zinc-800 mb-4" />
              <h3 className="text-md font-semibold text-zinc-300">No documents found</h3>
              <p className="text-xs text-zinc-600 mt-1 max-w-xs">
                {searchQuery ? "No matches found in IndexedDB." : "Create your first document to edit in offline-first mode."}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {documents.map((doc: LocalDocument) => (
                <Link
                  key={doc.id}
                  href={`/documents/${doc.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    window.history.pushState(null, "", `/documents/${doc.id}`);
                    setActiveDocumentId(doc.id);
                  }}
                  className="group relative flex flex-col justify-between rounded-xl border border-zinc-900 bg-zinc-900/20 p-5 shadow-xs transition-all hover:border-zinc-800 hover:bg-zinc-900/40"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <FileText className="h-5 w-5 shrink-0 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                      <button
                        onClick={(e) => handleDeleteDocument(doc.id, e)}
                        className="rounded p-1 text-zinc-700 hover:bg-zinc-900 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete document"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <h3 className="truncate font-semibold text-zinc-200 group-hover:text-white transition-colors">
                      {doc.title}
                    </h3>
                  </div>

                  <div className="mt-8 flex items-center justify-between text-[10px] text-zinc-600">
                    <span>
                      Updated {new Date(doc.updatedAt).toLocaleDateString()}
                    </span>
                    {doc.isArchived && (
                      <span className="rounded bg-zinc-900 px-1.5 py-0.5 border border-zinc-850 text-zinc-500 font-bold uppercase">
                        Archived
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Title creation modal overlay */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Create new document</h3>
            
            <form onSubmit={handleCreateDocument} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400">Document Title</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Q3 Roadmap Planning"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-650 focus:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-700"
                />
              </div>

              <div className="flex items-center justify-end gap-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewTitle("");
                  }}
                  className="rounded-lg border border-zinc-800 bg-transparent px-3 py-2 text-zinc-400 hover:bg-zinc-950"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newTitle.trim()}
                  className="rounded-lg bg-white px-4 py-2 text-zinc-950 hover:bg-zinc-200 disabled:bg-zinc-600"
                >
                  {isCreating ? "Creating..." : "Create Document"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof window !== "undefined" && window.atob) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }
  return new Uint8Array(Buffer.from(base64, "base64"));
}
