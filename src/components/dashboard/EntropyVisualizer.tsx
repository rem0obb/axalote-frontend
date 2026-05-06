import React from 'react';
import { cn } from '@/lib/utils';
import { HelpCircle } from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

interface EntropyVisualizerProps {
    entropy: number;
}

export const EntropyVisualizer: React.FC<EntropyVisualizerProps> = ({ entropy }) => {
    // Entropy ranges from 0 to 8
    const percentage = (entropy / 8) * 100;

    const getStatusColor = (val: number) => {
        if (val > 7.2) return "text-destructive"; // Packed/Encrypted
        if (val > 6.0) return "text-orange-500"; // Compressed?
        return "text-emerald-500"; // Normal code/text
    };

    const statusColor = getStatusColor(entropy);

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">Entropy</span>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                <HelpCircle className="h-3 w-3 text-foreground-muted/50 hover:text-foreground-muted transition-colors" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[200px] text-xs">
                                <p>Shannon Entropy measures the randomness of data. High entropy ({'>'}7.2) often indicates packed or encrypted malicious code.</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <span className={cn("text-xs font-mono font-bold", statusColor)}>
                    {entropy.toFixed(3)}
                </span>
            </div>

            <div className="h-2.5 w-full bg-background-secondary rounded-full overflow-hidden relative border border-border-subtle/50">
                {/* Gradient Background */}
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-yellow-400 to-destructive opacity-20" />

                {/* Indicator Marker */}
                <div
                    className="absolute top-0 bottom-0 w-1 bg-foreground transition-all duration-500 ease-out"
                    style={{ left: `${percentage}%` }}
                />
            </div>

            <div className="flex justify-between text-[8px] font-bold uppercase tracking-widest text-foreground-muted/40">
                <span>Text (0-4)</span>
                <span>Code (4-6)</span>
                <span>Packed (7+)</span>
            </div>
        </div>
    );
};
