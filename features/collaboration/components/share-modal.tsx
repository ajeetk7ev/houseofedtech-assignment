"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Share2, Copy, Check, Trash2, Shield, User, Loader2, X } from "lucide-react";

interface Collaborator {
  userId: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
  user: {
    id: string;
    name: string | null;
    email: string | null;
  };
}

interface ShareModalProps {
  documentId: string;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ documentId, onClose }) => {
  const { data: session } = useSession();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Find current user's role
  const currentMember = collaborators.find((c) => c.userId === session?.user?.id);
  const isOwner = currentMember?.role === "OWNER";

  useEffect(() => {
    fetchCollaborators();
  }, [documentId]);

  const fetchCollaborators = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/documents/${documentId}/collaborators`);
      const json = await res.json();
      if (json.success) {
        setCollaborators(json.data || []);
      } else {
        setError(json.error?.message || "Failed to fetch collaborators");
      }
    } catch (err) {
      setError("Failed to load collaborators list");
    } finally {
      setLoading(false);
    }
  };

  const generateInviteLink = async () => {
    try {
      setActionLoading("invite");
      const res = await fetch(`/api/documents/${documentId}/invite`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success && json.data?.token) {
        setInviteToken(json.data.token);
        setError(null);
      } else {
        setError(json.error?.message || "Failed to generate invite token");
      }
    } catch (err) {
      setError("Error generating share link");
    } finally {
      setActionLoading(null);
    }
  };

  const updateRole = async (targetUserId: string, newRole: "EDITOR" | "VIEWER") => {
    try {
      setActionLoading(`role-${targetUserId}`);
      const res = await fetch(`/api/documents/${documentId}/collaborators`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetUserId, role: newRole }),
      });
      const json = await res.json();
      if (json.success) {
        setCollaborators((prev) =>
          prev.map((c) => (c.userId === targetUserId ? { ...c, role: newRole } : c))
        );
      } else {
        setError(json.error?.message || "Failed to update role");
      }
    } catch (err) {
      setError("Error updating collaborator role");
    } finally {
      setActionLoading(null);
    }
  };

  const removeCollaborator = async (targetUserId: string) => {
    try {
      setActionLoading(`remove-${targetUserId}`);
      const res = await fetch(`/api/documents/${documentId}/collaborators?userId=${targetUserId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        setCollaborators((prev) => prev.filter((c) => c.userId !== targetUserId));
      } else {
        setError(json.error?.message || "Failed to remove collaborator");
      }
    } catch (err) {
      setError("Error removing collaborator");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCopy = () => {
    if (!inviteToken) return;
    const inviteUrl = `${window.location.origin}/documents/${documentId}?invite=${inviteToken}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950 sm:p-8 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-150 pb-4 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-indigo-500" />
            <h3 className="text-lg font-bold text-zinc-850 dark:text-zinc-50">Share Document</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-600 dark:bg-red-950/20 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Invite link section */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Invite Link
            </h4>
            
            {inviteToken ? (
              <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-900">
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/documents/${documentId}?invite=${inviteToken}`}
                  className="w-full border-0 bg-transparent text-xs text-zinc-600 focus:outline-none focus:ring-0 dark:text-zinc-350"
                />
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              isOwner && (
                <button
                  disabled={actionLoading === "invite"}
                  onClick={generateInviteLink}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50"
                >
                  {actionLoading === "invite" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Share2 className="h-4 w-4" />
                  )}
                  <span>Create Invite Link</span>
                </button>
              )
            )}
            {!isOwner && !inviteToken && (
              <p className="text-xs text-zinc-500">Only the owner can generate new invite links.</p>
            )}
          </div>

          {/* Collaborator List */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              Collaborators
            </h4>

            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
                {collaborators.map((collaborator) => {
                  const initials = (collaborator.user.name || collaborator.user.email || "U")
                    .substring(0, 2)
                    .toUpperCase();
                  const isTargetLoading = actionLoading?.includes(collaborator.userId);

                  return (
                    <div key={collaborator.userId} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-zinc-800 dark:text-zinc-200">
                            {collaborator.user.name || "Anonymous User"}
                            {collaborator.userId === session?.user?.id && (
                              <span className="ml-1 text-[10px] text-zinc-400 font-normal">(you)</span>
                            )}
                          </p>
                          <p className="truncate text-[10px] text-zinc-400 dark:text-zinc-500">
                            {collaborator.user.email}
                          </p>
                        </div>
                      </div>

                      {/* Controls */}
                      <div className="flex items-center gap-1.5">
                        {collaborator.role === "OWNER" ? (
                          <span className="flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">
                            <Shield className="h-3 w-3" />
                            <span>Owner</span>
                          </span>
                        ) : isOwner ? (
                          <>
                            <select
                              value={collaborator.role}
                              disabled={isTargetLoading}
                              onChange={(e) => updateRole(collaborator.userId, e.target.value as any)}
                              className="rounded-lg border border-zinc-250 bg-white px-2 py-1 text-xs text-zinc-700 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
                            >
                              <option value="EDITOR">Editor</option>
                              <option value="VIEWER">Viewer</option>
                            </select>
                            <button
                              disabled={isTargetLoading}
                              onClick={() => removeCollaborator(collaborator.userId)}
                              className="rounded-lg p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20 dark:hover:text-red-400 transition-colors"
                            >
                              {isTargetLoading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </>
                        ) : (
                          <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                            {collaborator.role}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default ShareModal;
