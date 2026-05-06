import React, { useState, useEffect, useCallback } from 'react';
import {
    Terminal,
    Play,
    Trash2,
    ArrowRight,
    Save,
    Download,
    Clipboard,
    Settings2,
    Layers,
    Type,
    FileOutput,
    Zap,
    ChevronUp,
    ChevronDown,
    Binary,
    Shield,
    Network,
    FileCode,
    Globe,
    Eye,
    Code,
    Fingerprint,
    Lock,
    X,
    Search,
    ArrowUp,
    ArrowDown,
    ArrowLeft
} from 'lucide-react';
import { useRef } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { executeRecipe } from '@/lib/cyber-ops';
import { CyberLabSidebar } from '@/components/dashboard/CyberLabSidebar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { loadFromLabInput, clearLabInput, saveToLabInput } from '@/lib/lab-storage';

interface RecipeStep {
    id: string;
    name: string;
    description: string;
    icon: string;
    args?: Record<string, string>;
}

const ICON_MAP: Record<string, React.ReactNode> = {
    'zap': <Zap className="h-3 w-3" />,
    'binary': <Binary className="h-3 w-3" />,
    'shield': <Shield className="h-3 w-3" />,
    'network': <Network className="h-3 w-3" />,
    'file-code': <FileCode className="h-3 w-3" />,
    'globe': <Globe className="h-3 w-3" />,
    'eye': <Eye className="h-3 w-3" />,
    'code': <Code className="h-3 w-3" />,
    'fingerprint': <Fingerprint className="h-3 w-3" />,
    'lock': <Lock className="h-3 w-3" />,
};

