"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface PostFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (title: string, body: string) => Promise<void>;
  initialTitle?: string;
  initialBody?: string;
  mode?: "create" | "edit";
}

export function PostFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialTitle = "",
  initialBody = "",
  mode = "create",
}: PostFormDialogProps) {
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!body.trim()) {
      setError("Body is required");
      return;
    }

    setLoading(true);
    try {
      await onSubmit(title.trim(), body.trim());
      if (mode === "create") {
        setTitle("");
        setBody("");
      }
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New Post" : "Edit Post"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="fb-title">Title</Label>
            <Input
              id="fb-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What's on your mind?"
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fb-body">Details</Label>
            <Textarea
              id="fb-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Describe your idea, request, or feedback..."
              rows={6}
              maxLength={10000}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <i className="fa-solid fa-spinner fa-spin mr-1.5" />}
            {mode === "create" ? "Post" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
