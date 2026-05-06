import { cn } from '@/lib/utils';
import { Activity, HardDrive, Clock } from 'lucide-react';

interface IDAStatusBarProps {
  leftItems?: React.ReactNode[];
  rightItems?: React.ReactNode[];
  className?: string;
}

export function IDAStatusBar({ leftItems = [], rightItems = [], className }: IDAStatusBarProps) {
  return (
    <div className={cn(
      'h-5 bg-background-elevated border-t border-border flex items-center justify-between px-2 text-[10px] text-foreground-muted',
      className
    )}>
      {/* Left Section */}
      <div className="flex items-center gap-3">
        {leftItems.map((item, i) => (
          <div key={i} className="flex items-center gap-1">
            {item}
          </div>
        ))}
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-3">
        {rightItems.map((item, i) => (
          <div key={i} className="flex items-center gap-1">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

interface StatusItemProps {
  icon?: React.ReactNode;
  label: string;
  value?: string | number;
  className?: string;
}

export function StatusItem({ icon, label, value, className }: StatusItemProps) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {icon}
      <span className="text-foreground-muted">{label}:</span>
      {value !== undefined && (
        <span className="text-foreground font-medium">{value}</span>
      )}
    </div>
  );
}
