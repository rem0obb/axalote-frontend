import { AlertTriangle, RefreshCw, Server, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/services/api.service';

interface ErrorDisplayProps {
  error: ApiError;
  endpoint: string;
  onRetry: () => void;
}

export function ErrorDisplay({ error, endpoint, onRetry }: ErrorDisplayProps) {
  const isNetworkError = error.code === 'NETWORK_ERROR' || error.status === 0;

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="bg-card border border-border-subtle rounded-lg p-8 max-w-md w-full text-center">
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          {isNetworkError ? (
            <Wifi className="h-6 w-6 text-destructive" />
          ) : (
            <Server className="h-6 w-6 text-destructive" />
          )}
        </div>

        <h3 className="font-semibold text-foreground mb-2">
          {isNetworkError ? 'Connection Failed' : 'API Error'}
        </h3>

        <p className="text-sm text-foreground-muted mb-4">
          {error.message}
        </p>

        <div className="bg-background-secondary rounded p-3 mb-6 text-left">
          <div className="flex items-start gap-2 text-xs">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <div className="space-y-1 text-foreground-muted">
              <p><strong className="text-foreground">Endpoint:</strong> {endpoint}</p>
              {error.status !== undefined && error.status > 0 && (
                <p><strong className="text-foreground">Status:</strong> {error.status}</p>
              )}
              {error.code && (
                <p><strong className="text-foreground">Code:</strong> {error.code}</p>
              )}
            </div>
          </div>
        </div>

        <Button onClick={onRetry} className="w-full">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry Connection
        </Button>
      </div>
    </div>
  );
}
