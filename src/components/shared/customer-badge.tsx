"use client";

interface CustomerBadgeProps {
  name: string;
  color: string;
  className?: string;
}

export function CustomerBadge({ name, color, className }: CustomerBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ""}`}>
      <span
        className="h-2.5 w-2.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="text-sm">{name}</span>
    </span>
  );
}
