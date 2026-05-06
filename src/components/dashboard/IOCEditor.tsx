import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Trash2, AlertTriangle, Shield, CheckCircle, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface IOCEditorProps {
    initialIocs: string[] | string;
    onSave: (newIocs: string[]) => void;
    onCancel: () => void;
    isSaving?: boolean;
}

export const IOCEditor: React.FC<IOCEditorProps> = ({ initialIocs, onSave, onCancel, isSaving = false }) => {
    const [iocs, setIocs] = useState<string[]>([]);
    const [inputValue, setInputValue] = useState('');

    useEffect(() => {
        if (Array.isArray(initialIocs)) {
            setIocs([...initialIocs]);
        } else if (typeof initialIocs === 'string') {
            setIocs(initialIocs.split(',').map(s => s.trim()).filter(Boolean));
        } else {
            setIocs([]);
        }
    }, [initialIocs]);

    const handleAdd = () => {
        const val = inputValue.trim();
        if (!val) return;

        // Check for duplicates
        if (iocs.includes(val)) {
            toast.error("Indicator already exists in the list");
            return;
        }

        setIocs([val, ...iocs]);
        setInputValue('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData('text');

        // Split by newlines or commas
        const items = pastedData
            .split(/[\n,]+/)
            .map(s => s.trim())
            .filter(s => s.length > 0);

        if (items.length > 0) {
            const uniqueNewItems = items.filter(item => !iocs.includes(item));

            if (uniqueNewItems.length > 0) {
                setIocs([...uniqueNewItems, ...iocs]);
                toast.success(`added ${uniqueNewItems.length} indicators`);
            } else {
                toast.info("No new indicators found in pasted content");
            }
        }
    };

    const removeIoc = (index: number) => {
        const newIocs = [...iocs];
        newIocs.splice(index, 1);
        setIocs(newIocs);
    };

    const handleSave = () => {
        onSave(iocs);
    };

    return (
        <div className="flex flex-col h-full min-h-0">
            <div className="space-y-4">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Input
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onPaste={handlePaste}
                            placeholder="Type IOC (IP, Domain, Hash) and press Enter..."
                            className="pr-10 bg-background-secondary/50 border-border-subtle focus-visible:ring-primary/20"
                            autoFocus
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-foreground-muted font-mono pointer-events-none opacity-50">
                            ENTER
                        </div>
                    </div>
                    <Button
                        onClick={handleAdd}
                        size="icon"
                        disabled={!inputValue.trim()}
                        className="shrink-0 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex items-center justify-between text-xs text-foreground-muted px-1">
                    <span className="font-bold uppercase tracking-wider">Current List ({iocs.length})</span>
                    {iocs.length > 0 && (
                        <button
                            onClick={() => setIocs([])}
                            className="text-[10px] text-destructive hover:underline opacity-80"
                        >
                            Clear All
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 mt-2 -mr-4 pr-4 border rounded-md border-border-subtle/30 bg-background-secondary/20 overflow-y-auto custom-scrollbar">
                <div className="p-2 space-y-2">
                    {iocs.length > 0 ? (
                        iocs.map((ioc, idx) => (
                            <div
                                key={`${ioc}-${idx}`}
                                className="group flex items-start justify-between p-2.5 rounded-lg bg-card border border-border-subtle hover:border-primary/30 transition-all animate-in fade-in slide-in-from-top-1 duration-200"
                            >
                                <div className="flex items-start gap-3 overflow-hidden">
                                    <div className="h-1.5 w-1.5 rounded-full bg-primary/50 shrink-0 mt-2" />
                                    <code className="text-sm font-mono text-foreground/90 break-all leading-relaxed">{ioc}</code>
                                </div>
                                <button
                                    onClick={() => removeIoc(idx)}
                                    className="p-1.5 text-foreground-muted hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 shrink-0 mt-0.5"
                                    title="Remove indicator"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center opacity-40">
                            <Shield className="h-8 w-8 mb-2 text-foreground-muted" />
                            <p className="text-xs font-bold uppercase tracking-widest text-foreground-muted">No Indicators Added</p>
                            <p className="text-[10px] text-foreground-muted/60 mt-1">Add items above to build the threat profile</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex gap-3 pt-6 shrink-0">
                <Button
                    variant="outline"
                    className="flex-1 h-10 rounded-lg border-border-subtle hover:bg-background-secondary font-bold uppercase tracking-widest text-xs"
                    onClick={onCancel}
                >
                    Cancel
                </Button>
                <Button
                    variant="outline"
                    className="flex-1 h-10 rounded-lg font-bold uppercase tracking-widest text-xs gap-2"
                    onClick={handleSave}
                    disabled={isSaving}
                >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                    Save Changes
                </Button>
            </div>
        </div>
    );
};
