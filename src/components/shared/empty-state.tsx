import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: string;
  title: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: string;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  message,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-12 text-center",
        className
      )}
    >
      <i className={`fa-solid ${icon} text-4xl text-muted-foreground`} />
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      {message && (
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      )}
      {action && (
        <Button onClick={action.onClick} className="mt-4" size="sm">
          {action.icon && <i className={`fa-solid ${action.icon} mr-1.5`} />}
          {action.label}
        </Button>
      )}
    </div>
  );
}
