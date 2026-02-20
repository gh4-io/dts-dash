"use client";

import { cn } from "@/lib/utils/cn";
import { getContrastText } from "@/lib/utils/contrast";
import type { FeedbackLabel } from "@/types/feedback";

interface LabelBadgeProps {
  label: FeedbackLabel;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}

export function LabelBadge({ label, onClick, active, className }: LabelBadgeProps) {
  const textColor = getContrastText(label.color);

  const Component = onClick ? "button" : "span";

  return (
    <Component
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity",
        onClick && "cursor-pointer hover:opacity-80",
        !active && onClick && "opacity-50",
        className,
      )}
      style={{ backgroundColor: label.color, color: textColor }}
    >
      {label.name}
    </Component>
  );
}
