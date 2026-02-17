// ─── Feedback Board Types ────────────────────────────────────────────────────

export type FeedbackStatus =
  | "open"
  | "under_review"
  | "planned"
  | "in_progress"
  | "done"
  | "wont_fix";

export interface FeedbackStatusConfig {
  label: string;
  icon: string;
  className: string;
}

export const FEEDBACK_STATUS_CONFIG: Record<FeedbackStatus, FeedbackStatusConfig> = {
  open: {
    label: "Open",
    icon: "fa-solid fa-circle-dot",
    className: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  },
  under_review: {
    label: "Under Review",
    icon: "fa-solid fa-magnifying-glass",
    className: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  },
  planned: {
    label: "Planned",
    icon: "fa-solid fa-calendar-check",
    className: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  },
  in_progress: {
    label: "In Progress",
    icon: "fa-solid fa-spinner",
    className: "bg-violet-500/15 text-violet-500 border-violet-500/30",
  },
  done: {
    label: "Done",
    icon: "fa-solid fa-circle-check",
    className: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  },
  wont_fix: {
    label: "Won't Fix",
    icon: "fa-solid fa-circle-xmark",
    className: "bg-red-500/15 text-red-400 border-red-500/30",
  },
};

export interface FeedbackLabel {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  createdAt: string;
}

export interface FeedbackPost {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  status: FeedbackStatus;
  isPinned: boolean;
  labels: FeedbackLabel[];
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackPostDetail extends FeedbackPost {
  comments: FeedbackComment[];
}
