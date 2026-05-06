import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, FolderInput, Plus, FileUp, Trash2 } from 'lucide-react';
import { apiService } from '@/services/api.service';
import { toast } from 'sonner';
import { UploadQueue, UploadFileItem } from './UploadQueue';
import { v4 as uuidv4 } from 'uuid';

interface FileUploadDialogProps {
    onUploadSuccess?: () => void;
}

export function FileUploadDialog({ onUploadSuccess }: FileUploadDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [queue, setQueue] = useState<UploadFileItem[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);

    // Hidden inputs refs
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const scanFiles = async (entry: any): Promise<File[]> => {
        if (entry.isFile) {
            return new Promise((resolve) => {
                entry.file((file: File) => {
                    resolve([file]);
                });
            });
        } else if (entry.isDirectory) {
            const reader = entry.createReader();
            return new Promise((resolve) => {
                reader.readEntries(async (entries: any[]) => {
                    const files = await Promise.all(entries.map(scanFiles));
                    resolve(files.flat());
                });
            });
        }
        return [];
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);

        const items = e.dataTransfer.items;
        if (!items) return;

        const newFiles: File[] = [];
        const promises = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            // @ts-ignore - webkitGetAsEntry is standard in modern browsers for this API
            const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
            if (entry) {
                promises.push(scanFiles(entry));
            } else if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) newFiles.push(file);
            }
        }

        const results = await Promise.all(promises);
        const allFiles = [...newFiles, ...results.flat()];

        if (allFiles.length > 0) {
            addToQueue(allFiles);
        }
    };

    const addToQueue = (files: File[]) => {
        // No file size limits - accept all files
        const newItems: UploadFileItem[] = files.map(f => ({
            id: uuidv4(),
            file: f,
            status: 'pending',
            progress: 0
        }));

        setQueue(prev => [...prev, ...newItems]);
        toast.info(`Added ${validFiles.length} file(s) to queue`);
    };



    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            addToQueue(Array.from(e.target.files));
        }
        // Reset the input value to allow selecting the same file/folder again
        e.target.value = '';
    };

    const processQueue = async () => {
        setIsProcessing(true);
        const CONCURRENCY_LIMIT = 5;

        // Helper to process a single item
        const processItem = async (item: UploadFileItem) => {
            // Update status to uploading
            setQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'uploading' } : i));

            try {
                // Convert to base64
                const base64String = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const res = (reader.result as string).split(',')[1];
                        resolve(res);
                    };
                    reader.onerror = (error) => {
                        reject(new Error(`Failed to read file: ${item.file.name}`));
                    };
                    reader.readAsDataURL(item.file);
                });

                // Upload
                const response = await apiService.uploadFile(base64String, item.file.name);

                if (response.error) {
                    throw new Error(response.error.message);
                }

                // Success
                setQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'success', progress: 100 } : i));

            } catch (err: any) {
                // Error with better message
                const errorMsg = err.message || 'Upload failed';
                console.error(`Upload error for ${item.file.name}:`, err);
                setQueue(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: errorMsg } : i));
            }
        };

        const pendingItems = queue.filter(i => i.status === 'pending');
        let index = 0;
        const activePromises: Promise<void>[] = [];

        while (index < pendingItems.length || activePromises.length > 0) {
            // Fill the active queue up to the limit
            while (activePromises.length < CONCURRENCY_LIMIT && index < pendingItems.length) {
                const item = pendingItems[index];
                const promise = processItem(item).then(() => {
                    // Remove self from active promises when done
                    activePromises.splice(activePromises.indexOf(promise), 1);
                });
                activePromises.push(promise);
                index++;
            }

            // Wait for at least one to finish before continuing the loop
            if (activePromises.length > 0) {
                await Promise.race(activePromises);
            }
        }

        setIsProcessing(false);
        const successCount = pendingItems.length; // Approximate
        if (successCount > 0) {
            onUploadSuccess?.();
        }
    };

    const handleClearQueue = () => {
        setQueue([]);
    };

    const removeQueueItem = (id: string) => {
        setQueue(prev => prev.filter(i => i.id !== id));
    };

    const pendingCount = queue.filter(i => i.status === 'pending').length;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button className="gap-2 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30">
                    <FileUp className="h-4 w-4" />
                    <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">Upload</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl bg-card border-border-subtle overflow-hidden flex flex-col max-h-[85vh]">
                <DialogHeader className="border-b border-border-subtle/50 pb-4">
                    <DialogTitle className="flex items-center gap-2">
                        <Upload className="h-5 w-5 text-primary" />
                        Upload Center
                    </DialogTitle>
                    <DialogDescription className="text-xs font-bold uppercase tracking-widest text-foreground-muted">
                        Bulk ingest files or directories for analysis
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 flex flex-col gap-4 py-4 min-h-0">
                    {/* Drop Zone */}
                    <div
                        className={`
                            shrink-0 relative overflow-hidden transition-all duration-300 rounded-xl border-2 border-dashed
                            flex flex-col items-center justify-center p-8 text-center cursor-pointer group
                            ${isDragOver ? 'border-primary bg-primary/10 scale-[1.01]' : 'border-border-subtle bg-background-secondary/30 hover:bg-background-secondary/50 hover:border-primary/50'}
                        `}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <div className={`p-4 rounded-full bg-background-secondary mb-4 transition-transform duration-500 ${isDragOver ? 'rotate-12 scale-110' : 'group-hover:scale-110'}`}>
                            {isDragOver ? (
                                <FolderInput className="h-8 w-8 text-primary" />
                            ) : (
                                <Upload className="h-8 w-8 text-foreground-muted group-hover:text-primary transition-colors" />
                            )}
                        </div>
                        <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                            {isDragOver ? 'Drop Artifacts Here' : 'Drag & Drop Files or Folders'}
                        </h3>
                        <p className="text-xs text-foreground-muted mt-2 max-w-sm">
                            Support for recursive directory scanning. Automatically handles encoding and ingestion queue.
                        </p>

                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            className="hidden"
                            onChange={handleFileSelect}
                        />
                    </div>

                    {/* Queue Display */}
                    <div className="flex-1 min-h-0 flex flex-col">
                        <UploadQueue items={queue} onRemove={removeQueueItem} />
                    </div>
                </div>

                <DialogFooter className="bg-background-secondary/30 border-t border-border-subtle/50 pt-4 -mx-6 px-6 -mb-6 pb-6 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        {queue.length > 0 && (
                            <Button variant="ghost" size="sm" onClick={handleClearQueue} disabled={isProcessing} className="text-xs text-destructive hover:bg-destructive/10 h-8">
                                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear Queue
                            </Button>
                        )}
                        <span className="text-[10px] text-foreground-muted font-mono">
                            {queue.length} items staged
                        </span>
                    </div>

                    <div className="flex gap-3">
                        <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isProcessing} className="text-xs h-9">
                            Close
                        </Button>
                        <Button
                            onClick={processQueue}
                            disabled={queue.length === 0 || isProcessing || pendingCount === 0}
                            className="text-xs font-bold uppercase tracking-widest h-9 min-w-[120px]"
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Processing...
                                </>
                            ) : (
                                <>
                                    <FileUp className="mr-2 h-3.5 w-3.5" /> Start Upload
                                </>
                            )}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
