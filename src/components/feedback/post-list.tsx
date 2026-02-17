"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PostCard } from "./post-card";
import { LabelBadge } from "./label-badge";
import { PostFormDialog } from "./post-form-dialog";
import type { FeedbackPost, FeedbackLabel } from "@/types/feedback";

const STATUS_TABS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "under_review", label: "Under Review" },
  { value: "planned", label: "Planned" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
];

export function PostList() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [posts, setPosts] = useState<FeedbackPost[]>([]);
  const [labels, setLabels] = useState<FeedbackLabel[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showNewPost, setShowNewPost] = useState(false);

  const statusFilter = searchParams.get("status") || "all";
  const labelFilter = searchParams.get("label") || "";

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (labelFilter) params.set("label", labelFilter);

      const res = await fetch(`/api/feedback?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts);
        setTotal(data.total);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, labelFilter]);

  const fetchLabels = useCallback(async () => {
    const res = await fetch("/api/feedback/labels");
    if (res.ok) {
      setLabels(await res.json());
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    fetchLabels();
  }, [fetchLabels]);

  const handleStatusChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("status");
    } else {
      params.set("status", value);
    }
    router.push(`/feedback?${params.toString()}`);
  };

  const handleLabelToggle = (labelId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (labelFilter === labelId) {
      params.delete("label");
    } else {
      params.set("label", labelId);
    }
    router.push(`/feedback?${params.toString()}`);
  };

  const handleCreatePost = async (title: string, body: string) => {
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to create post");
    }

    await fetchPosts();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Feedback Board</h1>
          <p className="text-sm text-muted-foreground">
            Share ideas, report issues, and track requests
          </p>
        </div>
        <Button onClick={() => setShowNewPost(true)}>
          <i className="fa-solid fa-plus mr-1.5" />
          New Post
        </Button>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <Tabs value={statusFilter} onValueChange={handleStatusChange}>
          <TabsList>
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {labels.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {labels.map((label) => (
              <LabelBadge
                key={label.id}
                label={label}
                active={labelFilter === label.id}
                onClick={() => handleLabelToggle(label.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Post List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <i className="fa-solid fa-spinner fa-spin text-xl text-muted-foreground" />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <i className="fa-solid fa-comments text-4xl text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">No posts yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">Be the first to share your feedback!</p>
          <Button onClick={() => setShowNewPost(true)} className="mt-4" size="sm">
            <i className="fa-solid fa-plus mr-1.5" />
            Create Post
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
          {total > posts.length && (
            <p className="pt-2 text-center text-xs text-muted-foreground">
              Showing {posts.length} of {total} posts
            </p>
          )}
        </div>
      )}

      {/* New Post Dialog */}
      <PostFormDialog
        open={showNewPost}
        onOpenChange={setShowNewPost}
        onSubmit={handleCreatePost}
      />
    </div>
  );
}
