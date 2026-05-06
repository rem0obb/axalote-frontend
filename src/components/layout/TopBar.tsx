import { RefreshCw, Clock, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EndpointConfig } from '@/types/threat.types';

interface TopBarProps {
  endpoint: EndpointConfig;
  isLoading: boolean;
  isError: boolean;
  lastUpdated?: Date;
  onRefresh?: () => void;
}

export function TopBar({ endpoint, isLoading, isError, lastUpdated, onRefresh }: TopBarProps) {
  return (
    <header className="h-14 bg-background-secondary border-b border-border-subtle flex items-center justify-end px-6">
      {/* Refresh */}
      {onRefresh && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="h-8 text-xs"
        >
          <RefreshCw className={cn("h-3 w-3 mr-1.5", isLoading && "animate-spin")} />
          Refresh
        </Button>
      )}
    </header>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
