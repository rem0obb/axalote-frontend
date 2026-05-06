import { useState, useEffect, useRef } from 'react';
import { apiService } from '@/services/api.service';
import { Loader2, AlertTriangle, Shield, Eye, EyeOff, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface HtmlPreviewProps {
    sha256?: string;
    data?: Uint8Array | null;
}

export function HtmlPreview({ sha256, data }: HtmlPreviewProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [enableScripts, setEnableScripts] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    useEffect(() => {
        let mounted = true;
        let objectUrl: string | null = null;

        const loadData = async () => {
            setLoading(true);
            setError(null);

            try {
                let bytes: Uint8Array;

                if (data) {
                    bytes = data;
                } else if (sha256) {
                    // Fetch if no direct data provided
                    const response = await apiService.downloadFile(sha256);

                    if (!mounted) return;
                    if (response.error || !response.data) {
                        throw new Error(response.error?.message || 'Failed to load HTML content');
                    }

                    const binaryString = window.atob(response.data.buff);
                    bytes = new Uint8Array(binaryString.length);
                    for (let i = 0; i < binaryString.length; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }
                } else {
                    return; // No source
                }

                // Security Hardening: Inject strict CSP
                // This acts as a second layer of defense on top of iframe sandbox
                // Only apply strict CSP if scripts are NOT enabled by the user
                const csp = enableScripts
                    ? ''
                    : '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'none\'; object-src \'none\'; base-uri \'none\';">';

                // Create Blob URL for safer and more reliable rendering
                // Prepend CSP to the content
                const blob = new Blob([csp, bytes], { type: 'text/html; charset=utf-8' });
                objectUrl = URL.createObjectURL(blob);

                if (mounted) {
                    setPreviewUrl(objectUrl);
                    setLoading(false);
                }
            } catch (err: any) {
                console.error("HtmlPreview load error:", err);
                if (mounted) {
                    setError(err.message || 'Error loading content');
                    setLoading(false);
                }
            }
        };

        loadData();

        return () => {
            mounted = false;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [sha256, data, enableScripts]);

    const sandboxParams = enableScripts
        ? "allow-scripts allow-same-origin allow-forms allow-popups"
        : "";

    if (loading) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center space-y-4 p-8 bg-card border border-border-subtle rounded-lg">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <div className="text-center">
                    <h3 className="text-sm font-bold text-foreground">Loading HTML Preview</h3>
                    <p className="text-xs text-foreground-muted">Rendering safe view...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center p-8 bg-card border border-border-subtle rounded-lg">
                <AlertTriangle className="h-10 w-10 text-destructive mb-2 opacity-80" />
                <p className="text-sm text-foreground-muted mb-4">{error}</p>
                <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Retry</Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full overflow-hidden">
            {/* Toolbar */}
            <div className="bg-background-secondary/40 border-b border-border-subtle px-4 py-2 flex items-center justify-between shrink-0 h-14">
                <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${enableScripts ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                        {enableScripts ? (
                            <Eye className="h-4 w-4 text-destructive" />
                        ) : (
                            <Shield className="h-4 w-4 text-primary" />
                        )}
                    </div>
                    <div>
                        <span className="text-sm font-bold text-foreground block leading-none">Safe Preview</span>
                        <span className="text-[10px] text-foreground-muted font-medium uppercase tracking-wider">
                            Sandbox: <span className={enableScripts ? "text-destructive font-bold" : "text-success font-bold"}>
                                {enableScripts ? "WEAKENED" : "ACTIVE"}
                            </span>
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-background-secondary/50 px-3 py-1.5 rounded-full border border-border-subtle/30">
                    <div className="flex items-center gap-2">
                        <Switch
                            id="script-toggle"
                            checked={enableScripts}
                            onCheckedChange={setEnableScripts}
                            className="scale-75 data-[state=checked]:bg-destructive"
                        />
                        <Label htmlFor="script-toggle" className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted cursor-pointer">
                            Enable Scripts
                        </Label>
                    </div>
                    {enableScripts && (
                        <div className="flex items-center gap-1.5 text-destructive animate-pulse">
                            <AlertTriangle className="h-3 w-3" />
                            <span className="text-[9px] font-black uppercase">Unsafe</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Iframe Container */}
            <div className="flex-1 min-h-0 bg-white relative">
                <iframe
                    ref={iframeRef}
                    key={enableScripts ? 'unsafe' : 'safe'} // Force re-render on toggle
                    src={previewUrl || ''}
                    className="w-full h-full border-none"
                    sandbox={sandboxParams}
                    title="HTML Preview"
                />
            </div>
        </div>
    );
}
