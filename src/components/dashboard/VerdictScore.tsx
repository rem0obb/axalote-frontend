import React, { useMemo } from 'react';
import { Skull, AlertTriangle, HelpCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface VerdictScoreProps {
    yaraMatch: boolean;
    yaraRuleCount: number;
    entropy: number;
    iocCount: number;
    family: string | undefined;
}

export const VerdictScore: React.FC<VerdictScoreProps> = ({
    yaraMatch,
    yaraRuleCount,
    entropy,
    iocCount,
    family
}) => {
    // Calculate Threat Score (0-100)
    const score = useMemo(() => {
        let s = 0;

        // 1. Yara Weights (Highest Impact)
        if (yaraMatch) {
            s += 50; // Base malicious detection
            s += Math.min(yaraRuleCount * 10, 30); // Up to 30 points for multiple rules
        }

        // 2. Entropy Weights (Suspicion)
        if (entropy > 7.0) s += 20;
        else if (entropy > 6.0) s += 10;

        // 3. IOC Weights
        if (iocCount > 0) s += Math.min(iocCount * 5, 20); // Up to 20 points

        // 4. Family Classification (Confirmation)
        if (family) s = 100; // If it's classified, it's confirmed malware

        return Math.min(s, 100);
    }, [yaraMatch, yaraRuleCount, entropy, iocCount, family]);

    // Determine Verdict Level
    const verdict = useMemo(() => {
        if (score >= 80) return { label: 'MALICIOUS', color: 'text-destructive', bg: 'bg-destructive', icon: Skull };
        if (score >= 50) return { label: 'SUSPICIOUS', color: 'text-orange-500', bg: 'bg-orange-500', icon: AlertTriangle };
        if (score >= 20) return { label: 'UNCERTAIN', color: 'text-yellow-500', bg: 'bg-yellow-500', icon: HelpCircle };
        return { label: 'CLEAN', color: 'text-emerald-500', bg: 'bg-emerald-500', icon: CheckCircle };
    }, [score]);

    const Icon = verdict.icon;

    return (
        <div className="p-4 bg-background-secondary/30 rounded-xl border border-border-subtle">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Icon className={cn("h-5 w-5", verdict.color)} />
                    <span className={cn("text-xs font-black tracking-widest uppercase", verdict.color)}>
                        {verdict.label}
                    </span>
                </div>
                <span className="text-xl font-black font-mono text-foreground">
                    {score}<span className="text-xs text-foreground-muted ml-0.5">/100</span>
                </span>
            </div>

            <Progress
                value={score}
                className="h-2 bg-background-primary/50 mb-2"
                indicatorClassName={verdict.bg}
            />

            <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider text-foreground-muted opacity-70">
                <span>Safe</span>
                <span>Suspicious</span>
                <span>Critical</span>
            </div>
        </div>
    );
};
