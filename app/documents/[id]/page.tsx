"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import EditorShell from "@/features/editor/components/editor-shell";

export default function DocumentPage() {
  const params = useParams();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-500 border-t-transparent dark:border-zinc-400"></div>
      </div>
    );
  }

  const id = typeof params?.id === "string" ? params.id : "";
  return <EditorShell documentId={id} />;
}