const Lab = () => {
    // Persistent state initialization with quota handling
    const [input, setInput] = useState(() => loadFromLabInput());
    const [output, setOutput] = useState('');
    const [recipe, setRecipe] = useState<RecipeStep[]>(() => {
        try {
            const saved = localStorage.getItem('lab-recipe');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.warn('Failed to load lab-recipe from storage:', e);
            return [];
        }
    });
    const [isProcessing, setIsProcessing] = useState(false);
    const [autoBake, setAutoBake] = useState(() => {
        const saved = localStorage.getItem('lab-auto-bake');
        return saved !== null ? saved === 'true' : true;
    });

    // Auto-save effects with quota handling
    useEffect(() => {
        // Try to save to storage, but don't show error if it fails
        // The content will still be available in memory
        saveToLabInput(input);
    }, [input]);

    useEffect(() => {
        try {
            localStorage.setItem('lab-recipe', JSON.stringify(recipe));
        } catch (e) {
            console.error('Failed to save lab-recipe:', e);
        }
    }, [recipe]);

    useEffect(() => {
        localStorage.setItem('lab-auto-bake', autoBake.toString());
    }, [autoBake]);

    // --- Search Functionality ---
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchScope, setSearchScope] = useState<'input' | 'output'>('input');
    const [currentMatch, setCurrentMatch] = useState(0);
    const [totalMatches, setTotalMatches] = useState(0);
    const [matches, setMatches] = useState<number[]>([]); // Indices of matches

    // Download Dialog State
    const [downloadOpen, setDownloadOpen] = useState(false);
    const [downloadFilename, setDownloadFilename] = useState('');
    const [downloadContent, setDownloadContent] = useState<string>('');
    const [downloadDefaultName, setDownloadDefaultName] = useState('');

    const inputRef = useRef<HTMLTextAreaElement>(null);
    const outputRef = useRef<HTMLPreElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Ctrl+F Handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                setSearchOpen(true);
                // Wait for render then focus
                setTimeout(() => searchInputRef.current?.focus(), 50);
            }
            if (e.key === 'Escape' && searchOpen) {
                setSearchOpen(false);
                setSearchQuery('');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [searchOpen]);

    // Search Logic
    const executeSearch = useCallback((query: string, scope: 'input' | 'output') => {
        if (!query) {
            setMatches([]);
            setTotalMatches(0);
            setCurrentMatch(0);
            return;
        }

        const text = scope === 'input' ? input : output;
        const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const found: number[] = [];
        let match;

        while ((match = regex.exec(text)) !== null) {
            found.push(match.index);
        }

        setMatches(found);
        setTotalMatches(found.length);
        setCurrentMatch(found.length > 0 ? 1 : 0);

        // Initial highlight/select
        if (found.length > 0) {
            scrollToMatch(0, found, scope);
        }
    }, [input, output]);

    // Update search when query/scope/data changes
    useEffect(() => {
        if (searchOpen) {
            executeSearch(searchQuery, searchScope);
        }
    }, [searchQuery, searchScope, searchOpen, input, output, executeSearch]);

    const scrollToMatch = (index: number, matchIndices: number[], scope: 'input' | 'output') => {
        if (matchIndices.length === 0) return;

        const matchIdx = matchIndices[index];
        const queryLen = searchQuery.length;

        if (scope === 'input' && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.setSelectionRange(matchIdx, matchIdx + queryLen);
            // Blur back to search input to keep typing if needed, 
            // but usually we want to see the selection. 
            // Let's keep focus on search input for typing, but selection logic works.
            // Actually, setting selection often scrolls automatically.
            // To keep focus on search input:
            searchInputRef.current?.focus();
        } else if (scope === 'output' && outputRef.current) {
            const pre = outputRef.current;
            // Simple scroll logic is hard without specific element wrapping.
            // We will handle Output highlighting in the render itself.
            // But we can try to scroll.
        }
    };

    const navigateSearch = (direction: 'next' | 'prev') => {
        if (totalMatches === 0) return;

        let next = direction === 'next' ? currentMatch + 1 : currentMatch - 1;
        if (next > totalMatches) next = 1;
        if (next < 1) next = totalMatches;

        setCurrentMatch(next);
        scrollToMatch(next - 1, matches, searchScope);
    };

    const HighlightedOutput = () => {
        if (!searchQuery || searchScope !== 'output' || !searchOpen) {
            return output || <span className="text-foreground-muted/20 italic">Awaiting baked output...</span>;
        }

        const parts = output.split(new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
        let currentIndex = 0;
        let matchCount = 0;

        return (
            <>
                {parts.map((part, i) => {
                    const isMatch = part.toLowerCase() === searchQuery.toLowerCase();
                    if (isMatch) {
                        matchCount++;
                        // Check if this is the current active match (using index from global matches array is cleaner, but basic counting works for unique strings)
                        // Actually, split removes indices info. 
                        // Let's trust the match iteration order.
                        const isActive = matchCount === currentMatch;
                        return (
                            <span key={i} className={cn("bg-yellow-500/50 text-white rounded-[1px]", isActive && "bg-yellow-400 text-black font-bold ring-2 ring-yellow-400/50")}>
                                {part}
                            </span>
                        );
                    }
                    return <span key={i}>{part}</span>;
                })}
            </>
        );
    };

    const handleRun = useCallback(async () => {
        if (!input) {
            setOutput('');
            return;
        }
        setIsProcessing(true);
        try {
            const result = await executeRecipe(input, recipe);
            setOutput(result);
        } catch (err) {
            console.error(err);
        } finally {
            setIsProcessing(false);
        }
    }, [input, recipe]);

    useEffect(() => {
        if (autoBake) {
            const timer = setTimeout(() => {
                handleRun();
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [input, recipe, autoBake, handleRun]);

    const clearAll = () => {
        setInput('');
        setOutput('');
        setRecipe([]);
        clearLabInput();
        localStorage.removeItem('lab-recipe');
        toast.success("Workspace and cache cleared.");
    };

    const addStep = (op: any) => {
        const defaultArgs: Record<string, string> = {};
        if (op.id === 'dec-xor') defaultArgs.key = '55';
        if (op.id === 'cry-aes' || op.id === 'cry-aes-enc') {
            defaultArgs.key = '';
            defaultArgs.iv = '';
        }
        if (op.id === 'str-regex') {
            defaultArgs.regex = '.*';
            defaultArgs.flags = 'g';
        }
        if (op.id === 'net-http') {
            defaultArgs.method = 'GET';
            defaultArgs.url = '${input}';
            defaultArgs.headers = '';
            defaultArgs.body = '';
            defaultArgs.useProxy = 'false';
        }
        if (op.id === 'fmt-template') {
            defaultArgs.template = '${input}';
        }
        if (op.id === 'enc-hex' || op.id === 'dec-hex') {
            defaultArgs.delimiter = 'Auto';
        }

        if (op.id.startsWith('ext-')) {
            defaultArgs.delimiter = 'Line feed';
        }
        if (op.id === 'str-regex') {
            defaultArgs.delimiter = 'Line feed';
            defaultArgs.regex = '.*';
            defaultArgs.flags = 'g';
        }
        if (op.id === 'str-trim') {
            defaultArgs.type = 'All whitespace';
            defaultArgs.custom = '';
        }

        setRecipe(prev => [...prev, {
            id: `${op.id}-${Date.now()}`,
            name: op.name,
            description: op.description,
            icon: op.icon,
            args: defaultArgs
        }]);
        toast.success(`Added ${op.name} to recipe`);
    };

    const updateStepArgs = (stepId: string, newArgs: Record<string, string>) => {
        setRecipe(prev => prev.map(step =>
            step.id === stepId ? { ...step, args: { ...step.args, ...newArgs } } : step
        ));
    };

    const moveStep = (idx: number, direction: 'up' | 'down') => {
        const next = [...recipe];
        const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= next.length) return;
        [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
        setRecipe(next);
    };

    const handleDownload = (content: string, defaultName: string) => {
        if (!content) {
            toast.error("Nothing to download");
            return;
        }
        setDownloadContent(content);
        setDownloadDefaultName(defaultName);
        setDownloadFilename(defaultName.replace('.txt', '.dat')); // Suggest .dat for safer binary handling
        setDownloadOpen(true);
    };

    const confirmDownload = () => {
        const content = downloadContent;
        const filename = downloadFilename || downloadDefaultName || 'download.dat';

        // Convert "binary string" (where chars are 0-255) to Uint8Array for exact byte preservation
        const bytes = new Uint8Array(content.length);
        for (let i = 0; i < content.length; i++) {
            bytes[i] = content.charCodeAt(i);
        }

        const blob = new Blob([bytes], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 100);

        toast.success(`Downloaded ${filename}`);
        setDownloadOpen(false);
    };

    const handleCopy = async (content: string) => {
        if (!content) {
            toast.error("Nothing to copy");
            return;
        }

        try {
            // Try modern API first
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(content);
                toast.success("Copied to clipboard");
                return;
            }
        } catch (err) {
            console.warn("Clipboard API failed, trying fallback...", err);
        }

        // Fallback for older browsers or non-secure contexts
        try {
            const textArea = document.createElement("textarea");
            textArea.value = content;

            // Ensure it's not visible but part of DOM
            textArea.style.position = "fixed";
            textArea.style.left = "-999999px";
            textArea.style.top = "-999999px";
            document.body.appendChild(textArea);

            textArea.focus();
            textArea.select();

            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);

            if (successful) {
                toast.success("Copied to clipboard");
            } else {
                throw new Error("execCommand failed");
            }
        } catch (err) {
            console.error("Copy failed:", err);
            toast.error("Failed to copy");
        }
    };

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const file = e.dataTransfer.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const content = ev.target?.result as string;
                setInput(content);
                const sizeStr = file.size > 1024 * 1024
                    ? `${(file.size / 1024 / 1024).toFixed(2)}MB`
                    : `${(file.size / 1024).toFixed(2)}KB`;
                toast.success(`File loaded: ${file.name} (${sizeStr})`);
            };
            reader.onerror = () => {
                toast.error("Failed to read file. Please try again.");
            };
            reader.readAsText(file);
        }
    }, [setInput]);

    return (
        <div className="h-full flex flex-col space-y-4 overflow-hidden bg-background text-foreground animate-in fade-in duration-500">
            {/* Header / Action Bar */}
            <header className="shrink-0 flex items-center justify-between p-3 mx-4 mt-4 bg-card border border-border-subtle rounded-xl">
                <div className="flex items-center gap-3 px-4 py-2 bg-background-secondary/50 rounded-lg border border-border-subtle/50">
                    <Terminal className="h-4 w-4 text-primary" />
                    <div>
                        <h1 className="text-xs font-black uppercase tracking-[0.2em] text-foreground">Lab</h1>
                        <p className="text-[9px] font-bold text-foreground-muted/60 uppercase tracking-widest leading-none">CyberChef-Style Transformation Workspace</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 pr-4 border-r border-border-subtle/50">
                        <Label htmlFor="auto-bake" className="text-[10px] font-black uppercase tracking-widest text-foreground-muted cursor-pointer">Auto Bake</Label>
                        <Switch
                            id="auto-bake"
                            checked={autoBake}
                            onCheckedChange={setAutoBake}
                            className="scale-75 data-[state=checked]:bg-primary"
                        />
                    </div>
                    <Button variant="outline" size="sm" onClick={clearAll} className="h-9 gap-2 uppercase font-bold tracking-widest text-[10px]">
                        <Trash2 className="h-3.5 w-3.5" />
                        Clear Lab
                    </Button>
                    <Button onClick={handleRun} disabled={isProcessing} className="h-9 px-6 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-none">
                        {isProcessing ? <Zap className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
                        <span className="font-black uppercase tracking-widest text-[11px]">Bake Operations</span>
                    </Button>
                </div>
            </header>

            {/* Main Workspace */}
            <div className="flex-1 flex gap-4 min-h-0 overflow-hidden px-4 pb-4">

                {/* 1. Operation Library Sidebar (Repurposed) */}
                <div className="w-64 shrink-0 flex flex-col overflow-hidden">
                    <div className="h-full border-none shadow-none">
                        <CyberLabSidebar onOperationClick={addStep} />
                    </div>
                </div>

                {/* 2. Recipe Staging (Central Column) */}
                <div className="w-80 shrink-0 flex flex-col gap-3 min-h-0">
                    <div
                        className="flex-1 bg-card/40 backdrop-blur-md border border-border-subtle rounded-xl flex flex-col overflow-hidden"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                            e.preventDefault();
                            const opData = e.dataTransfer.getData('operation');
                            if (opData) {
                                try {
                                    const op = JSON.parse(opData);
                                    addStep(op);
                                } catch (err) {
                                    console.error("Failed to parse dropped operation", err);
                                }
                            }
                        }}
                    >
                        <div className="p-3 border-b border-border-subtle bg-background-secondary/50 flex items-center justify-between">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-foreground-muted flex items-center gap-2">
                                <Layers className="h-3.5 w-3.5 text-primary" />
                                Recipe Stack
                            </h3>
                            <span className="text-[9px] font-bold text-primary/60">{recipe.length} Ops</span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                            {recipe.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center opacity-20 text-center p-6 border-2 border-dashed border-border-subtle rounded-xl m-1">
                                    <Settings2 size={32} className="mb-3 animate-[spin_8s_linear_infinite]" />
                                    <span className="text-[9px] font-black uppercase tracking-widest leading-tight">Drag or click operations <br /> to start building</span>
                                </div>
                            ) : (
                                recipe.map((step, idx) => (
                                    <div key={step.id} className="relative group animate-in slide-in-from-left-2 fade-in duration-300">
                                        <div className="p-3 bg-background border border-border-subtle rounded-lg group-hover:border-primary/30 transition-all flex flex-col gap-1.5 relative z-10">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 bg-primary/10 rounded text-primary">
                                                        {ICON_MAP[step.icon]}
                                                    </div>
                                                    <span className="text-xs font-bold text-foreground">{step.name}</span>
                                                </div>
                                                <div className="flex items-center gap-0.5">
                                                    <button
                                                        onClick={() => moveStep(idx, 'up')}
                                                        disabled={idx === 0}
                                                        className="p-1 text-foreground-muted hover:text-primary disabled:opacity-20 transition-colors"
                                                        title="Move Up"
                                                    >
                                                        <ChevronUp size={12} />
                                                    </button>
                                                    <button
                                                        onClick={() => moveStep(idx, 'down')}
                                                        disabled={idx === recipe.length - 1}
                                                        className="p-1 text-foreground-muted hover:text-primary disabled:opacity-20 transition-colors"
                                                        title="Move Down"
                                                    >
                                                        <ChevronDown size={12} />
                                                    </button>
                                                    <button
                                                        onClick={() => setRecipe(recipe.filter(r => r.id !== step.id))}
                                                        className="p-1 text-foreground-muted hover:text-destructive transition-colors ml-1"
                                                        title="Remove"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-foreground-muted/60 leading-tight">
                                                {step.description}
                                            </p>

                                            {step.args && Object.keys(step.args).length > 0 && (
                                                <div className="mt-2 space-y-2 pt-2 border-t border-border-subtle/30">
                                                    {step.id.startsWith('net-http') ? (
                                                        <div className="space-y-3">
                                                            <div className="flex gap-2">
                                                                <div className="w-24 shrink-0">
                                                                    <Label className="text-[9px] font-black uppercase tracking-widest text-foreground-muted/60">Method</Label>
                                                                    <Select
                                                                        value={step.args.method}
                                                                        onValueChange={(val) => updateStepArgs(step.id, { method: val })}
                                                                    >
                                                                        <SelectTrigger className="h-7 text-[10px] font-bold bg-background-secondary/30 border-border-subtle/50 px-2 focus:ring-0">
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent className="bg-card border-border-subtle">
                                                                            {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map(m => (
                                                                                <SelectItem key={m} value={m} className="text-[10px] font-bold uppercase">{m}</SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                                <div className="flex-1">
                                                                    <Label className="text-[9px] font-black uppercase tracking-widest text-foreground-muted/60">URL</Label>
                                                                    <Input
                                                                        value={step.args.url}
                                                                        onChange={(e) => updateStepArgs(step.id, { url: e.target.value })}
                                                                        className="h-7 text-[10px] font-mono bg-background-secondary/30 border-border-subtle/50 px-2 focus-visible:ring-0"
                                                                        placeholder="https://api.com/lookup?q=${input}"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center justify-between p-2 rounded-md bg-primary/5 border border-primary/10">
                                                                <div className="space-y-0.5">
                                                                    <Label className="text-[10px] font-bold">Use CORS Proxy</Label>
                                                                    <p className="text-[8px] text-foreground-muted/60">Bypass browser restrictions using api.allorigins.win</p>
                                                                </div>
                                                                <Switch
                                                                    checked={step.args.useProxy === 'true'}
                                                                    onCheckedChange={(checked) => updateStepArgs(step.id, { useProxy: checked.toString() })}
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-[9px] font-black uppercase tracking-widest text-foreground-muted/60">Headers (JSON or Key:Value)</Label>
                                                                <Textarea
                                                                    value={step.args.headers}
                                                                    onChange={(e) => updateStepArgs(step.id, { headers: e.target.value })}
                                                                    className="min-h-[60px] text-[10px] font-mono bg-background-secondary/30 border-border-subtle/50 p-2 focus-visible:ring-0 resize-none"
                                                                    placeholder='X-API-Key: ${input}'
                                                                />
                                                            </div>
                                                            {['POST', 'PUT', 'PATCH'].includes(step.args.method) && (
                                                                <div className="space-y-1">
                                                                    <Label className="text-[9px] font-black uppercase tracking-widest text-foreground-muted/60">Body</Label>
                                                                    <Textarea
                                                                        value={step.args.body}
                                                                        onChange={(e) => updateStepArgs(step.id, { body: e.target.value })}
                                                                        className="min-h-[60px] text-[10px] font-mono bg-background-secondary/30 border-border-subtle/50 p-2 focus-visible:ring-0 resize-none"
                                                                        placeholder='{"data": "${input}"}'
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : step.id === 'str-regex' ? (
                                                        <div className="space-y-2">
                                                            <div className="space-y-1">
                                                                <Label className="text-[9px] font-black uppercase tracking-widest text-foreground-muted/60">Regex Pattern</Label>
                                                                <Input
                                                                    value={step.args.regex}
                                                                    onChange={(e) => updateStepArgs(step.id, { regex: e.target.value })}
                                                                    className="h-7 text-[10px] font-mono bg-background-secondary/30 border-border-subtle/50 px-2 focus-visible:ring-0"
                                                                    placeholder="/[a-z]+/..."
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-[9px] font-black uppercase tracking-widest text-foreground-muted/60">Flags</Label>
                                                                <Input
                                                                    value={step.args.flags}
                                                                    onChange={(e) => updateStepArgs(step.id, { flags: e.target.value })}
                                                                    className="h-7 text-[10px] font-mono bg-background-secondary/30 border-border-subtle/50 px-2 focus-visible:ring-0"
                                                                    placeholder="g, i, m..."
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label className="text-[9px] font-black uppercase tracking-widest text-foreground-muted/60">Delimiter</Label>
                                                                <Select
                                                                    value={step.args.delimiter}
                                                                    onValueChange={(val) => updateStepArgs(step.id, { delimiter: val })}
                                                                >
                                                                    <SelectTrigger className="h-7 text-[10px] font-bold bg-background-secondary/30 border-border-subtle/50 px-2 focus:ring-0">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent className="bg-card border-border-subtle">
                                                                        {['Auto', 'Space', 'Percent', 'Comma', 'Semi-colon', 'Colon', 'Line feed', 'CRLF', '0x', '0x with comma', '\\x', 'None'].map(d => (
                                                                            <SelectItem key={d} value={d} className="text-[10px] font-bold">{d}</SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        </div>
                                                    ) : step.id.startsWith('str-trim') ? (
                                                        <div className="space-y-3">
                                                            <div className="space-y-1.5">
                                                                <Label className="text-[9px] font-black uppercase tracking-widest text-foreground-muted/60">Active Filters</Label>

                                                                {/* Active Tags */}
                                                                <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                                                                    {step.args.type?.split('|').filter(Boolean).map((t) => (
                                                                        <div key={t} className="flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 rounded px-1.5 py-0.5 h-6">
                                                                            <span className="text-[10px] font-bold">{t}</span>
                                                                            <button
                                                                                onClick={() => {
                                                                                    const current = step.args.type.split('|').filter(Boolean);
                                                                                    const next = current.filter(x => x !== t);
                                                                                    updateStepArgs(step.id, { type: next.join('|') });
                                                                                }}
                                                                                className="hover:bg-primary/20 rounded p-0.5 transition-colors"
                                                                            >
                                                                                <X className="h-3 w-3" />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                    {(!step.args.type || step.args.type.length === 0) && (
                                                                        <span className="text-[10px] text-foreground-muted italic py-1">No filters selected</span>
                                                                    )}
                                                                </div>

                                                                {/* Add Filter Dropdown */}
                                                                <Select
                                                                    value=""
                                                                    onValueChange={(val) => {
                                                                        const current = step.args.type ? step.args.type.split('|').filter(Boolean) : [];
                                                                        if (!current.includes(val)) {
                                                                            const next = [...current, val];
                                                                            updateStepArgs(step.id, { type: next.join('|') });
                                                                        }
                                                                    }}
                                                                >
                                                                    <SelectTrigger className="h-7 text-[10px] font-bold bg-background-secondary/30 border-border-subtle/50 px-2 focus:ring-0 text-foreground-muted">
                                                                        <span className="flex items-center gap-2">
                                                                            <SelectValue placeholder="Add removal filter..." />
                                                                        </span>
                                                                    </SelectTrigger>
                                                                    <SelectContent className="bg-card border-border-subtle max-h-64">
                                                                        {[
                                                                            'All whitespace', 'Spaces', 'Line feeds', 'Tabs', 'Carriage returns', 'Null bytes',
                                                                            'Period', 'Plus', 'Asterisk', 'All Punctuation',
                                                                            'Comma', 'Semi-colon', 'Colon', 'Percent',
                                                                            '0x', '\\x',
                                                                            'Double quotes', 'Single quotes', 'Backticks',
                                                                            'Square brackets', 'Curly braces', 'Parentheses', 'Angle brackets',
                                                                            'Backslashes', 'Forward slashes', 'Pipes', 'Hyphens', 'Underscores',
                                                                            'Numbers', 'Letters', 'Alphanumeric', 'Non-alphanumeric'
                                                                        ].map(t => (
                                                                            <SelectItem key={t} value={t} className="text-[10px] font-bold">{t}</SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>

                                                            <div className="space-y-1.5 pt-2 border-t border-border-subtle/30">
                                                                <Label className="text-[9px] font-black uppercase tracking-widest text-foreground-muted/60">Advanced</Label>
                                                                <div className="flex gap-2">
                                                                    {['Custom', 'Regex'].map(mode => {
                                                                        const isActive = step.args.type?.split('|').includes(mode);
                                                                        return (
                                                                            <Button
                                                                                key={mode}
                                                                                size="sm"
                                                                                variant={isActive ? "secondary" : "ghost"}
                                                                                className={cn("h-6 text-[9px] font-bold border border-border-subtle/50", isActive && "bg-secondary text-secondary-foreground")}
                                                                                onClick={() => {
                                                                                    const current = step.args.type ? step.args.type.split('|').filter(Boolean) : [];
                                                                                    let next;
                                                                                    if (current.includes(mode)) {
                                                                                        next = current.filter(x => x !== mode);
                                                                                    } else {
                                                                                        next = current.filter(x => x !== 'Custom' && x !== 'Regex').concat(mode);
                                                                                    }
                                                                                    updateStepArgs(step.id, { type: next.join('|') });
                                                                                }}
                                                                            >
                                                                                {mode}
                                                                            </Button>
                                                                        )
                                                                    })}
                                                                </div>
                                                            </div>

                                                            {(step.args.type?.includes('Custom') || step.args.type?.includes('Regex')) && (
                                                                <div className="space-y-1 animate-in fade-in slide-in-from-top-1">
                                                                    <Label className="text-[9px] font-black uppercase tracking-widest text-foreground-muted/60">
                                                                        {step.args.type.includes('Regex') ? 'Regex Pattern' : 'String to remove'}
                                                                    </Label>
                                                                    <Input
                                                                        value={step.args.custom}
                                                                        onChange={(e) => updateStepArgs(step.id, { custom: e.target.value })}
                                                                        className="h-7 text-[10px] font-mono bg-background-secondary/30 border-border-subtle/50 px-2 focus-visible:ring-0"
                                                                        placeholder={step.args.type.includes('Regex') ? '\\d+' : 'chars...'}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : step.id.startsWith('fmt-template') ? (
                                                        <div className="space-y-1">
                                                            <div className="flex items-center justify-between">
                                                                <Label className="text-[9px] font-black uppercase tracking-widest text-foreground-muted/60">Template</Label>
                                                            </div>
                                                            <Textarea
                                                                value={step.args.template}
                                                                onChange={(e) => updateStepArgs(step.id, { template: e.target.value })}
                                                                className="min-h-[60px] text-[10px] font-mono bg-background-secondary/30 border-border-subtle/50 p-2 focus-visible:ring-0 resize-none"
                                                                placeholder="Prefix_${input}_Suffix"
                                                            />
                                                        </div>
                                                    ) : (step.id.startsWith('enc-hex') || step.id.startsWith('dec-hex') || step.id.startsWith('ext-')) ? (
                                                        <div className="space-y-1">
                                                            <Label className="text-[9px] font-black uppercase tracking-widest text-foreground-muted/60">Delimiter</Label>
                                                            <Select
                                                                value={step.args.delimiter}
                                                                onValueChange={(val) => updateStepArgs(step.id, { delimiter: val })}
                                                            >
                                                                <SelectTrigger className="h-7 text-[10px] font-bold bg-background-secondary/30 border-border-subtle/50 px-2 focus:ring-0">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent className="bg-card border-border-subtle">
                                                                    {['Auto', 'Space', 'Percent', 'Comma', 'Semi-colon', 'Colon', 'Line feed', 'CRLF', '0x', '0x with comma', '\\x', 'None'].map(d => (
                                                                        <SelectItem key={d} value={d} className="text-[10px] font-bold">{d}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    ) : (
                                                        Object.keys(step.args).map(key => (
                                                            <div key={key} className="flex flex-col gap-1">
                                                                <div className="flex items-center justify-between">
                                                                    <Label className="text-[9px] font-black uppercase tracking-widest text-foreground-muted/60">{key}</Label>
                                                                    <span className="text-[8px] font-mono text-primary/40 uppercase">Hex string</span>
                                                                </div>
                                                                <Input
                                                                    value={step.args![key]}
                                                                    onChange={(e) => updateStepArgs(step.id, { [key]: e.target.value })}
                                                                    className="h-7 text-[10px] font-mono bg-background-secondary/30 border-border-subtle/50 px-2 py-0 focus-visible:ring-primary/20"
                                                                    placeholder={`Enter ${key}...`}
                                                                />
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {idx < recipe.length - 1 && (
                                            <div className="flex justify-center -my-1 relative z-0">
                                                <div className="h-6 w-px bg-primary/20" />
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* 3. Data Flow (Input/Output Right) */}
                <div className="flex-1 flex flex-col gap-4 min-w-0">
                    {/* Input Pane */}
                    <Card
                        className="flex-1 flex flex-col min-h-0 bg-card/40 backdrop-blur-md border-border-subtle rounded-xl overflow-hidden shadow-none"
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                    >
                        <div className="p-3 border-b border-border-subtle bg-background-secondary/50 flex items-center justify-between shrink-0">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-foreground-muted flex items-center gap-2">
                                <Type className="h-3.5 w-3.5" />
                                Input Data
                            </h3>
                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(input)} title="Copy Input">
                                    <Clipboard className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDownload(input, 'lab_input.txt')} title="Download Input">
                                    <Download className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setInput('')}>
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                        <div className="flex-1 relative min-h-0">
                            <Textarea
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Paste text or drag files here..."
                                className="absolute inset-0 bg-transparent border-none resize-none p-4 font-mono text-xs focus-visible:ring-0 placeholder:text-foreground-muted/20 custom-scrollbar overflow-auto"
                            />
                            {/* Search Widget Overlay */}
                            {searchOpen && (
                                <div className="absolute top-2 right-4 z-50 animate-in fade-in slide-in-from-top-2">
                                    <div className="flex items-center gap-1 p-1 bg-background border border-primary/30 rounded-lg shadow-2xl ring-1 ring-primary/10">
                                        <div className="flex bg-muted/50 rounded-md p-0.5 mr-1">
                                            <button
                                                onClick={() => setSearchScope('input')}
                                                className={cn("px-2 py-1 text-[9px] font-bold uppercase rounded transition-all", searchScope === 'input' ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground-muted hover:text-foreground")}
                                            >
                                                Input
                                            </button>
                                            <button
                                                onClick={() => setSearchScope('output')}
                                                className={cn("px-2 py-1 text-[9px] font-bold uppercase rounded transition-all", searchScope === 'output' ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground-muted hover:text-foreground")}
                                            >
                                                Output
                                            </button>
                                        </div>

                                        <div className="relative flex items-center">
                                            <Search className="absolute left-2 h-3 w-3 text-foreground-muted animate-pulse" />
                                            <input
                                                ref={searchInputRef}
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        navigateSearch(e.shiftKey ? 'prev' : 'next');
                                                    }
                                                }}
                                                placeholder="Find..."
                                                className="h-7 w-32 bg-transparent border-none text-[11px] font-medium focus:ring-0 pl-7 pr-2 placeholder:text-foreground-muted/50 focus:outline-none"
                                            />
                                            <div className="flex items-center gap-0.5 pr-1">
                                                <span className="text-[9px] font-mono text-foreground-muted h-4 min-w-[30px] flex items-center justify-center bg-muted/30 rounded px-1">
                                                    {totalMatches > 0 ? currentMatch : 0}/{totalMatches}
                                                </span>
                                                <div className="flex flex-col">
                                                    <button onClick={() => navigateSearch('prev')} className="hover:text-primary"><ArrowUp size={8} /></button>
                                                    <button onClick={() => navigateSearch('next')} className="hover:text-primary"><ArrowDown size={8} /></button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="w-px h-4 bg-border-subtle mx-1" />

                                        <button
                                            onClick={() => setSearchOpen(false)}
                                            className="p-1 hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Output Pane */}
                    <Card className="flex-1 flex flex-col min-h-0 bg-card/40 backdrop-blur-md border-border-subtle rounded-xl overflow-hidden shadow-none">
                        <div className="p-3 border-b border-border-subtle bg-background-secondary/50 flex items-center justify-between shrink-0">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-foreground-muted flex items-center gap-2">
                                <FileOutput className="h-3.5 w-3.5" />
                                Clean Output
                            </h3>
                            <div className="flex items-center gap-2">
                                {isProcessing && <div className="text-[9px] font-bold uppercase tracking-widest text-primary animate-pulse mr-2">Processing...</div>}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => {
                                        if (!output) {
                                            toast.error("No output to move");
                                            return;
                                        }
                                        setInput(output);
                                        toast.success("Output moved to Input");
                                    }}
                                    title="Replace Input with Output"
                                >
                                    <ArrowLeft className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(output)} title="Copy Output">
                                    <Clipboard className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDownload(output, 'lab_output.txt')} title="Download Output">
                                    <Download className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                        <div className="flex-1 bg-background/20 relative min-h-0">
                            <pre
                                ref={outputRef}
                                className="absolute inset-0 p-4 font-mono text-xs overflow-auto whitespace-pre-wrap text-primary/80 custom-scrollbar"
                            >
                                <HighlightedOutput />
                            </pre>
                            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                        </div>
                    </Card>
                </div>
            </div>
            {/* Download Dialog */}
            <Dialog open={downloadOpen} onOpenChange={setDownloadOpen}>
                <DialogContent className="bg-card/95 backdrop-blur-md border-border-subtle">
                    <DialogHeader>
                        <DialogTitle className="text-secondary tracking-widest uppercase text-xs font-black flex items-center gap-2">
                            <Download className="h-4 w-4" />
                            Download File
                        </DialogTitle>
                        <DialogDescription className="text-[10px] text-foreground-muted">
                            Enter a filename for your download. Use .dat extension for binary data.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label className="text-[10px] uppercase font-bold text-foreground-muted mb-2 block">
                            Filename
                        </Label>
                        <Input
                            value={downloadFilename}
                            onChange={(e) => setDownloadFilename(e.target.value)}
                            className="bg-background-secondary/50 border-border-subtle font-mono text-xs"
                            placeholder="filename.dat"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') confirmDownload();
                            }}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" size="sm" onClick={() => setDownloadOpen(false)} className="text-xs">
                            Cancel
                        </Button>
                        <Button variant="secondary" size="sm" onClick={confirmDownload} className="text-xs font-bold">
                            Download
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Lab;
