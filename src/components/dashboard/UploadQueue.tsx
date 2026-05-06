import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileIcon, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

export interface UploadFileItem {
    id: string;
    file: File;
    status: 'pending' | 'uploading' | 'success' | 'error';
    error?: string;
    progress: number;
}

interface UploadQueueProps {
    items: UploadFileItem[];
    onRemove: (id: string) => void;
}

export const UploadQueue: React.FC<UploadQueueProps> = ({ items, onRemove }) => {
    if (items.length === 0) return null;

    const totalProgress = items.length > 0
        ? (items.filter(i => i.status === 'success').length / items.length) * 100
        : 0;

    const pendingCount = items.filter(i => i.status === 'pending').length;
    const uploadingCount = items.filter(i => i.status === 'uploading').length;
    const successCount = items.filter(i => i.status === 'success').length;
    const errorCount = items.filter(i => i.status === 'error').length;

    return (
        <div className="flex flex-col h-full bg-background-secondary/20 rounded-lg border border-border-subtle overflow-hidden">
            <div className="px-4 py-3 border-b border-border-subtle bg-background-secondary/50 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-widest text-foreground-muted">
                        Queue Processor
                    </h3>
                    <span className="text-[10px] font-mono text-foreground-muted">
                        {successCount}/{items.length} Done
                    </span>
                </div>
                <Progress value={totalProgress} className="h-1 bg-background" />
                <div className="flex gap-2 text-[9px] uppercase font-bold text-foreground-muted/60">
                    {uploadingCount > 0 && <span className="text-primary">{uploadingCount} Active</span>}
                    {pendingCount > 0 && <span>{pendingCount} Pending</span>}
                    {errorCount > 0 && <span className="text-destructive">{errorCount} Failed</span>}
                </div>
            </div>

            <ScrollArea className="flex-1 min-h-[200px] max-h-[300px]">
                <div className="p-2 space-y-2">
                    {items.map((item) => (
                        <div
                            key={item.id}
                            className={cn(
                                "group flex items-center gap-3 p-2 rounded-md border text-sm transition-all animate-in fade-in slide-in-from-left-2 duration-300",
                                item.status === 'pending' && "bg-background border-border-subtle opacity-70",
                                item.status === 'uploading' && "bg-primary/5 border-primary/20",
                                item.status === 'success' && "bg-green-500/5 border-green-500/20 opacity-80",
                                item.status === 'error' && "bg-destructive/5 border-destructive/20"
                            )}
                        >
                            <div className="shrink-0">
                                {item.status === 'uploading' ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                ) : item.status === 'success' ? (
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : item.status === 'error' ? (
                                    <AlertCircle className="h-4 w-4 text-destructive" />
                                ) : (
                                    <FileIcon className="h-4 w-4 text-foreground-muted" />
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                    <p className="font-medium truncate text-xs text-foreground/90" title={item.file.name}>
                                        {item.file.webkitRelativePath || item.file.name}
                                    </p>
                                    {item.status === 'error' && (
                                        <span className="text-[10px] text-destructive truncate max-w-[100px]" title={item.error}>
                                            {item.error}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center justify-between mt-1">
                                    <span className="text-[10px] text-foreground-muted font-mono">
                                        {(item.file.size / 1024).toFixed(1)} KB
                                    </span>
                                    {item.status === 'uploading' && (
                                        <span className="text-[9px] uppercase tracking-wider font-bold text-primary animate-pulse">
                                            Encoding...
                                        </span>
                                    )}
                                </div>
                            </div>

                            {item.status !== 'uploading' && (
                                <button
                                    onClick={() => onRemove(item.id)}
                                    className="p-1 text-foreground-muted hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
};
