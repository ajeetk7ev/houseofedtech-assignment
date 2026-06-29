"use client";

import React from "react";
import { useEditorContext } from "./editor-provider";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Terminal,
  Link as LinkIcon,
  Image as ImageIcon,
  Undo,
  Redo,
  Table as TableIcon,
  PlusCircle,
  Trash2,
  Minus,
} from "lucide-react";

export const EditorToolbar: React.FC = () => {
  const { editor } = useEditorContext();

  if (!editor) return null;

  const addLink = () => {
    const url = window.prompt("Enter link URL:");
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const addImage = () => {
    const url = window.prompt("Enter image URL:");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950 sm:p-3">
      {/* History */}
      <button
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        className="rounded p-1.5 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800"
        title="Undo (Ctrl+Z)"
      >
        <Undo className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        className="rounded p-1.5 text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800"
        title="Redo"
      >
        <Redo className="h-4 w-4" />
      </button>

      <div className="h-5 w-[1px] bg-zinc-200 dark:bg-zinc-800 mx-1" />

      {/* Typography Headers */}
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={`rounded p-1.5 ${
          editor.isActive("heading", { level: 1 })
            ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        }`}
        title="Heading 1"
      >
        <Heading1 className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`rounded p-1.5 ${
          editor.isActive("heading", { level: 2 })
            ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        }`}
        title="Heading 2"
      >
        <Heading2 className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={`rounded p-1.5 ${
          editor.isActive("heading", { level: 3 })
            ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        }`}
        title="Heading 3"
      >
        <Heading3 className="h-4 w-4" />
      </button>

      <div className="h-5 w-[1px] bg-zinc-200 dark:bg-zinc-800 mx-1" />

      {/* Inline styles */}
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={`rounded p-1.5 ${
          editor.isActive("bold")
            ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        }`}
        title="Bold (Ctrl+B)"
      >
        <Bold className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={`rounded p-1.5 ${
          editor.isActive("italic")
            ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        }`}
        title="Italic (Ctrl+I)"
      >
        <Italic className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={`rounded p-1.5 ${
          editor.isActive("underline")
            ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        }`}
        title="Underline (Ctrl+U)"
      >
        <UnderlineIcon className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={`rounded p-1.5 ${
          editor.isActive("strike")
            ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        }`}
        title="Strikethrough"
      >
        <Strikethrough className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleCode().run()}
        className={`rounded p-1.5 ${
          editor.isActive("code")
            ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        }`}
        title="Code code inline"
      >
        <Code className="h-4 w-4" />
      </button>

      <div className="h-5 w-[1px] bg-zinc-200 dark:bg-zinc-800 mx-1" />

      {/* Paragraph Elements */}
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`rounded p-1.5 ${
          editor.isActive("bulletList")
            ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        }`}
        title="Bullet List"
      >
        <List className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`rounded p-1.5 ${
          editor.isActive("orderedList")
            ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        }`}
        title="Ordered List"
      >
        <ListOrdered className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={`rounded p-1.5 ${
          editor.isActive("blockquote")
            ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        }`}
        title="Blockquote"
      >
        <Quote className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={`rounded p-1.5 ${
          editor.isActive("codeBlock")
            ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        }`}
        title="Code Block"
      >
        <Terminal className="h-4 w-4" />
      </button>

      <div className="h-5 w-[1px] bg-zinc-200 dark:bg-zinc-800 mx-1" />

      {/* Hyperlinks, Images, and HR */}
      <button
        onClick={addLink}
        className={`rounded p-1.5 ${
          editor.isActive("link")
            ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        }`}
        title="Insert Link"
      >
        <LinkIcon className="h-4 w-4" />
      </button>
      <button
        onClick={addImage}
        className="rounded p-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        title="Insert Image"
      >
        <ImageIcon className="h-4 w-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        className="rounded p-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        title="Horizontal Rule"
      >
        <Minus className="h-4 w-4" />
      </button>

      <div className="h-5 w-[1px] bg-zinc-200 dark:bg-zinc-800 mx-1" />

      {/* Tables actions */}
      <button
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
        className="rounded p-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        title="Insert Table (3x3)"
      >
        <TableIcon className="h-4 w-4" />
      </button>
      {editor.isActive("table") && (
        <>
          <button
            onClick={() => editor.chain().focus().addColumnAfter().run()}
            className="rounded p-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            title="Add Column"
          >
            <PlusCircle className="h-4 w-4 rotate-90 text-blue-500" />
          </button>
          <button
            onClick={() => editor.chain().focus().addRowAfter().run()}
            className="rounded p-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            title="Add Row"
          >
            <PlusCircle className="h-4 w-4 text-blue-500" />
          </button>
          <button
            onClick={() => editor.chain().focus().deleteTable().run()}
            className="rounded p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
            title="Delete Table"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
};
export default EditorToolbar;
