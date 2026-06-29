"use client";

import React, { createContext, useContext } from "react";
import { Editor } from "@tiptap/react";
import * as Y from "yjs";
import { SyncStatusType } from "../../sync/services/sync-engine";

export interface EditorContextProps {
  editor: Editor | null;
  yDoc: Y.Doc;
  syncStatus: SyncStatusType;
  pendingOpsCount: number;
  documentId: string;
}

const EditorContext = createContext<EditorContextProps | null>(null);

export const EditorProvider: React.FC<{
  value: EditorContextProps;
  children: React.ReactNode;
}> = ({ value, children }) => {
  return (
    <EditorContext.Provider value={value}>
      {children}
    </EditorContext.Provider>
  );
};

export const useEditorContext = () => {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error("useEditorContext must be used within an EditorProvider");
  }
  return context;
};
export default EditorProvider;
