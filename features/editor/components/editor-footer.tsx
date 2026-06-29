"use client";

import React from "react";
import { useEditorContext } from "./editor-provider";

export const EditorFooter: React.FC = () => {
  const { editor } = useEditorContext();

  if (!editor) return null;

  // Real-time text parsing fallbacks
  const textContent = editor.state.doc.textContent;
  const wordCount = textContent.split(/\s+/).filter(Boolean).length;
  const charCount = textContent.length;

  return (
    <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
      <div className="flex items-center gap-2">
        <span>{wordCount} {wordCount === 1 ? "word" : "words"}</span>
        <span className="text-zinc-300 dark:text-zinc-700">|</span>
        <span>{charCount} {charCount === 1 ? "character" : "characters"}</span>
      </div>
      <div className="hidden sm:block">
        <span>Rich-text Editor Canvas • Local-First Persistence</span>
      </div>
    </div>
  );
};
export default EditorFooter;
