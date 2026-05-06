import { useIsFetching } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

export function GlobalLoader() {
    const isFetching = useIsFetching({
        predicate: (query) => query.queryKey[1] !== '/axalote/heartbeat/collect'
    });
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        let timeout: NodeJS.Timeout;
        if (isFetching > 0) {
            // Show immediately or with a tiny delay to prevent flicker on super fast requests
            setIsVisible(true);
        } else {
            // Add a small delay before hiding to make it feel smoother
            timeout = setTimeout(() => setIsVisible(false), 500);
        }
        return () => clearTimeout(timeout);
    }, [isFetching]);

    if (!isVisible) return null;

    return (
        <div
            className={cn(
                "fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-full",
                "bg-background/80 backdrop-blur-md border border-border-subtle shadow-lg",
                "animate-in fade-in slide-in-from-bottom-4 duration-300",
                isFetching === 0 && "animate-out fade-out slide-out-to-bottom-4"
            )}
        >
            <div className="relative flex h-5 w-5 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
            </div>
            <span className="text-sm font-medium text-foreground pr-1">
                Processing...
            </span>
        </div>
    );
}
