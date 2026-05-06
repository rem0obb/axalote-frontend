import { memo } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  sublabel?: string;
  variant?: 'default' | 'warning' | 'success';
}

export const StatCard = memo(({ label, value, icon: Icon, sublabel, variant = 'default' }: StatCardProps) => {
  return (
    <div className="bg-card border border-border-subtle rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-foreground-muted uppercase tracking-wide mb-1">{label}</p>
          <p className={cn(
            "text-2xl font-mono font-semibold",
            variant === 'default' && "text-foreground",
            variant === 'warning' && "text-warning",
            variant === 'success' && "text-success"
          )}>
            {value}
          </p>
          {sublabel && (
            <p className="text-[11px] text-foreground-muted mt-1">{sublabel}</p>
          )}
        </div>
        <div className={cn(
          "p-2 rounded-md",
          variant === 'default' && "bg-primary/10",
          variant === 'warning' && "bg-warning/10",
          variant === 'success' && "bg-success/10"
        )}>
          <Icon className={cn(
            "h-4 w-4",
            variant === 'default' && "text-primary",
            variant === 'warning' && "text-warning",
            variant === 'success' && "text-success"
          )} />
        </div>
      </div>
    </div>
  );
});
