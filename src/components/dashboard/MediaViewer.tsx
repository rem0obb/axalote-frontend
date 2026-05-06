
import { useState, useEffect } from 'react';
import { apiService } from '@/services/api.service';
import { Loader2, AlertTriangle, Image as ImageIcon, FileText, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MediaViewerProps {
    sha256: string;
    mimeType: string;
    filename?: string;
}

export function MediaViewer({ sha256, mimeType, filename }: MediaViewerProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);

    const isImage = mimeType.startsWith('image/');
    const isPdf = mimeType === 'application/pdf';

    useEffect(() => {
        let mounted = true;

        const fetchData = async () => {
            if (!sha256) return;
            setLoading(true);
            setError(null);

            try {
                const response = await apiService.downloadFile(sha256);

                if (!mounted) return;

                if (response.error || !response.data) {
                    throw new Error(response.error?.message || 'Failed to load file content');
                }

                const binaryString = window.atob(response.data.buff);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }

                const blob = new Blob([bytes], { type: mimeType });
                const url = URL.createObjectURL(blob);

                if (mounted) {
                    setBlobUrl(url);
                    setLoading(false);
                }
            } catch (err: any) {
                console.error("MediaViewer load error:", err);
                if (mounted) {
                    setError(err.message || 'Error loading media');
                    setLoading(false);
                }
            }
        };

        fetchData();

        return () => {
            mounted = false;
            if (blobUrl) {
                URL.revokeObjectURL(blobUrl);
            }
        };
    }, [sha256, mimeType]);

    // Zoom controls for images
    const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.5, 5));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.5, 0.5));
    const handleReset = () => { setZoom(1); setRotation(0); };
    const handleRotate = () => setRotation(prev => (prev + 90) % 360);

    if (loading) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center space-y-4 p-8">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <div className="text-center">
                    <h3 className="text-sm font-bold text-foreground">Loading Media</h3>
                    <p className="text-xs text-foreground-muted">Fetching content...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center p-8">
                <AlertTriangle className="h-10 w-10 text-destructive mb-2 opacity-80" />
                <p className="text-sm text-foreground-muted mb-4">{error}</p>
                <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Retry</Button>
            </div>
        );
    }

    if (!blobUrl) return null;

    return (
        <div className="h-full w-full flex flex-col bg-background/50 relative overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle bg-background-secondary/20">
                <div className="flex items-center gap-2">
                    {isImage ? <ImageIcon className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-primary" />}
                    <span className="text-xs font-bold text-foreground-muted">{filename || 'Media Preview'}</span>
                </div>

                {isImage && (
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={handleZoomOut} className="h-7 w-7"><ZoomOut className="h-3.5 w-3.5" /></Button>
                        <span className="text-[10px] w-8 text-center">{Math.round(zoom * 100)}%</span>
                        <Button variant="ghost" size="icon" onClick={handleZoomIn} className="h-7 w-7"><ZoomIn className="h-3.5 w-3.5" /></Button>
                        <div className="h-4 w-px bg-border-subtle mx-1" />
                        <Button variant="ghost" size="icon" onClick={handleRotate} className="h-7 w-7"><RotateCcw className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="sm" onClick={handleReset} className="ml-1 text-[10px] h-7 px-2">Reset</Button>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 w-full h-full overflow-auto flex items-center justify-center bg-black/5 p-4 relative">
                {isImage && (
                    <img
                        src={blobUrl}
                        alt={filename}
                        className="max-w-none transition-transform duration-200 ease-out"
                        style={{
                            transform: `scale(${zoom}) rotate(${rotation}deg)`,
                            boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
                        }}
                    />
                )}

                {isPdf && (
                    <iframe
                        src={blobUrl}
                        className="w-full h-full border-none rounded-lg shadow-sm bg-white"
                        title="PDF Viewer"
                    />
                )}

                {!isImage && !isPdf && (
                    <div className="text-center text-foreground-muted">
                        <p>Preview format not supported directly.</p>
                        <a href={blobUrl} download={filename} className="text-primary hover:underline text-xs mt-2 block">Download to view</a>
                    </div>
                )}
            </div>
        </div>
    );
}
