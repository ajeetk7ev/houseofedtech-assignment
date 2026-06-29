"use client";

import React from "react";
import { EditorContent as TipTapEditorContent } from "@tiptap/react";
import { useEditorContext } from "./editor-provider";

export const EditorContent: React.FC = () => {
  const { editor } = useEditorContext();

  if (!editor) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-zinc-500 dark:text-zinc-400">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-500 border-t-transparent"></div>
          <p className="text-sm font-medium">Initializing editor canvas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50 p-4 dark:bg-zinc-900 sm:p-8">
      <div className="mx-auto max-w-4xl rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-12 min-h-[500px]">
        <TipTapEditorContent editor={editor} />
      </div>
    </div>
  );
};
export default EditorContent;
