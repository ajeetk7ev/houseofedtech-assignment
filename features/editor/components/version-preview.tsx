"use client";

import React, { useState, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import LinkExtension from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Collaboration from "@tiptap/extension-collaboration";
import * as Y from "yjs";
import { Eye, ArrowLeft, RotateCcw, Loader2, AlertCircle } from "lucide-react";

import { localDb } from "../../sync/services/local-db";

interface VersionDetail {
  id: string;
  documentId: string;
  title: string;
  description: string | null;
  createdAt: string;
  snapshot: string; // Base64
}

interface VersionPreviewProps {
  documentId: string;
  versionId: string;
  isOwner: boolean;
  onClose: () => void;
  onRestore: () => void;
}

export const VersionPreview: React.FC<VersionPreviewProps> = ({
  documentId,
  versionId,
  isOwner,
  onClose,
  onRestore,
}) => {
  const [versionDetail, setVersionDetail] = useState<VersionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const previewDocRef = useRef<Y.Doc | null>(null);
  const xmlFragmentRef = useRef<Y.XmlFragment | null>(null);

  // Fetch full version detail containing the snapshot
  useEffect(() => {
    const fetchVersion = async () => {
      const fallbackToLocal = async () => {
        try {
          const v = await localDb.versions.get(versionId);
          if (v) {
            setVersionDetail({
              id: v.id,
              documentId: v.documentId,
              title: v.title,
              description: v.description,
              createdAt: v.createdAt,
              snapshot: uint8ArrayToBase64(v.snapshot),
            });

            const ydoc = new Y.Doc();
            Y.applyUpdate(ydoc, v.snapshot);
            previewDocRef.current = ydoc;
            xmlFragmentRef.current = ydoc.getXmlFragment("default");
            setError(null);
          } else {
            setError("Local version snapshot not found in cache");
          }
        } catch (e) {
          setError("Error loading version from local cache");
        }
      };

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await fallbackToLocal();
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const res = await fetch(`/api/documents/${documentId}/versions/${versionId}`);
        const json = await res.json();
        if (json.success && json.data) {
          setVersionDetail(json.data);
          
          // Instantiate a temporary, clean Y.Doc for the preview
          const ydoc = new Y.Doc();
          const snapshotBytes = base64ToUint8Array(json.data.snapshot);
          Y.applyUpdate(ydoc, snapshotBytes);

          previewDocRef.current = ydoc;
          xmlFragmentRef.current = ydoc.getXmlFragment("default");
          setError(null);
          
          // Cache the full snapshot locally
          try {
            await localDb.versions.put({
              id: json.data.id,
              documentId: json.data.documentId,
              title: json.data.title,
              description: json.data.description || null,
              snapshot: snapshotBytes,
              createdBy: json.data.createdBy || "server",
              createdAt: json.data.createdAt,
            });
          } catch (cacheErr) {
            console.error("Failed to cache version details locally:", cacheErr);
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

    fetchVersion();

    return () => {
      if (previewDocRef.current) {
        previewDocRef.current.destroy();
      }
    };
  }, [documentId, versionId]);

  // Set up TipTap read-only editor instance bound to the temporary Yjs fragment
  const editor = useEditor(
    {
      immediatelyRender: true,
      editable: false,
      extensions: [
        StarterKit.configure({
          undoRedo: false,
          link: false,
        }),
        Table.configure({
          resizable: false,
        }),
        TableRow,
        TableHeader,
        TableCell,
        LinkExtension.configure({
          openOnClick: true,
        }),
        Image,
        // Bind to stable reference of the fragment
        Collaboration.configure({
          fragment: xmlFragmentRef.current || new Y.Doc().getXmlFragment("default"),
        }),
      ],
      editorProps: {
        attributes: {
          class: "prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none min-h-[400px] max-w-none dark:prose-invert text-zinc-900 dark:text-zinc-100",
        },
      },
    },
    [loading] // Rebuild the editor hook when the yDoc loads in the background
  );

  if (loading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <h2 className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">Loading version preview...</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Restoring document state snapshot from database</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-4">
        <div className="flex max-w-sm flex-col items-center text-center gap-3 bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm dark:bg-zinc-900 dark:border-zinc-800">
          <AlertCircle className="h-10 w-10 text-rose-500" />
          <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">Unable to Load Preview</h2>
          <p className="text-sm text-zinc-550 dark:text-zinc-400">{error}</p>
          <button
            onClick={onClose}
            className="mt-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
          >
            Back to Editor
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col bg-zinc-50 dark:bg-zinc-950 z-20">
      {/* Preview Header bar */}
      <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
            title="Back to Editor"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-1.5">
              <span className="flex items-center gap-1 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-[10px] px-1.5 py-0.5 font-bold uppercase tracking-wider">
                <Eye className="h-3 w-3" />
                <span>Preview Mode</span>
              </span>
              <span className="truncate">{versionDetail?.title}</span>
            </h3>
            {versionDetail?.description && (
              <p className="hidden sm:block text-[10px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                {versionDetail.description}
              </p>
            )}
          </div>
        </div>

        {isOwner && (
          <div className="flex items-center gap-2">
            <button
              onClick={onRestore}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-xs"
              title="Restore this historical version"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Restore Version</span>
            </button>
          </div>
        )}
      </header>

      {/* Editor Content Area */}
      <div className="flex-1 overflow-y-auto bg-zinc-50 p-4 dark:bg-zinc-900 sm:p-8">
        <div className="mx-auto max-w-4xl rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-12 min-h-[500px]">
          {editor && <EditorContent editor={editor} />}
        </div>
      </div>
    </div>
  );
};
export default VersionPreview;

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
