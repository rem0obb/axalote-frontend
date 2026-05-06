import React, { useState, useMemo } from 'react';
import { useFileRecords } from '@/hooks/useEndpointData';
import { ThreatFile } from '@/types/threat.types';
import { useOutletContext } from 'react-router-dom';
import { MainLayoutContextType } from '@/components/layout/MainLayout';
import {
    Network,
    Search,
    ShieldAlert,
    ArrowRight,
    Fingerprint,
    Info,
    Share2,
    FileText,
    Activity,
    AlertTriangle,
    Shield
} from 'lucide-react';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

const ThreatCorrelationView = () => {
    const { navbarPosition } = useOutletContext<MainLayoutContextType>();
    const { data: files = [], isLoading } = useFileRecords();
    const navigate = useNavigate();
    const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const selectedFile = useMemo(() =>
        files.find(f => f.metadata.sha256 === selectedFileId),
        [files, selectedFileId]);

    const filteredFiles = useMemo(() => {
        if (!searchTerm) return files;
        const lower = searchTerm.toLowerCase();
        return files.filter(f =>
            f.filename.toLowerCase().includes(lower) ||
            f.metadata.sha256.toLowerCase().includes(lower)
        );
    }, [files, searchTerm]);

    const correlations = useMemo(() => {
        if (!selectedFile || !selectedFile.iocs || selectedFile.iocs.length === 0) return [];

        const sourceIocs = new Set(selectedFile.iocs);

        return files
            .filter(f => f.metadata.sha256 !== selectedFile.metadata.sha256)
            .map(f => {
                const intersection = f.iocs?.filter(ioc => sourceIocs.has(ioc)) || [];
                const score = f.iocs?.length ? (intersection.length / Math.max(f.iocs.length, sourceIocs.size)) * 100 : 0;

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

    return (
        <div className={cn(
            "flex gap-6 p-1 overflow-hidden animate-in fade-in duration-500",
            navbarPosition === 'top' ? "h-[calc(100vh-56px)]" : "h-full"
        )}>
            {/* Left Column - File Graph Selector */}
            <div className="w-80 flex flex-col gap-4 shrink-0">
                <Card className="flex-1 flex flex-col bg-card/50 backdrop-blur-sm border-border-subtle shadow-lg overflow-hidden">
                    <CardHeader className="py-4 px-4 bg-background-secondary/30 border-b border-border-subtle space-y-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                                <Network className="h-4 w-4 text-primary" />
                                Threat Nodes
                            </CardTitle>
                            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                                {files.length} Samples
                            </Badge>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                placeholder="Search nodes..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="h-9 pl-8 text-xs bg-background/50 border-border-subtle focus-visible:ring-primary/20"
                            />
                        </div>
                    </CardHeader>
                    <ScrollArea className="flex-1">
                        <div className="p-3 space-y-2">
                            {filteredFiles.map(file => {
                                const isSelected = selectedFileId === file.metadata.sha256;
                                return (
                                    <button
                                        key={file.metadata.sha256}
                                        onClick={() => setSelectedFileId(file.metadata.sha256)}
                                        className={cn(
                                            "w-full text-left p-3 rounded-lg border transition-all duration-200 group relative overflow-hidden",
                                            isSelected
                                                ? "bg-primary/5 border-primary/40"
                                                : "bg-card border-transparent hover:bg-background-secondary hover:border-border-subtle"
                                        )}
                                    >
                                        <div className="flex items-center justify-between mb-1.5 relative z-10">
                                            <span className={cn(
                                                "text-xs font-bold truncate max-w-[180px]",
                                                isSelected ? "text-primary" : "text-foreground"
                                            )}>
                                                {file.filename}
                                            </span>
                                            {file.iocs && file.iocs.length > 0 && (
                                                <Badge variant="secondary" className="h-4 px-1 text-[9px] bg-background border-border-subtle text-muted-foreground">
                                                    {file.iocs.length} IOCs
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 relative z-10">
                                            <span className="text-[10px] font-mono text-muted-foreground truncate opacity-70">
                                                {file.metadata.sha256.substring(0, 16)}...
                                            </span>
                                        </div>
                                        {isSelected && (
                                            <div className="absolute inset-0 bg-primary/5 opacity-50 z-0" />
                                        )}
                                    </button>
                                );
                            })}
                            {filteredFiles.length === 0 && (
                                <div className="p-8 text-center text-muted-foreground opacity-50">
                                    <Fingerprint className="h-8 w-8 mx-auto mb-2" />
                                    <p className="text-xs">No nodes found</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </Card>
            </div>

            {/* Right Column - Analysis View */}
            <div className="flex-1 min-w-0 flex flex-col gap-6">
                {!selectedFile ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center opacity-40 bg-card/30 rounded-xl border border-dashed border-border-subtle">
                        <div className="p-6 bg-background rounded-full mb-4 shadow-xl">
                            <Share2 className="h-12 w-12 text-primary/40" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground mb-2">Select a Correlation Node</h3>
                        <p className="text-sm text-foreground-muted max-w-sm">
                            Analyze relationships between artifacts based on shared Indicators of Compromise
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Header Stats */}
                        <div className="flex items-start gap-4 p-5 bg-card border border-border-subtle rounded-xl shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-6 opacity-[0.02]">
                                <Activity size={100} />
                            </div>

                            <div className="h-12 w-12 rounded-lg bg-background-secondary flex items-center justify-center shrink-0 border border-border-subtle">
                                <FileText className="h-6 w-6 text-foreground-muted" />
                            </div>

                            <div className="flex-1 min-w-0 z-10">
                                <h2 className="text-xl font-bold flex items-center gap-3">
                                    {selectedFile.filename}
                                </h2>
                                <div className="flex items-center gap-4 mt-2 text-xs font-mono text-muted-foreground">
                                    <span className="px-2 py-0.5 rounded bg-background border border-border-subtle">
                                        SHA256: {selectedFile.metadata.sha256.substring(0, 12)}...
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <AlertTriangle className="h-3 w-3" />
                                        {selectedFile.iocs?.length || 0} Indicators
                                    </span>
                                </div>
                            </div>

                            <Button
                                onClick={() => navigate(`/files/${selectedFile.metadata.sha256}`)}
                                variant="outline"
                                className="z-10 bg-background hover:bg-background-secondary border-border-subtle text-xs uppercase tracking-widest font-bold h-9"
                            >
                                View Data
                                <ArrowRight className="ml-2 h-3.5 w-3.5" />
                            </Button>
                        </div>

                        {/* Correlation Results */}
                        <Card className="flex-1 flex flex-col min-h-0 bg-card/50 backdrop-blur-sm border-border-subtle shadow-sm">
                            <CardHeader className="py-4 px-6 border-b border-border-subtle flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                                        <Share2 className="h-4 w-4 text-primary" />
                                        Correlated Artifacts
                                    </CardTitle>
                                    <CardDescription className="text-xs mt-1">
                                        Showing {correlations.length} files with shared indicators
                                    </CardDescription>
                                </div>
                            </CardHeader>
                            <ScrollArea className="flex-1">
                                <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-4">
                                    {correlations.map((correlation, idx) => (
                                        <div
                                            key={correlation.file.metadata.sha256}
                                            className="group p-4 bg-background border border-border-subtle hover:border-primary/20 rounded-xl transition-all duration-300"
                                        >
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-lg bg-background-secondary flex items-center justify-center shrink-0 border border-border-subtle">
                                                        <Shield className="h-5 w-5 text-foreground-muted/60" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                                                            {correlation.file.filename}
                                                        </h4>
                                                        <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                                                            {correlation.file.metadata.sha256.substring(0, 32)}...
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className={cn(
                                                    "flex flex-col items-center justify-center h-10 min-w-[3rem] px-2 rounded-lg border text-sm font-bold",
                                                    getScoreColor(correlation.score)
                                                )}>
                                                    <span>{correlation.count}</span>
                                                    <span className="text-[8px] uppercase opacity-70">Shared</span>
                                                </div>
                                            </div>

                                            {/* Intersection Preview */}
                                            <div className="space-y-3">
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

                                                <div className="bg-background-secondary/30 rounded-lg p-2.5 border border-border-subtle/50">
                                                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                                                        <Info className="h-3 w-3" />
                                                        Common Indicators
                                                    </p>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {correlation.shared.slice(0, 3).map((ioc, i) => (
                                                            <div key={i} className="px-2 py-1 rounded bg-background border border-border-subtle text-[10px] font-mono text-foreground/80 truncate max-w-[200px]" title={ioc}>
                                                                {ioc}
                                                            </div>
                                                        ))}
                                                        {correlation.shared.length > 3 && (
                                                            <div className="px-2 py-1 rounded bg-background/50 border border-border-subtle border-dashed text-[10px] font-bold text-muted-foreground">
                                                                +{correlation.shared.length - 3} more
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
                                                    Analyze Deviation
                                                </Button>
                                            </div>
                                        </div>
                                    ))}

                                    {correlations.length === 0 && (
                                        <div className="col-span-full py-12 flex flex-col items-center justify-center text-center opacity-60">
                                            <ShieldAlert className="h-10 w-10 mb-3 text-emerald-500/50" />
                                            <h4 className="text-sm font-bold">Zero Correlation</h4>
                                            <p className="text-xs text-muted-foreground max-w-xs mt-1">
                                                This artifact appears unique with no shared indicators across your current intelligence set.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </Card>
                    </>
                )}
            </div>
        </div>
    );
};

export default ThreatCorrelationView;
