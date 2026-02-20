"use client";

import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { StatusBadge } from "./status-badge";
import { LabelBadge } from "./label-badge";
import type { FeedbackPost } from "@/types/feedback";

interface PostCardProps {
  post: FeedbackPost;
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

export function PostCard({ post }: PostCardProps) {
  return (
    <Link
      href={`/feedback/${post.id}`}
      className={cn(
        "block rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/50",
        post.isPinned && "border-primary/30",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {post.isPinned && <i className="fa-solid fa-thumbtack text-xs text-primary" />}
            <h3 className="truncate text-sm font-semibold text-foreground">{post.title}</h3>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={post.status} />
            {post.labels.map((label) => (
              <LabelBadge key={label.id} label={label} />
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
          {post.commentCount > 0 && (
            <span className="flex items-center gap-1">
              <i className="fa-solid fa-comment text-[10px]" />
              {post.commentCount}
            </span>
          )}
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-medium text-primary">
          {post.authorName.charAt(0).toUpperCase()}
        </span>
        <span>{post.authorName}</span>
        <span>&middot;</span>
        <span>{timeAgo(post.createdAt)}</span>
      </div>
    </Link>
  );
}
