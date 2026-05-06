import React, { useMemo } from 'react';
import { useFileRecords } from '@/hooks/useEndpointData';
import {
    ShieldAlert,
    Share2,
    Shield,
    Info,
    ArrowRight,
    Activity
} from 'lucide-react';
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LoadingState } from '@/components/common/LoadingState';

interface FileCorrelationAnalysisProps {
    sha256: string;
}

export const FileCorrelationAnalysis: React.FC<FileCorrelationAnalysisProps> = ({ sha256 }) => {
    const { data: files = [], isLoading } = useFileRecords();
    const navigate = useNavigate();

    const selectedFile = useMemo(() =>
        files.find(f => f.metadata.sha256 === sha256),
        [files, sha256]);

    const correlations = useMemo(() => {
        if (!selectedFile || !Array.isArray(selectedFile.iocs) || selectedFile.iocs.length === 0) return [];

        const sourceIocs = new Set(selectedFile.iocs);

        return files
            .filter(f => f.metadata.sha256 !== selectedFile.metadata.sha256)
            .filter(f => Array.isArray(f.iocs) && f.iocs.length > 0)
            .map(f => {
                const intersection = f.iocs.filter(ioc => sourceIocs.has(ioc));
                const score = (intersection.length / Math.max(f.iocs.length, sourceIocs.size)) * 100;

                return {
                    file: f,
                    shared: intersection,
                    score,
                    count: intersection.length
                };
            })
            .filter(c => c.count > 0)
            .sort((a, b) => b.count - a.count || b.score - a.score);

    }, [selectedFile, files]);

    const [viewMode, setViewMode] = React.useState<'list' | 'graph'>('list');

    const getScoreColor = (score: number) => {
        if (score >= 80) return "text-destructive border-destructive/30 bg-destructive/10";
        if (score >= 50) return "text-orange-500 border-orange-500/30 bg-orange-500/10";
        return "text-primary border-primary/30 bg-primary/10";
    };

    const getProgressBarColor = (score: number) => {
        if (score >= 80) return "bg-destructive";
        if (score >= 50) return "bg-orange-500";
        return "bg-primary";
    };

    if (isLoading) {
        return <LoadingState message="Analyzing intelligence graph..." />;
    }

    if (!selectedFile) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center opacity-60">
                <ShieldAlert className="h-12 w-12 text-foreground-muted mb-4" />
                <h3 className="text-lg font-bold">File Not Found</h3>
                <p className="text-sm text-foreground-muted">Could not retrieve file data for correlation.</p>
            </div>
        );
    }

    // Graph Calculation
    const GraphView = () => {
        if (correlations.length === 0) return null;

        const centerX = 400;
        const centerY = 300;
        const centerRadius = 45;
        const satelliteRadius = 28;
        const orbitRadius = 210;

        return (
            <div className="flex-1 min-h-0 flex items-center justify-center bg-background-secondary/10 rounded-xl border border-border-subtle/50 overflow-hidden relative group/graph">
                {/* Background Grid & Scanline */}
                <div className="absolute inset-0 pointer-events-none opacity-[0.015] bg-[linear-gradient(to_right,#888_1px,transparent_1px),linear-gradient(to_bottom,#888_1px,transparent_1px)] bg-[size:40px_40px]" />
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-primary/2 to-transparent h-1/2 w-full animate-[scan_6s_linear_infinite]" />

                <style dangerouslySetInnerHTML={{
                    __html: `
                    @keyframes scan {
                        from { transform: translateY(-100%); }
                        to { transform: translateY(200%); }
                    }
                    @keyframes pulseShot {
                        0% { stroke-dashoffset: 100; opacity: 0; }
                        20% { opacity: 1; }
                        80% { opacity: 1; }
                        100% { stroke-dashoffset: -300; opacity: 0; }
                    }
                    @keyframes satelliteBreath {
                        0%, 100% { transform: translateY(0px); }
                        50% { transform: translateY(-8px); }
                    }
                    @keyframes lineGlow {
                        0%, 100% { opacity: 0.05; }
                        50% { opacity: 0.15; }
                    }
                `}} />

                <svg width="100%" height="100%" viewBox="0 0 800 600" className="max-w-4xl mx-auto drop-shadow-2xl">
                    <defs>
                        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="3" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                        <filter id="strongGlow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="6" result="blur" />
                            <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>

                        {/* Per-edge gradients to handle seamless terminal fades */}
                        {correlations.slice(0, 8).map((node, i) => {
                            const angle = (i * (360 / Math.min(correlations.length, 8))) * (Math.PI / 180);
                            const x = centerX + orbitRadius * Math.cos(angle);
                            const y = centerY + orbitRadius * Math.sin(angle);
                            return (
                                <linearGradient
                                    key={`edge-grad-${i}`}
                                    id={`edge-grad-${i}`}
                                    gradientUnits="userSpaceOnUse"
                                    x1={centerX} y1={centerY} x2={x} y2={y}
                                >
                                    <stop offset="0%" stopColor="var(--primary)" stopOpacity="0" />
                                    <stop offset="15%" stopColor="var(--primary)" stopOpacity="0.8" />
                                    <stop offset="85%" stopColor="var(--primary)" stopOpacity="0.8" />
                                    <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                                </linearGradient>
                            );
                        })}
                    </defs>

                    {/* Data Flow Connections */}
                    {correlations.slice(0, 8).map((node, i) => {
                        const angle = (i * (360 / Math.min(correlations.length, 8))) * (Math.PI / 180);
                        const x = centerX + orbitRadius * Math.cos(angle);
                        const y = centerY + orbitRadius * Math.sin(angle);
                        const duration = `${2.5 + (i * 0.2)}s`;
                        const delay = `${i * 0.4}s`;

                        return (
                            <g key={`link-${i}`}>
                                {/* Base Static Line (with subtle periodic pulse) */}
                                <path
                                    d={`M ${centerX} ${centerY} L ${x} ${y}`}
                                    stroke="currentColor"
                                    strokeWidth={1}
                                    className="text-primary/10"
                                    fill="none"
                                    style={{ animation: `lineGlow 3s ease-in-out ${delay} infinite` }}
                                />

                                {/* "Energy Pulse" Shot - Zero-Reset via Hidden Terminals */}
                                <path
                                    d={`M ${centerX} ${centerY} L ${x} ${y}`}
                                    stroke={`url(#edge-grad-${i})`}
                                    strokeWidth={3}
                                    strokeDasharray="60, 1000"
                                    strokeLinecap="round"
                                    fill="none"
                                    style={{
                                        animation: `pulseShot ${duration} ease-in infinite ${delay}`,
                                        opacity: 0
                                    }}
                                />

                                <text
                                    x={(centerX + x) / 2}
                                    y={(centerY + y) / 2 - 12}
                                    className="text-[9px] font-black fill-primary/40 font-mono tracking-tighter"
                                    textAnchor="middle"
                                >
                                    {node.count} SHRD
                                </text>
                            </g>
                        );
                    })}

                    {/* Central Node (Always Pulsing & Glowing) */}
                    <g className="cursor-default select-none">
                        <circle
                            cx={centerX} cy={centerY} r={centerRadius + 12}
                            className="fill-primary/5 animate-pulse"
                        />
                        <circle
                            cx={centerX} cy={centerY} r={centerRadius}
                            className="fill-background stroke-primary stroke-2"
                        />
                        <foreignObject x={centerX - 30} y={centerY - 30} width="60" height="60">
                            <div className="h-full w-full flex items-center justify-center">
                                <Shield className="h-10 w-10 text-primary" />
                            </div>
                        </foreignObject>
                        <text x={centerX} y={centerY + 65} textAnchor="middle" className="text-[11px] font-black uppercase tracking-[0.2em] fill-primary">
                            Active File
                        </text>
                        <text x={centerX} y={centerY + 78} textAnchor="middle" className="text-[9px] font-bold fill-foreground/60 font-mono uppercase tracking-wider">
                            {selectedFile.filename.substring(0, 24)}
                        </text>
                    </g>

                    {/* Satellite Nodes (Floating & Interactive) */}
                    {correlations.slice(0, 8).map((node, i) => {
                        const angle = (i * (360 / Math.min(correlations.length, 8))) * (Math.PI / 180);
                        const x = centerX + orbitRadius * Math.cos(angle);
                        const y = centerY + orbitRadius * Math.sin(angle);
                        const isHighConf = node.score >= 70;
                        const floatDelay = `${i * 0.5}s`;

                        return (
                            <g
                                key={`node-${i}`}
                                className="cursor-pointer transition-all duration-300 group/node"
                                onClick={() => navigate(`/files/${node.file.metadata.sha256}`)}
                                style={{ animation: `satelliteBreath 4s ease-in-out ${floatDelay} infinite` }}
                            >
                                {/* Outer Ring Glow */}
                                <circle
                                    cx={x} cy={y} r={satelliteRadius + 5}
                                    className={cn(
                                        "opacity-0 group-hover/node:opacity-30 transition-opacity duration-300",
                                        isHighConf ? "fill-destructive" : "fill-primary"
                                    )}
                                />

                                <circle
                                    cx={x} cy={y} r={satelliteRadius}
                                    className={cn(
                                        "stroke-2 fill-card transition-all duration-300 group-hover/node:r-[32]",
                                        isHighConf ? "stroke-destructive" : "stroke-foreground-muted/40 group-hover/node:stroke-primary"
                                    )}
                                />

                                <foreignObject x={x - 15} y={y - 15} width="30" height="30">
                                    <div className="h-full w-full flex items-center justify-center">
                                        <Share2 className={cn(
                                            "h-5 w-5 transition-colors duration-300",
                                            isHighConf ? "text-destructive" : "text-foreground-muted group-hover/node:text-primary"
                                        )} />
                                    </div>
                                </foreignObject>

                                {/* Metadata Tooltip-style Labels */}
                                <g className="opacity-40 group-hover/node:opacity-100 transition-opacity duration-300">
                                    <text x={x} y={y + 45} textAnchor="middle" className={cn(
                                        "text-[10px] font-black uppercase tracking-tighter",
                                        isHighConf ? "fill-destructive" : "fill-primary"
                                    )}>
                                        {node.score.toFixed(0)}% MATCH
                                    </text>
                                    <text x={x} y={y + 58} textAnchor="middle" className="text-[10px] font-bold fill-foreground">
                                        {node.file.filename.substring(0, 15)}
                                    </text>
                                </g>
                            </g>
                        );
                    })}
                </svg>

                {/* Overlay Legend */}
                <div className="absolute bottom-4 left-4 flex flex-col gap-1.5 p-3 rounded-lg bg-background/60 backdrop-blur-md border border-white/5 text-[10px] font-bold uppercase tracking-widest">
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                        <span className="text-foreground-muted">Medium Correlation</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-destructive" />
                        <span className="text-foreground-muted">High Criticality Match</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full overflow-hidden animate-in fade-in duration-500">
            <Card className="flex-1 flex flex-col min-h-0 bg-card/50 backdrop-blur-sm border-border-subtle shadow-sm">
                <CardHeader className="py-4 px-6 border-b border-border-subtle flex flex-row items-center justify-between shrink-0">
                    <div>
                        <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                            <Share2 className="h-4 w-4 text-primary" />
                            Correlated Artifacts
                        </CardTitle>
                        <CardDescription className="text-xs mt-1">
                            Found {correlations.length} other files sharing common indicators
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 bg-background-secondary/50 p-1 rounded-lg border border-border-subtle">
                        <Button
                            size="sm"
                            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                            onClick={() => setViewMode('list')}
                            className="h-7 text-xs px-3"
                        >
                            List
                        </Button>
                        <Button
                            size="sm"
                            variant={viewMode === 'graph' ? 'secondary' : 'ghost'}
                            onClick={() => setViewMode('graph')}
                            className="h-7 text-xs px-3"
                        >
                            Graph
                        </Button>
                    </div>
                </CardHeader>

                {viewMode === 'graph' && correlations.length > 0 ? (
                    <div className="flex-1 p-6 min-h-0 flex flex-col">
                        <GraphView />
                    </div>
                ) : (
                    <ScrollArea className="flex-1">
                        <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-4">
                            {correlations.length > 0 ? correlations.map((correlation) => (
                                <div
                                    key={correlation.file.metadata.sha256}
                                    className="group p-4 bg-background border border-border-subtle hover:border-primary/20 rounded-xl transition-all duration-300 flex flex-col gap-3"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3 min-w-0 flex-1">
                                            <div className="h-10 w-10 rounded-lg bg-background-secondary flex items-center justify-center shrink-0 border border-border-subtle mt-0.5">
                                                <Shield className="h-5 w-5 text-foreground-muted/60" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors break-words leading-tight">
                                                    {correlation.file.filename}
                                                </h4>
                                                <p className="text-[10px] font-mono text-muted-foreground mt-1 truncate">
                                                    SHA256: {correlation.file.metadata.sha256}
                                                </p>
                                            </div>
                                        </div>
                                        <div className={cn(
                                            "flex flex-col items-center justify-center h-10 min-w-[3rem] px-2 rounded-lg border text-sm font-bold shrink-0",
                                            getScoreColor(correlation.score)
                                        )}>
                                            <span>{correlation.count}</span>
                                            <span className="text-[8px] uppercase opacity-70">Shared</span>
                                        </div>
                                    </div>

                                    {/* Intersection Preview */}
                                    <div className="space-y-3 pt-1">
                                        <div className="flex items-center gap-2">
                                            <div className="h-1.5 flex-1 bg-background-secondary rounded-full overflow-hidden">
                                                <div
                                                    className={cn("h-full rounded-full transition-all duration-500", getProgressBarColor(correlation.score))}
                                                    style={{ width: `${Math.min(correlation.score, 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-[9px] font-mono text-muted-foreground w-8 text-right">
                                                {correlation.score.toFixed(0)}%
                                            </span>
                                        </div>

                                        <div className="bg-background-secondary/30 rounded-lg p-3 border border-border-subtle/50">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                                                <Info className="h-3 w-3" />
                                                Shared Indicators
                                            </p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {correlation.shared.slice(0, 5).map((ioc, i) => (
                                                    <div key={i} className="px-2 py-1 rounded bg-background border border-border-subtle text-[10px] font-mono text-foreground/80 break-all max-w-full" title={ioc}>
                                                        {ioc}
                                                    </div>
                                                ))}
                                                {correlation.shared.length > 5 && (
                                                    <div className="px-2 py-1 rounded bg-background/50 border border-border-subtle border-dashed text-[10px] font-bold text-muted-foreground">
                                                        +{correlation.shared.length - 5} more
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="w-full h-8 text-[10px] uppercase tracking-widest font-bold bg-background-secondary/50 hover:bg-background-secondary hover:text-primary transition-colors border border-transparent hover:border-border-subtle"
                                            onClick={() => navigate(`/files/${correlation.file.metadata.sha256}`)}
                                        >
                                            Inspect Deviation
                                            <ArrowRight className="ml-2 h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            )) : (
                                <div className="col-span-full py-12 flex flex-col items-center justify-center text-center opacity-40">
                                    <Activity className="h-12 w-12 mb-3 text-emerald-500/20" />
                                    <h4 className="text-sm font-bold uppercase tracking-widest">No Correlations Detected</h4>
                                    <p className="text-xs text-muted-foreground max-w-xs mt-2">
                                        No other files share IOCs with this artifact.
                                    </p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                )}
            </Card>
        </div>
    );
};
