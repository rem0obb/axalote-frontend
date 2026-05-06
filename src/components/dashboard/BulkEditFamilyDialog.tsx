import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Folder, AlertTriangle } from "lucide-react";
import { apiService } from "@/services/api.service";
import { toast } from "sonner";
import { ThreatFile } from "@/types/threat.types";

interface BulkEditFamilyDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentFamily: string;
    files: ThreatFile[];
    onSuccess?: () => void;
}

export function BulkEditFamilyDialog({ open, onOpenChange, currentFamily, files, onSuccess }: BulkEditFamilyDialogProps) {
    const [newFamily, setNewFamily] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (open) {
            setNewFamily(currentFamily);
            setProgress(0);
        }
    }, [open, currentFamily]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!files.length) return;

        const cleanFamily = newFamily.trim().toLowerCase();
        
        if (cleanFamily === currentFamily) {
            toast.info("New family name is the same as current");
            return;
        }

        setIsSubmitting(true);
        setProgress(0);

        try {
            let successCount = 0;
            let failCount = 0;

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                try {
                    const response = await apiService.updateFileMetadata(file.metadata.sha256, { family: cleanFamily });
                    
                    if (response.error) {
                        throw new Error(response.error.message);
                    }
                    
                    successCount++;
                } catch (error) {
                    console.error(`Failed to update ${file.filename}:`, error);
                    failCount++;
                }
                
                setProgress(Math.round(((i + 1) / files.length) * 100));
            }

            if (failCount === 0) {
                toast.success(`Successfully renamed ${successCount} file(s) from "${currentFamily}" to "${cleanFamily}"`);
            } else {
                toast.warning(`Updated ${successCount} file(s), ${failCount} failed`);
            }
            
            onSuccess?.();
            onOpenChange(false);
        } catch (error: any) {
            toast.error(error.message || "Failed to update family");
        } finally {
            setIsSubmitting(false);
            setProgress(0);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] bg-card border-border-subtle">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Folder className="h-5 w-5 text-primary" />
                        Rename Family (Bulk)
                    </DialogTitle>
                    <DialogDescription>
                        This will rename all {files.length} file(s) in the "{currentFamily}" family.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                            <p className="text-xs text-foreground-muted">
                                This action will update all files in this family. This cannot be undone.
                            </p>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="current-family" className="text-xs text-foreground-muted">
                                Current Family
                            </Label>
                            <Input
                                id="current-family"
                                value={currentFamily}
                                disabled
                                className="bg-background-secondary/50"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="new-family" className="text-xs text-foreground-muted">
                                New Family Name
                            </Label>
                            <Input
                                id="new-family"
                                value={newFamily}
                                onChange={(e) => setNewFamily(e.target.value)}
                                placeholder="e.g. trojan.win32"
                                autoFocus
                                disabled={isSubmitting}
                            />
                            <p className="text-[10px] text-foreground-muted/60">
                                Family names are automatically converted to lowercase
                            </p>
                        </div>

                        {isSubmitting && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-foreground-muted">Updating files...</span>
                                    <span className="text-primary font-bold">{progress}%</span>
                                </div>
                                <div className="h-2 bg-background-secondary rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-primary transition-all duration-300"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting || !newFamily.trim()}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Rename {files.length} File(s)
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
