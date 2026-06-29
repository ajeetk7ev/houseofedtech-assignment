"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Collaboration from "@tiptap/extension-collaboration";
import { useSession } from "next-auth/react";
import * as Y from "yjs";
import { localDb } from "../../sync/services/local-db";
import { operationQueue } from "../../sync/services/operation-queue";
import { syncEngine, SyncStatusType } from "../../sync/services/sync-engine";
import { useCollaboration } from "../../collaboration/hooks/use-collaboration";
import { useConnection } from "../../collaboration/hooks/use-connection";

export interface UseEditorResult {
  editor: Editor | null;
  yDoc: Y.Doc;
  syncStatus: SyncStatusType;
  pendingOpsCount: number;
  isLoading: boolean;
  loadError: string | null;
  awareness: any;
  role: string;
}

/**
 * Fast non-cryptographic FNV-1a hash function to compute payloads checksums synchronously.
 */
function computeFnv1aChecksum(bytes: Uint8Array): string {
  let hash = 2166136261;
  const len = bytes.length;
  for (let i = 0; i < len; i++) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function useCollaborativeEditor(documentId: string): UseEditorResult {
  const { data: session } = useSession();
  const [yDoc] = useState<Y.Doc>(() => new Y.Doc());
  const [localSyncStatus, setLocalSyncStatus] = useState<SyncStatusType>("offline");
  const [pendingOpsCount, setPendingOpsCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [role, setRole] = useState<string>("VIEWER"); // Default to VIEWER for safety
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fetch collaborator details to extract active user's access role
  useEffect(() => {
    const fetchUserRole = async () => {
      const fallbackToLocal = async () => {
        try {
          const doc = await localDb.documents.get(documentId);
          if (doc) {
            if (doc.createdBy === "me" || doc.createdBy === session?.user?.id) {
              setRole("OWNER");
            } else {
              setRole("EDITOR");
            }
          }
        } catch (e) {
          console.error("Local fallback resolution failed:", e);
        }
      };

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await fallbackToLocal();
        return;
      }

      try {
        const res = await fetch(`/api/documents/${documentId}/collaborators`);
        const json = await res.json();
        if (json.success && json.data) {
          const members = json.data;
          const currentMember = members.find((m: any) => m.userId === session?.user?.id);
          if (currentMember) {
            setRole(currentMember.role);
          }
        } else {
          await fallbackToLocal();
        }
      } catch (err) {
        console.warn("Failed to fetch user role from server, falling back to local Dexie cache:", err);
        await fallbackToLocal();
      }
    };

    if (session?.user?.id) {
      fetchUserRole();
    }
  }, [documentId, session?.user?.id]);

  // Create the XmlFragment once and keep it stable — passing `fragment:` directly
  // prevents the Collaboration extension from calling yDoc.getXmlFragment() during
  // a re-init cycle when the editor is briefly recreated.
  const xmlFragmentRef = useRef<Y.XmlFragment | null>(null);
  if (!xmlFragmentRef.current) {
    xmlFragmentRef.current = yDoc.getXmlFragment("default");
  }

  const { provider, userColor } = useCollaboration(documentId, yDoc);
  const { connectionState } = useConnection(provider);

  // Keep a ref to the latest provider so the editor effect can read it
  // without needing to be in the dependency array.
  const providerRef = useRef(provider);
  providerRef.current = provider;

  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const isLoadedRef = useRef<boolean>(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Derived sync status prioritizing live WebSocket states over REST polling
  const computedSyncStatus: SyncStatusType = (() => {
    if (connectionState === "connected") {
      return pendingOpsCount > 0 ? "syncing" : "synced";
    }
    if (connectionState === "connecting" || connectionState === "reconnecting") {
      return connectionState === "connecting" ? "syncing" : "reconnecting";
    }
    if (connectionState === "offline") {
      return "offline";
    }
    return localSyncStatus;
  })();

  // Clean up references on unmount
  useEffect(() => {
    return () => {
      yDoc.destroy();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [yDoc]);

  // Load state from Dexie with initial server validation
  useEffect(() => {
    let active = true;

    async function loadInitialDocument() {
      try {
        // If online, verify document access permissions with server first
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          const res = await fetch(`/api/documents/${documentId}`);
          if (res.status === 401 || res.status === 403) {
            if (active) {
              setLoadError("Access denied: You are not a collaborator on this document");
              setIsLoading(false);
            }
            return;
          }
          if (res.status === 404) {
            if (active) {
              setLoadError("Document not found");
              setIsLoading(false);
            }
            return;
          }
        }

        const docRecord = await localDb.documents.get(documentId);
        if (docRecord && docRecord.latestSnapshot && active) {
          // Apply stored binary update snapshot to the fresh Yjs doc instance
          Y.applyUpdate(yDoc, docRecord.latestSnapshot);
        }
      } catch (err) {
        console.error("Failed to load local document snapshot:", err);
      } finally {
        if (active) {
          setIsLoading(false);
          isLoadedRef.current = true;
        }
      }
    }

    loadInitialDocument();

    return () => {
      active = false;
    };
  }, [documentId, yDoc]);

  // Bind background sync status and count updates
  useEffect(() => {
    if (isLoading || loadError) return;
    syncEngine.syncDocument(documentId, yDoc);
  }, [documentId, yDoc, isLoading, loadError]);

  // Bind background sync status and count updates
  useEffect(() => {
    const unsubscribe = syncEngine.subscribe(documentId, (_, status, count) => {
      setLocalSyncStatus(status);
      setPendingOpsCount(count);
    });

    return unsubscribe;
  }, [documentId]);

  // Set up Yjs observer, BroadcastChannel and sync flush loops
  useEffect(() => {
    if (!yDoc || !isLoadedRef.current) return;

    // Create BroadcastChannel for multi-tab sync
    const channelName = `document-sync-${documentId}`;
    const channel = new BroadcastChannel(channelName);
    broadcastChannelRef.current = channel;

    // Listen to sister tabs updates
    const handleBroadcastMessage = (event: MessageEvent) => {
      if (event.data && typeof event.data.update === "string") {
        const updateBytes = base64ToUint8Array(event.data.update);
        // Apply transaction tagged to avoid infinite loop rebroadcasting
        Y.transact(
          yDoc,
          () => {
            Y.applyUpdate(yDoc, updateBytes);
          },
          "broadcast-channel"
        );
      }
    };
    channel.addEventListener("message", handleBroadcastMessage);

    // Watch Yjs local changes
    const handleDocUpdate = async (update: Uint8Array, origin: unknown) => {
      // Avoid loops: ignore server sync loads or tab broadcast applications
      if (origin === "server-sync" || origin === "broadcast-channel") {
        return;
      }

      // Safeguard: viewers are read-only and should not emit operations or update awareness fields
      if (role === "VIEWER") {
        return;
      }

      // Broadcast typing indicator status via Yjs awareness
      if (provider?.provider?.awareness) {
        try {
          provider.provider.awareness.setLocalStateField("isTyping", true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => {
            if (provider?.provider?.awareness) {
              provider.provider.awareness.setLocalStateField("isTyping", false);
            }
          }, 1500);
        } catch (e) {
          console.error("Error setting typing status:", e);
        }
      }

      try {
        // Broadcast immediately to active sister browser tabs
        const base64Update = uint8ArrayToBase64(update);
        channel.postMessage({ update: base64Update });

        // Save local update snapshot to Dexie documents cache
        const currentSnapshot = Y.encodeStateAsUpdate(yDoc);
        await localDb.documents.update(documentId, {
          latestSnapshot: currentSnapshot,
          updatedAt: new Date().toISOString(),
        });

        // Compute payload checksum hash
        const checksum = computeFnv1aChecksum(update);

        // Queue operation record
        const clientId = yDoc.clientID.toString();
        const baseVersion = 0; // Incremented at synchronization boundary
        
        await operationQueue.addOperation(
          documentId,
          clientId,
          baseVersion,
          update,
          checksum
        );

        // Notify engine listeners of new queue item count
        setPendingOpsCount((prev) => prev + 1);

        // Trigger background sync task asynchronously
        syncEngine.syncDocument(documentId, yDoc);
      } catch (err) {
        console.error("Error saving document operational change:", err);
      }
    };
    yDoc.on("update", handleDocUpdate);

    return () => {
      yDoc.off("update", handleDocUpdate);
      channel.removeEventListener("message", handleBroadcastMessage);
      channel.close();
    };
  }, [yDoc, documentId, isLoading, role]);

  // Set up TipTap editor instance bound to the stable Yjs XmlFragment.
  // NOTE: CollaborationCursor (@tiptap/extension-collaboration-cursor v2) is removed —
  // it uses y-prosemirror's ySyncPluginKey but the Collaboration v3 extension uses
  // @tiptap/y-tiptap's fork, which has a different key. Mixing them causes the
  // 'Cannot read properties of undefined (reading doc)' crash.
  // Remote cursor presence is handled instead via our AwarenessProvider + CSS.
  const editor = useEditor(
    {
      // Only render on the client — avoids hydration mismatch in Next.js App Router
      immediatelyRender: true,
      extensions: [
        StarterKit.configure({
          // Disable built-in undo/redo — Collaboration extension provides Yjs-based undo/redo
          undoRedo: false,
          // StarterKit v3 bundles Link; we override it below with custom options
          link: false,
        }),
        Table.configure({
          resizable: true,
        }),
        TableRow,
        TableHeader,
        TableCell,
        Link.configure({
          openOnClick: false,
        }),
        Image,
        // Pass the stable XmlFragment directly — prevents re-calling yDoc.getXmlFragment()
        // on every render or WebSocket reconnect cycle.
        Collaboration.configure({
          fragment: xmlFragmentRef.current!,
        }),
      ],
      editorProps: {
        attributes: {
          class: "prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none min-h-[400px] max-w-none dark:prose-invert text-zinc-900 dark:text-zinc-100",
        },
      },
    },
    // Exclude provider from deps — editor must NOT rebuild on WebSocket connect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [yDoc, session?.user?.name]
  );

  // Toggle editor editability dynamically based on the user's role on this document
  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.setEditable(role !== "VIEWER");
    }
  }, [editor, role]);

  return {
    editor,
    yDoc,
    syncStatus: computedSyncStatus,
    pendingOpsCount,
    isLoading,
    loadError,
    awareness: provider?.provider?.awareness || null,
    role,
  };
}

// Convert helpers
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(arr: Uint8Array): string {
  let binary = "";
  const len = arr.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(arr[i]);
  }
  return window.btoa(binary);
}
