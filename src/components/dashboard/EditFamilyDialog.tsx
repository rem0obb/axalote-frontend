import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { apiService } from "@/services/api.service";
import { toast } from "sonner";
import { ThreatFile } from "@/types/threat.types";

interface EditFamilyDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    file: ThreatFile | null;
    onSuccess?: () => void;
}

export function EditFamilyDialog({ open, onOpenChange, file, onSuccess }: EditFamilyDialogProps) {
    const [family, setFamily] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (file) {
            setFamily(file.family || "");
        }
    }, [file]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) return;

        setIsSubmitting(true);
        try {
            const cleanFamily = family.trim().toLowerCase();
            const response = await apiService.updateFileMetadata(file.metadata.sha256, { family: cleanFamily });

            if (response.error) {
                throw new Error(response.error.message);
            }

            toast.success("Family updated successfully");
            onSuccess?.();
            onOpenChange(false);
        } catch (error: any) {
            toast.error(error.message || "Failed to update family");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] bg-card border-border-subtle">
                <DialogHeader>
                    <DialogTitle>Edit File Family</DialogTitle>
                    <DialogDescription>
                        Group files by assigning them to a family. Families are always lowercase.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="family" className="text-right">
                                Family
                            </Label>
                            <Input
                                id="family"
                                value={family}
                                onChange={(e) => setFamily(e.target.value)}
                                className="col-span-3"
                                placeholder="e.g. trojan.win32"
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button 
                            type="submit" 
                            disabled={isSubmitting}
                            variant="outline"
                        >
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
