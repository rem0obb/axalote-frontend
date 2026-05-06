import { cn } from '@/lib/utils';

export function EntropyIndicator({ value }: { value: number }) {
    const isHigh = value >= 7;
    const isMedium = value >= 5 && value < 7;

    return (
        <div className="flex items-center gap-2">
            <span className="font-mono text-xs">{value.toFixed(2)}</span>
            <span className={cn(
                "text-[9px] px-1.5 py-0.5 rounded font-medium uppercase",
                isHigh && "bg-destructive/15 text-destructive",
                isMedium && "bg-warning/15 text-warning",
                !isHigh && !isMedium && "bg-success/15 text-success"
            )}>
                {isHigh ? 'High' : isMedium ? 'Med' : 'Low'}
            </span>
        </div>
    );
}
