import { useState, useEffect } from 'react';
import {
    X, ExternalLink, Download, Loader2, AlertTriangle, CheckCircle,
    Shield, Clock, BarChart3, Tag, Hash, FileType, RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiService } from '@/services/api.service';
import { toast } from 'sonner';
import { VTFileReport } from '@/types/threat.types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { VirusTotalIcon } from '@/components/icons/VirusTotalIcon';
import { Progress } from '@/components/ui/progress';
import { openExternalLink } from '@/lib/runtime';

interface VTResultPanelProps {
    hash: string;
    open: boolean;
    onClose: () => void;
    onDownloadComplete?: (sha256: string) => void;
}

function Skeleton({ className }: { className?: string }) {
    return (
        <div className={cn('animate-pulse bg-foreground/5 rounded-md', className)} />
    );
}

export function VTResultPanel({ hash, open, onClose, onDownloadComplete }: VTResultPanelProps) {
    const [vtData, setVtData] = useState<VTFileReport | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        if (!open || !hash) return;
        setVtData(null);
        setError(null);
        loadData();
    }, [open, hash]);

    const loadData = async () => {
        setLoading(true);
        try {
            const response = await apiService.vtGetFileInfo(hash);
            if (response.error || !response.data) {
                setError(response.error?.message || 'Failed to fetch VirusTotal data');
                return;
            }
            // Handle various response shapes
            const raw = response.data;
            let attrs: VTFileReport | null = null;
            if (raw?.data?.data?.attributes) attrs = raw.data.data.attributes;
            else if (raw?.data?.attributes) attrs = raw.data.attributes;
            else if (raw?.attributes) attrs = raw.attributes;
            else { setError('Unknown response structure'); return; }
            setVtData(attrs);
        } catch (err: any) {
            setError(err.message || 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async () => {
        setDownloading(true);
        const toastId = toast.custom((t) => (
            <div className="bg-background-secondary border border-border-subtle p-4 rounded-xl shadow-2xl min-w-[320px] space-y-3 animate-in slide-in-from-bottom duration-300">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Download className="h-5 w-5 text-primary animate-bounce" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-foreground">Downloading from VT</p>
                        <p className="text-[10px] text-foreground-muted truncate">Requesting file from VirusTotal to Engine...</p>
                    </div>
                </div>
                <Progress value={0} className="h-1.5 bg-background-primary/50" indicatorClassName="bg-primary" id={`vt-progress-${hash}`} />
            </div>
        ), { duration: Infinity });

        const updateProgress = (progress: number) => {
            const progressBar = document.getElementById(`vt-progress-${hash}`);
            if (progressBar && progressBar.firstElementChild) {
                (progressBar.firstElementChild as HTMLElement).style.transform = `translateX(-${100 - progress}%)`;
            }
        };

        try {
            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.random() * 15;
                if (progress > 90) progress = 90;
                updateProgress(progress);
            }, 600);

            const response = await apiService.vtDownloadFile(hash);
            
            clearInterval(interval);
            updateProgress(100);
            
            // Short delay to show 100% before closing
            await new Promise(resolve => setTimeout(resolve, 500));
            toast.dismiss(toastId);

            if (response.error || !response.data) {
                toast.error(response.error?.message || 'Download failed');
                return;
            }
            if (response.data.success) {
                toast.success(`Download complete: ${response.data.filename || hash.substring(0, 16)}...`);
                onDownloadComplete?.(response.data.sha256 || hash);
            } else {
                toast.error(response.data.message || response.data.error || 'Download failed');
            }
        } catch (err: any) {
            toast.dismiss(toastId);
            toast.error(err.message || 'Download error');
        } finally {
            setDownloading(false);
        }
    };

    if (!open) return null;

    // Stats derived
    const stats = vtData?.last_analysis_stats;
    const results = vtData?.last_analysis_results || {};
    const totalEngines = Object.keys(results).length;
    const malicious = stats?.malicious ?? 0;
    const suspicious = stats?.suspicious ?? 0;
    const clean = (stats?.harmless ?? 0) + (stats?.undetected ?? 0);
    const detectionCount = malicious + suspicious;
    const detectionPct = totalEngines > 0 ? (detectionCount / totalEngines) * 100 : 0;
    const isThreat = detectionCount > 0;

    return (
        <>
            {/* Overlay */}
            <div
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="fixed top-0 right-0 h-full w-[420px] max-w-[95vw] bg-background-secondary border-l border-border-subtle z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle bg-background-secondary/80 backdrop-blur shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                            <VirusTotalIcon className="h-4 w-4 text-blue-500" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-foreground">VirusTotal Result</h2>
                            <p className="text-[10px] font-mono text-foreground-muted truncate max-w-[260px]">
                                {hash}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={loadData}
                            disabled={loading}
                            className="h-7 w-7 flex items-center justify-center rounded-md text-foreground-muted hover:text-foreground hover:bg-background transition-colors"
                            title="Reload"
                        >
                            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                        </button>
                        <button
                            onClick={onClose}
                            className="h-7 w-7 flex items-center justify-center rounded-md text-foreground-muted hover:text-foreground hover:bg-background transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">

                    {/* Loading skeleton */}
                    {loading && (
                        <div className="p-5 space-y-5">
                            <div className="space-y-3">
                                <Skeleton className="h-20 w-full" />
                                <div className="grid grid-cols-3 gap-3">
                                    <Skeleton className="h-16" />
                                    <Skeleton className="h-16" />
                                    <Skeleton className="h-16" />
                                </div>
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-32 w-full" />
                            </div>
                        </div>
                    )}

                    {/* Error state */}
                    {!loading && error && (
                        <div className="p-5 flex flex-col items-center justify-center gap-4 h-48">
                            <div className="p-3 rounded-full bg-destructive/10">
                                <AlertTriangle className="h-6 w-6 text-destructive" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-bold text-foreground mb-1">Failed to load</p>
                                <p className="text-xs text-foreground-muted">{error}</p>
                            </div>
                            <Button size="sm" onClick={loadData} variant="outline" className="gap-2">
                                <RefreshCw className="h-3.5 w-3.5" /> Try again
                            </Button>
                        </div>
                    )}

                    {/* Data */}
                    {!loading && vtData && (
                        <div className="p-5 space-y-5">

                            {/* Verdict Banner */}
                            <div className={cn(
                                'rounded-xl p-4 border flex items-center gap-4',
                                isThreat
                                    ? 'bg-destructive/5 border-destructive/20'
                                    : 'bg-emerald-500/5 border-emerald-500/20'
                            )}>
                                <div className={cn(
                                    'p-3 rounded-xl shrink-0',
                                    isThreat ? 'bg-destructive/10' : 'bg-emerald-500/10'
                                )}>
                                    {isThreat
                                        ? <AlertTriangle className="h-6 w-6 text-destructive" />
                                        : <CheckCircle className="h-6 w-6 text-emerald-500" />
                                    }
                                </div>
                                <div className="min-w-0">
                                    <p className={cn(
                                        'text-sm font-black uppercase tracking-wide',
                                        isThreat ? 'text-destructive' : 'text-emerald-500'
                                    )}>
                                        {isThreat ? 'Threat Detected' : 'Clean File'}
                                    </p>
                                    <p className="text-[11px] text-foreground-muted mt-0.5">
                                        {detectionCount} of {totalEngines} engines detected
                                    </p>
                                    {vtData.popular_threat_classification?.suggested_threat_label && (
                                        <span className="inline-block mt-1.5 px-2 py-0.5 rounded-md bg-destructive/10 border border-destructive/20 text-[10px] font-bold text-destructive uppercase tracking-wider">
                                            {vtData.popular_threat_classification.suggested_threat_label}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Detection Stats Grid */}
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { label: 'Malicious', value: malicious, color: 'text-red-500', bg: 'bg-red-500/5 border-red-500/20' },
                                    { label: 'Suspicious', value: suspicious, color: 'text-yellow-500', bg: 'bg-yellow-500/5 border-yellow-500/20' },
                                    { label: 'Clean', value: clean, color: 'text-emerald-500', bg: 'bg-emerald-500/5 border-emerald-500/20' },
                                ].map(s => (
                                    <div key={s.label} className={cn('p-3 rounded-lg border text-center', s.bg)}>
                                        <p className={cn('text-xl font-black', s.color)}>{s.value}</p>
                                        <p className="text-[9px] uppercase tracking-widest text-foreground-muted font-bold mt-0.5">{s.label}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Detection Rate Bar */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-foreground-muted flex items-center gap-1.5">
                                        <BarChart3 className="h-3 w-3" /> Detection Rate
                                    </span>
                                    <span className="text-xs font-bold text-foreground">
                                        {detectionCount}/{totalEngines} ({detectionPct.toFixed(1)}%)
                                    </span>
                                </div>
                                <Progress value={detectionPct} className="h-1.5" />
                            </div>

                            {/* Popular Threat Names */}
                            {vtData.popular_threat_classification?.popular_threat_name &&
                                vtData.popular_threat_classification.popular_threat_name.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-foreground-muted flex items-center gap-1.5">
                                            <Tag className="h-3 w-3" /> Popular Names
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {vtData.popular_threat_classification.popular_threat_name.slice(0, 6).map((t, i) => (
                                                <Badge key={i} variant="secondary" className="text-[9px] font-bold px-2 py-0.5 bg-background border-border-subtle">
                                                    {t.value} <span className="opacity-50 ml-1">×{t.count}</span>
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}

                            {/* Divider */}
                            <div className="h-px bg-border-subtle/50" />

                            {/* File Properties */}
                            <div className="space-y-2">
                                <p className="text-[9px] font-black uppercase tracking-widest text-foreground-muted flex items-center gap-1.5">
                                    <Hash className="h-3 w-3" /> Properties
                                </p>
                                <div className="bg-background/40 rounded-lg border border-border-subtle/50 divide-y divide-border-subtle/30">
                                    {[
                                        { label: 'Type', value: vtData.type_description || vtData.type_tag || '—', icon: FileType },
                                        { label: 'Size', value: vtData.size ? (vtData.size < 1024 ? `${vtData.size} B` : vtData.size < 1048576 ? `${(vtData.size / 1024).toFixed(1)} KB` : `${(vtData.size / 1048576).toFixed(2)} MB`) : '—', icon: BarChart3 },
                                        { label: 'First Submission', value: vtData.first_submission_date ? new Date(vtData.first_submission_date * 1000).toLocaleDateString('en-US') : '—', icon: Clock },
                                        { label: 'Submissions', value: String(vtData.times_submitted ?? '—'), icon: RefreshCw },
                                        { label: 'Reputation', value: String(vtData.reputation ?? '—'), icon: Shield },
                                    ].map(({ label, value, icon: Icon }) => (
                                        <div key={label} className="flex items-center justify-between px-3 py-2">
                                            <span className="text-[10px] text-foreground-muted flex items-center gap-1.5">
                                                <Icon className="h-3 w-3 opacity-50" /> {label}
                                            </span>
                                            <span className="text-[10px] font-medium text-foreground font-mono">{value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Tags */}
                            {vtData.tags && vtData.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {vtData.tags.map((t, i) => (
                                        <Badge key={i} variant="outline" className="text-[9px] px-1.5 py-0 h-5 border-border-subtle text-foreground-muted">
                                            {t}
                                        </Badge>
                                    ))}
                                </div>
                            )}

                            {/* Names */}
                            {vtData.names && vtData.names.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-foreground-muted">Other Names</p>
                                    <div className="bg-background/40 rounded-lg border border-border-subtle/50 p-3 space-y-1 max-h-28 overflow-y-auto custom-scrollbar">
                                        {vtData.names.slice(0, 15).map((n, i) => (
                                            <p key={i} className="text-[10px] font-mono text-foreground-muted truncate">{n}</p>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Engine Results Collapsible */}
                            <details className="group">
                                <summary className="cursor-pointer text-[9px] font-black uppercase tracking-widest text-foreground-muted hover:text-primary transition-colors flex items-center gap-1.5">
                                    <Shield className="h-3 w-3" />
                                    Results by Engine ({totalEngines})
                                </summary>
                                <div className="mt-3 max-h-64 overflow-y-auto custom-scrollbar space-y-0.5">
                                    {Object.entries(results).filter(([, r]) => r.category === 'malicious' || r.category === 'suspicious').map(([key, r]) => (
                                        <div key={key} className="flex items-center justify-between px-2 py-1.5 rounded-md bg-destructive/5 border border-destructive/10">
                                            <span className="text-[10px] font-medium text-foreground">{r.engine_name}</span>
                                            <span className="text-[10px] font-bold text-destructive">{r.result || r.category}</span>
                                        </div>
                                    ))}
                                    {Object.entries(results).filter(([, r]) => r.category !== 'malicious' && r.category !== 'suspicious').slice(0, 30).map(([key, r]) => (
                                        <div key={key} className="flex items-center justify-between px-2 py-1 rounded-md hover:bg-background-secondary/50 transition-colors">
                                            <span className="text-[10px] text-foreground-muted">{r.engine_name}</span>
                                            <span className="text-[10px] text-foreground-muted/50">{r.category}</span>
                                        </div>
                                    ))}
                                </div>
                            </details>

                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-border-subtle bg-background-secondary/50 space-y-2 shrink-0">
                    <Button
                        onClick={handleDownload}
                        disabled={downloading || loading}
                        className="w-full gap-2 font-bold bg-primary hover:bg-primary/90"
                    >
                        {downloading
                            ? <><Loader2 className="h-4 w-4 animate-spin" /> Downloading via Engine...</>
                            : <><Download className="h-4 w-4" /> Download via Engine</>
                        }
                    </Button>
                    <Button
                        variant="outline"
                        className="w-full gap-2 border-border-subtle"
                        onClick={() => void openExternalLink(`https://www.virustotal.com/gui/file/${hash}`)}
                    >
                        <ExternalLink className="h-4 w-4" />
                        View on VirusTotal
                    </Button>
                </div>
            </div>
        </>
    );
}

export default VTResultPanel;
