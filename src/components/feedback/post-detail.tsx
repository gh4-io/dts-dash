"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "./status-badge";
import { LabelBadge } from "./label-badge";
import { LabelManager } from "./label-manager";
import { PostFormDialog } from "./post-form-dialog";
import {
  FEEDBACK_STATUS_CONFIG,
  type FeedbackPostDetail,
  type FeedbackLabel,
  type FeedbackStatus,
  type FeedbackComment,
} from "@/types/feedback";

interface PostDetailProps {
  postId: string;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function wasEdited(created: string, updated: string): boolean {
  return new Date(updated).getTime() - new Date(created).getTime() > 1000;
}

export function PostDetail({ postId }: PostDetailProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const userRole = (session?.user as unknown as { role?: string })?.role;
  const isAdmin = userRole === "admin" || userRole === "superadmin";

  const [post, setPost] = useState<FeedbackPostDetail | null>(null);
  const [allLabels, setAllLabels] = useState<FeedbackLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState("");

  const fetchPost = useCallback(async () => {
    const res = await fetch(`/api/feedback/${postId}`);
    if (res.ok) {
      setPost(await res.json());
    } else if (res.status === 404) {
      router.push("/feedback");
    }
    setLoading(false);
  }, [postId, router]);

  const fetchLabels = useCallback(async () => {
    const res = await fetch("/api/feedback/labels");
    if (res.ok) {
      setAllLabels(await res.json());
    }
  }, []);

  useEffect(() => {
    fetchPost();
    fetchLabels();
  }, [fetchPost, fetchLabels]);

  const handleEditPost = async (title: string, body: string) => {
    const res = await fetch(`/api/feedback/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to update");
    }
    await fetchPost();
  };

  const handleDeletePost = async () => {
    const res = await fetch(`/api/feedback/${postId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/feedback");
    }
  };

  const handleStatusChange = async (status: string) => {
    await fetch(`/api/feedback/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await fetchPost();
  };

  const handleTogglePin = async () => {
    if (!post) return;
    await fetch(`/api/feedback/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPinned: !post.isPinned }),
    });
    await fetchPost();
  };

  const handleToggleLabel = async (labelId: string) => {
    if (!post) return;
    const currentIds = post.labels.map((l) => l.id);
    const newIds = currentIds.includes(labelId)
      ? currentIds.filter((id) => id !== labelId)
      : [...currentIds, labelId];

    await fetch(`/api/feedback/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ labelIds: newIds }),
    });
    await fetchPost();
  };

  const handleCreateLabel = async (name: string, color: string) => {
    const res = await fetch("/api/feedback/labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    if (res.ok) {
      await fetchLabels();
    }
  };

  const handleDeleteLabel = async (id: string) => {
    await fetch(`/api/feedback/labels/${id}`, { method: "DELETE" });
    await fetchLabels();
    await fetchPost();
  };

  const handleAddComment = async () => {
    if (!commentBody.trim()) return;
    setCommentLoading(true);
    try {
      const res = await fetch(`/api/feedback/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: commentBody.trim() }),
      });
      if (res.ok) {
        setCommentBody("");
        await fetchPost();
      }
    } finally {
      setCommentLoading(false);
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!editingCommentBody.trim()) return;
    const res = await fetch(`/api/feedback/${postId}/comments/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: editingCommentBody.trim() }),
    });
    if (res.ok) {
      setEditingCommentId(null);
      setEditingCommentBody("");
      await fetchPost();
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    await fetch(`/api/feedback/${postId}/comments/${commentId}`, { method: "DELETE" });
    await fetchPost();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <i className="fa-solid fa-spinner fa-spin text-xl text-muted-foreground" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <h2 className="text-lg font-semibold">Post not found</h2>
        <Link href="/feedback" className="mt-2 text-sm text-primary hover:underline">
          Back to Feedback Board
        </Link>
      </div>
    );
  }

  const isAuthor = post.authorId === userId;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/feedback"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <i className="fa-solid fa-arrow-left text-xs" />
        Back to Feedback Board
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Main content */}
        <div className="space-y-6">
          {/* Post header */}
          <div>
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-xl font-bold tracking-tight">{post.title}</h1>
              {(isAuthor || isAdmin) && (
                <div className="flex shrink-0 items-center gap-1">
                  {isAuthor && (
                    <Button variant="ghost" size="sm" onClick={() => setShowEdit(true)}>
                      <i className="fa-solid fa-pen text-xs" />
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <i className="fa-solid fa-trash text-xs text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete post?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete this post and all its comments.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeletePost}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={post.status} />
              {post.labels.map((label) => (
                <LabelBadge key={label.id} label={label} />
              ))}
              {post.isPinned && (
                <span className="inline-flex items-center gap-1 text-xs text-primary">
                  <i className="fa-solid fa-thumbtack text-[10px]" />
                  Pinned
                </span>
              )}
            </div>

            {/* Post body */}
            <div className="mt-4 whitespace-pre-wrap text-sm text-foreground">{post.body}</div>

            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
                {post.authorName.charAt(0).toUpperCase()}
              </span>
              <span>{post.authorName}</span>
              <span>&middot;</span>
              <span>{timeAgo(post.createdAt)}</span>
              {wasEdited(post.createdAt, post.updatedAt) && (
                <span className="italic">(edited)</span>
              )}
            </div>
          </div>

          {/* Comments */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Comments ({post.comments.length})</h3>

            {post.comments.map((comment: FeedbackComment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                userId={userId}
                isAdmin={isAdmin}
                isEditing={editingCommentId === comment.id}
                editingBody={editingCommentBody}
                onStartEdit={() => {
                  setEditingCommentId(comment.id);
                  setEditingCommentBody(comment.body);
                }}
                onCancelEdit={() => {
                  setEditingCommentId(null);
                  setEditingCommentBody("");
                }}
                onChangeBody={setEditingCommentBody}
                onSaveEdit={() => handleEditComment(comment.id)}
                onDelete={() => handleDeleteComment(comment.id)}
              />
            ))}

            {/* Add comment */}
            <div className="space-y-2">
              <Textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Add a comment..."
                rows={3}
                maxLength={5000}
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleAddComment}
                  disabled={commentLoading || !commentBody.trim()}
                >
                  {commentLoading && <i className="fa-solid fa-spinner fa-spin mr-1.5" />}
                  Comment
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar — admin controls */}
        {isAdmin && (
          <div className="space-y-6 rounded-lg border border-border bg-card p-4">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">
              Admin Controls
            </h3>

            {/* Status */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select value={post.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(FEEDBACK_STATUS_CONFIG) as FeedbackStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      <span className="flex items-center gap-1.5">
                        <i className={FEEDBACK_STATUS_CONFIG[s].icon + " text-[10px]"} />
                        {FEEDBACK_STATUS_CONFIG[s].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Pin */}
            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTogglePin}
                className="w-full text-xs"
              >
                <i
                  className={`fa-solid fa-thumbtack mr-1.5 ${post.isPinned ? "text-primary" : ""}`}
                />
                {post.isPinned ? "Unpin" : "Pin to top"}
              </Button>
            </div>

            {/* Labels */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Post Labels</label>
              <div className="flex flex-wrap gap-1.5">
                {allLabels.map((label) => (
                  <LabelBadge
                    key={label.id}
                    label={label}
                    active={post.labels.some((l) => l.id === label.id)}
                    onClick={() => handleToggleLabel(label.id)}
                  />
                ))}
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <LabelManager
                labels={allLabels}
                onCreateLabel={handleCreateLabel}
                onDeleteLabel={handleDeleteLabel}
              />
            </div>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      {isAuthor && (
        <PostFormDialog
          open={showEdit}
          onOpenChange={setShowEdit}
          onSubmit={handleEditPost}
          initialTitle={post.title}
          initialBody={post.body}
          mode="edit"
        />
      )}
    </div>
  );
}

// ─── Comment Item ────────────────────────────────────────────────────────────

interface CommentItemProps {
  comment: FeedbackComment;
  userId?: string;
  isAdmin: boolean;
  isEditing: boolean;
  editingBody: string;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onChangeBody: (body: string) => void;
  onSaveEdit: () => void;
  onDelete: () => void;
}

function CommentItem({
  comment,
  userId,
  isAdmin,
  isEditing,
  editingBody,
  onStartEdit,
  onCancelEdit,
  onChangeBody,
  onSaveEdit,
  onDelete,
}: CommentItemProps) {
  const isAuthor = comment.authorId === userId;

  return (
    <div className="rounded-md border border-border bg-card/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
            {comment.authorName.charAt(0).toUpperCase()}
          </span>
          <span className="font-medium text-foreground">{comment.authorName}</span>
          <span>&middot;</span>
          <span>{timeAgo(comment.createdAt)}</span>
          {wasEdited(comment.createdAt, comment.updatedAt) && (
            <span className="italic">(edited)</span>
          )}
        </div>
        {(isAuthor || isAdmin) && !isEditing && (
          <div className="flex items-center gap-1">
            {isAuthor && (
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onStartEdit}>
                <i className="fa-solid fa-pen text-[10px]" />
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <i className="fa-solid fa-trash text-[10px] text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete comment?</AlertDialogTitle>
                  <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="mt-2 space-y-2">
          <Textarea
            value={editingBody}
            onChange={(e) => onChangeBody(e.target.value)}
            rows={3}
            maxLength={5000}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onCancelEdit}>
              Cancel
            </Button>
            <Button size="sm" onClick={onSaveEdit} disabled={!editingBody.trim()}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-2 whitespace-pre-wrap text-sm text-foreground">{comment.body}</div>
      )}
    </div>
  );
}
