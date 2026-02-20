"use client";

interface KpiCardProps {
  title: string;
  icon?: string;
  children: React.ReactNode;
  className?: string;
}

export function KpiCard({ title, icon, children, className = "" }: KpiCardProps) {
  return (
    <div className={`rounded-lg border border-border bg-card p-5 flex flex-col ${className}`}>
      <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
        {icon && <i className={icon} />}
        {title}
      </h3>
      <div className="flex-1">{children}</div>
    </div>
  );
}
