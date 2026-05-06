import { ReactNode, useState } from 'react';
import { X, Minimize2, Maximize2, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DockablePanelProps {
  id: string;
  title: string;
  children: ReactNode;
  defaultMinimized?: boolean;
  onClose?: () => void;
  className?: string;
  headerActions?: ReactNode;
}

export function DockablePanel({
  id,
  title,
  children,
  defaultMinimized = false,
  onClose,
  className,
  headerActions,
}: DockablePanelProps) {
  const [isMinimized, setIsMinimized] = useState(defaultMinimized);

  return (
    <div
      className={cn(
        'flex flex-col bg-background-secondary border border-border rounded-lg overflow-hidden shadow-sm',
        className
      )}
      data-panel-id={id}
    >
      {/* Panel Header - More visible and clickable */}
      <div className="h-9 bg-background-elevated border-b border-border flex items-center justify-between px-3 cursor-move select-none hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <GripVertical className="h-4 w-4 text-foreground-muted flex-shrink-0" />
          <span className="text-sm font-semibold text-foreground truncate">
            {title}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          {headerActions}
          
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="h-7 w-7 flex items-center justify-center hover:bg-primary/20 hover:text-primary rounded transition-all"
            title={isMinimized ? 'Maximize' : 'Minimize'}
          >
            {isMinimized ? (
              <Maximize2 className="h-4 w-4" />
            ) : (
              <Minimize2 className="h-4 w-4" />
            )}
          </button>
          
          {onClose && (
            <button
              onClick={onClose}
              className="h-7 w-7 flex items-center justify-center hover:bg-destructive/20 hover:text-destructive rounded transition-all"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Panel Content */}
      {!isMinimized && (
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      )}
    </div>
  );
}
