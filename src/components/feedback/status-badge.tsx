"use client";

import { cn } from "@/lib/utils/cn";
import { FEEDBACK_STATUS_CONFIG, type FeedbackStatus } from "@/types/feedback";

interface StatusBadgeProps {
  status: FeedbackStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = FEEDBACK_STATUS_CONFIG[status];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        config.className,
        className,
      )}
    >
      <i className={cn(config.icon, "text-[10px]")} />
      {config.label}
    </span>
  );
}
