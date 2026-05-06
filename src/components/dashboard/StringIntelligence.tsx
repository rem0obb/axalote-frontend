import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Search,
    Download,
    Fingerprint,
    ShieldAlert,
    Copy,
    Check,
    Filter,
    Globe,
    Server,
    Mail,
    Hash,
    Terminal,
    Eye,
    ListFilter,
    Code2,
    MoreHorizontal,
    Trash2,
    ShieldPlus,
    Plus,
    X,
    Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import copy from 'copy-to-clipboard';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tabs,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import {
    StringScanOptions,
    StringMatch,
    ThreatFile
} from '@/types/threat.types';
import { apiService } from '@/services/api.service';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { saveToLabInput } from '@/lib/lab-storage';

const ITEM_HEIGHT = 44;
const OVERSCAN = 10;

interface StringIntelligenceProps {
    sha256: string;
    fullHeight?: boolean;
}

export const StringIntelligence: React.FC<StringIntelligenceProps> = ({ sha256, fullHeight }) => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState("overview");
    const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

    // Clear selection on tab change or search
    useEffect(() => {
        setSelectedItems(new Set());
    }, [activeTab, searchTerm]);

    const [options, setOptions] = useState<StringScanOptions>({
        min_length: 4,
        encoding: 'ascii',
        char_type: 'printable',
        null_terminated: false
    });

    const { data: queryData, isLoading, refetch, isFetched } = useQuery({
        queryKey: ['strings', sha256, options],
        queryFn: async () => {
            const { data, error } = await apiService.extractStrings(sha256, options);
            if (error) {
                toast.error(`Scan failed: ${error.message}`);
                throw new Error(error.message);
            }
            if (data && data.data) {
                toast.success(`Analysis Complete: ${data.data.iocs?.length || 0} IOCs, ${data.data.strings?.length || 0} Strings`);
                return {
                    iocs: data.data.iocs || [],
                    rawStrings: data.data.strings || [],
                    count: (data.data.iocs?.length || 0) + (data.data.strings?.length || 0)
                };
            } else if ((data as any)?.strings) {
                toast.success(`Found ${(data as any).count} strings`);
                return {
                    iocs: [],
                    rawStrings: (data as any).strings,
                    count: (data as any).count || (data as any).strings.length
                };
            }
            return { iocs: [], rawStrings: [], count: 0 };
        },
        enabled: false,
        staleTime: Infinity,
        gcTime: 1000 * 60 * 60,
    });

    const iocs = queryData?.iocs || [];
    const rawStrings = queryData?.rawStrings || [];
    const scanned = isFetched && queryData !== undefined;

    useEffect(() => {
        // Auto-switch to RAW if no IOCs found but strings exist
        if (scanned && iocs.length === 0 && rawStrings.length > 0 && activeTab === 'overview') {
            setActiveTab("raw");
        }
    }, [scanned, iocs.length, rawStrings.length, activeTab]);

    const handleClearCache = () => {
        queryClient.removeQueries({ queryKey: ['strings', sha256] });
        toast.info("Cache cleared");
    };

    const sendToLab = (text: string) => {
        saveToLabInput(text);
        toast.info("Sending data to Cyber Lab...");
        navigate('/lab');
    };

    const addToIndicators = async (text: string) => {
        const cleanText = text.trim();
        if (!cleanText) {
            toast.error("Cannot add an empty indicator");
            return;
        }

        try {
            const result = await apiService.request<any>(`/axalote/records/files/${sha256}`);

            if (result.error || !result.data) {
                toast.error("Could not fetch file details to update indicators");
                return;
            }

            // Extract real data (might be wrapped in .data)
            const rawData = result.data.data || result.data;
            const rawIocs = rawData.iocs || [];

            // Handle if rawIocs is an object instead of array
            const currentIocs: string[] = (Array.isArray(rawIocs)
                ? rawIocs
                : (typeof rawIocs === 'object' ? Object.keys(rawIocs) : []))
                .map((s: string) => s.trim())
                .filter(Boolean);

            if (currentIocs.includes(cleanText)) {
                toast.info("This indicator is already added");
                return;
            }

            const newIocs = [...currentIocs, cleanText];

            const { error: updateError } = await apiService.updateFileMetadata(sha256, { iocs: newIocs });

            if (updateError) {
                toast.error(`Failed to add indicator: ${updateError.message}`);
            } else {
                toast.success("Added to Indicators Analysis");
                // Invalidate query to refresh parent components
                queryClient.invalidateQueries({ queryKey: ['endpoint', `/axalote/records/files/${sha256}`] });
            }
        } catch (err: any) {
            toast.error(`Unexpected error: ${err.message}`);
        }
    };

    const containerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [containerHeight, setContainerHeight] = useState(0);

    useEffect(() => {
        if (activeTab === 'raw') {
            const timer = setTimeout(() => {
                if (containerRef.current) {
                    setContainerHeight(containerRef.current.clientHeight);
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [activeTab, scanned]);

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        const handleScroll = () => requestAnimationFrame(() => setScrollTop(element.scrollTop));
        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) setContainerHeight(entry.contentRect.height);
        });

        element.addEventListener('scroll', handleScroll);
        resizeObserver.observe(element);

        return () => {
            element.removeEventListener('scroll', handleScroll);
            resizeObserver.disconnect();
        };
    }, [activeTab]);

    const filterList = (list: StringMatch[]) => {
        if (!Array.isArray(list)) return [];
        if (!searchTerm) return list;
        const lowSearch = searchTerm.toLowerCase();
        return list.filter(item =>
            item.value.toLowerCase().includes(lowSearch) ||
            item.type?.toLowerCase().includes(lowSearch)
        );
    };

    const filteredIocs = useMemo(() => filterList(iocs), [iocs, searchTerm]);
    const filteredRaw = useMemo(() => filterList(rawStrings), [rawStrings, searchTerm]);

    const currentList = activeTab === 'overview' ? filteredIocs : filteredRaw;

    const [isBulkAdding, setIsBulkAdding] = useState(false);

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedItems(new Set(currentList.map((_, idx) => idx)));
        } else {
            setSelectedItems(new Set());
        }
    };

    const handleSelectRow = (index: number, checked: boolean) => {
        const newSelected = new Set(selectedItems);
        if (checked) newSelected.add(index);
        else newSelected.delete(index);
        setSelectedItems(newSelected);
    };

    const handleAddAllIndicators = async () => {
        if (iocs.length === 0) {
            toast.info("No indicators found in current scan");
            return;
        }

        setIsBulkAdding(true);
        try {
            const result = await apiService.request<any>(`/axalote/records/files/${sha256}`);
            if (result.error || !result.data) throw new Error(result.error?.message || "Could not fetch file details");

            // Extract real data (might be wrapped in .data)
            const rawData = result.data.data || result.data;
            const rawIocs = rawData.iocs || [];

            // Handle if rawIocs is an object instead of array
            const iocArray: string[] = Array.isArray(rawIocs)
                ? rawIocs
                : (typeof rawIocs === 'object' ? Object.keys(rawIocs) : []);

            const currentIocsSet = new Set(iocArray.map(s => s.trim()).filter(Boolean));
            let addedCount = 0;

            iocs.forEach(item => {
                const val = item?.value?.trim();
                if (val && !currentIocsSet.has(val)) {
                    currentIocsSet.add(val);
                    addedCount++;
                }
            });

            if (addedCount === 0) {
                toast.info("All detected indicators are already in the record");
                return;
            }

            const cleanIocs = Array.from(currentIocsSet).filter(Boolean);
            const { error } = await apiService.updateFileMetadata(sha256, { iocs: cleanIocs });
            if (error) throw error;

            toast.success(`Successfully added ${addedCount} indicators`);
            queryClient.invalidateQueries({ queryKey: ['endpoint', `/axalote/records/files/${sha256}`] });
        } catch (err: any) {
            toast.error(`Bulk add failed: ${err.message}`);
        } finally {
            setIsBulkAdding(false);
        }
    };

    const handleBulkAdd = async () => {
        const itemsToAdd = Array.from(selectedItems).map(idx => currentList[idx]?.value).filter(Boolean);
        if (itemsToAdd.length === 0) return;

        setIsBulkAdding(true);
        try {
            const result = await apiService.request<any>(`/axalote/records/files/${sha256}`);
            if (result.error || !result.data) throw new Error(result.error?.message || "Could not fetch file details");

            // Extract real data (might be wrapped in .data)
            const rawData = result.data.data || result.data;
            const rawIocs = rawData.iocs || [];

            // Handle if rawIocs is an object instead of array
            const iocArray: string[] = Array.isArray(rawIocs)
                ? rawIocs
                : (typeof rawIocs === 'object' ? Object.keys(rawIocs) : []);

            const currentIocsSet = new Set(iocArray.map(s => s.trim()).filter(Boolean));
            let addedCount = 0;

            itemsToAdd.forEach(item => {
                const val = item?.trim();
                if (val && !currentIocsSet.has(val)) {
                    currentIocsSet.add(val);
                    addedCount++;
                }
            });

            if (addedCount === 0) {
                toast.info("Selected items are already in indicators");
                setSelectedItems(new Set());
                return;
            }

            const cleanIocs = Array.from(currentIocsSet).filter(Boolean);
            const { error } = await apiService.updateFileMetadata(sha256, { iocs: cleanIocs });
            if (error) throw error;

            toast.success(`Added ${addedCount} indicators successfully`);
            queryClient.invalidateQueries({ queryKey: ['endpoint', `/axalote/records/files/${sha256}`] });
            setSelectedItems(new Set());
        } catch (err: any) {
            toast.error(`Bulk add failed: ${err.message}`);
        } finally {
            setIsBulkAdding(false);
        }
    };

    const secureCopy = (text: string) => {
        return copy(text);
    };

    const handleBulkCopy = (format: 'raw' | 'yara' | 'python') => {
        const items = Array.from(selectedItems).map(idx => currentList[idx]?.value).filter(Boolean);
        if (items.length === 0) return;

        let content = '';
        if (format === 'raw') {
            content = items.join('\n');
        } else if (format === 'yara') {
            content = items.map((s, i) => `$str_${i + 1} = "${s}" ascii wide`).join('\n');
        } else if (format === 'python') {
            content = `strings = [\n${items.map(s => `    "${s}"`).join(',\n')}\n]`;
        }

        const success = secureCopy(content);
        if (success) {
            toast.success(`Copied ${items.length} items as ${format.toUpperCase()}`);
            setSelectedItems(new Set());
        } else {
            toast.error("Failed to copy to clipboard");
        }
    };

    const handleBulkSendToLab = () => {
        const items = Array.from(selectedItems).map(idx => currentList[idx]?.value).filter(Boolean);
        if (items.length === 0) return;

        const combinedText = items.join('\n');
        sendToLab(combinedText);
        setSelectedItems(new Set());
    };

    const copyToClipboard = (text: string, id: string) => {
        const success = secureCopy(text);
        if (success) {
            setCopiedIndex(id);
            setTimeout(() => setCopiedIndex(null), 1500);
            toast.success('Copied to clipboard');
        } else {
            toast.error("Failed to copy");
        }
    };

    const copyAsFormatted = (text: string, format: 'yara' | 'python' | 'lua', id: string) => {
        let content = text;
        if (format === 'yara') {
            content = `$s = "${text}" ascii wide`;
        } else if (format === 'python') {
            content = `s = "${text}"`;
        } else if (format === 'lua') {
            content = `local s = "${text}"`;
        }

        const success = secureCopy(content);
        if (success) {
            setCopiedIndex(id);
            setTimeout(() => setCopiedIndex(null), 1500);
            toast.success(`Copied as ${format}`);
        } else {
            toast.error("Failed to copy");
        }
    };

    const downloadResults = () => {
        let content = "TYPE\tOFFSET\tENCODING\tVALUE\n";
        content += iocs.map(r => `${r.type || 'IOC'}\t${r.offset}\t${r.encoding}\t${r.value}`).join('\n');
        content += "\n\nRAW STRINGS\n";
        content += rawStrings.map(r => `STRING\t${r.offset}\t${r.encoding}\t${r.value}`).join('\n');

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analysis_${sha256.substring(0, 8)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const vTotalCount = filteredRaw.length;
    const vTotalHeight = vTotalCount * ITEM_HEIGHT;
    const vStartIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN);
    const vEndIndex = Math.min(vTotalCount, Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + OVERSCAN);

    const visibleItems = [];
    for (let i = vStartIndex; i < vEndIndex; i++) {
        visibleItems.push({
            index: i,
            item: filteredRaw[i],
            style: {
                position: 'absolute',
                top: i * ITEM_HEIGHT,
                left: 0,
                width: '100%',
                height: ITEM_HEIGHT,
            } as React.CSSProperties
        });
    }

    const getIocIcon = (type?: string) => {
        switch (type?.toLowerCase()) {
            case 'url': return <Globe className="h-3 w-3 text-blue-400" />;
            case 'ip': return <Server className="h-3 w-3 text-orange-400" />;
            case 'email': return <Mail className="h-3 w-3 text-purple-400" />;
            case 'hash': return <Hash className="h-3 w-3 text-red-500" />;
            default: return <ShieldAlert className="h-3 w-3 text-emerald-500" />;
        }
    };

    const getConfidenceBadge = (confidence?: string) => {
        if (!confidence) return null;

        const colors = {
            high: "bg-primary/20 text-primary border-primary/20",
            medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
            low: "bg-foreground-muted/10 text-foreground-muted border-foreground-muted/20"
        };

        const colorClass = colors[confidence.toLowerCase() as keyof typeof colors] || colors.low;

        return (
            <Badge variant="outline" className={`ml-2 h-4 px-1 text-[9px] uppercase tracking-wider rounded-[3px] border ${colorClass}`}>
                {confidence}
            </Badge>
        );
    };

    const CopyActions = ({ text, id }: { text: string, id: string }) => (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                    {copiedIndex === id ? <Check className="h-3 w-3 text-green-500" /> : <MoreHorizontal className="h-3 w-3" />}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-card border-white/10">
                <DropdownMenuLabel className="text-[9px] uppercase text-foreground-muted font-bold tracking-widest pl-2">Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => addToIndicators(text)} className="text-xs focus:bg-primary/10 text-primary">
                    <ShieldPlus className="h-3 w-3 mr-2" /> Add to Indicators
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => sendToLab(text)} className="text-xs focus:bg-primary/10 text-primary">
                    <Terminal className="h-3 w-3 mr-2" /> Send to Lab
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/5" />
                <DropdownMenuItem onClick={() => copyToClipboard(text, id)} className="text-xs">
                    <Copy className="h-3 w-3 mr-2" /> Copy Raw
                </DropdownMenuItem>
                <DropdownMenuLabel className="text-[9px] uppercase text-foreground-muted font-bold tracking-widest pl-2 mt-1">Copy as Code</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => copyAsFormatted(text, 'yara', id)} className="text-xs">
                    <Code2 className="h-3 w-3 mr-2 text-primary" /> Yara Rule
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => copyAsFormatted(text, 'python', id)} className="text-xs">
                    <Code2 className="h-3 w-3 mr-2 text-yellow-400" /> Python
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => copyAsFormatted(text, 'lua', id)} className="text-xs">
                    <Code2 className="h-3 w-3 mr-2 text-blue-400" /> Lua
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );

    return (
        <div className={cn(
            "flex flex-col lg:flex-row gap-4 overflow-hidden animate-in fade-in zoom-in-95 duration-500",
            fullHeight ? "h-full" : "h-[calc(100vh-280px)] min-h-[500px]"
        )}>
            {/* Left Panel */}
            <aside className="w-full lg:w-64 shrink-0 flex flex-col gap-3 min-h-0">
                <Card className="flex-col bg-card/50 backdrop-blur-sm border-primary/10 flex-1 flex overflow-hidden">
                    <CardHeader className="py-3 px-4 bg-primary/5 border-b border-primary/10">
                        <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                            <Terminal className="h-3 w-3" />
                            Scan Config
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto p-4 space-y-5">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted flex justify-between">
                                Min Length <span className="text-primary font-mono">{options.min_length}</span>
                            </Label>
                            <Input
                                type="number"
                                value={options.min_length}
                                onChange={(e) => setOptions({ ...options, min_length: parseInt(e.target.value) })}
                                className="h-8 bg-background/50 border-white/10 text-xs font-mono"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Encoding</Label>
                            <Select value={options.encoding} onValueChange={(v: any) => setOptions({ ...options, encoding: v })}>
                                <SelectTrigger className="h-8 bg-background/50 border-white/10 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ascii">ASCII</SelectItem>
                                    <SelectItem value="utf8">UTF-8</SelectItem>
                                    <SelectItem value="wide">Wide (UTF-16)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Filter</Label>
                            <Select value={options.char_type} onValueChange={(v: any) => setOptions({ ...options, char_type: v })}>
                                <SelectTrigger className="h-8 bg-background/50 border-white/10 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="printable">Printable</SelectItem>
                                    <SelectItem value="alphanumeric">Alphanumeric</SelectItem>
                                    <SelectItem value="all">Everything</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <Button
                            onClick={() => refetch()}
                            disabled={isLoading}
                            variant="outline"
                            className="w-full h-10 gap-2"
                        >
                            {isLoading ? <Filter className="h-3 w-3 animate-spin mr-2" /> : <Fingerprint className="h-3 w-3 mr-2" />}
                            {isLoading ? 'Scanning...' : 'Execute Scan'}
                        </Button>
                    </CardContent>
                </Card>
            </aside>

            {/* Right Panel */}
            <main className="flex-1 flex flex-col min-w-0 bg-card/50 backdrop-blur-sm border border-primary/10 rounded-xl overflow-hidden relative">
                {!scanned ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center opacity-60">
                        <div className="p-8 bg-primary/5 rounded-full mb-6 border border-primary/10 animate-pulse">
                            <Eye className="h-12 w-12 text-primary/40" />
                        </div>
                        <h3 className="text-sm font-bold text-foreground mb-2 uppercase tracking-widest">Awaiting Analysis</h3>
                        <p className="text-xs text-foreground-muted max-w-xs mb-8">
                            Initialize the string extraction engine to reveal IOCs and hidden data patterns.
                        </p>
                    </div>
                ) : (
                    <>
                        <header className="h-14 border-b border-white/5 bg-background/20 flex items-center justify-between px-4 shrink-0">
                            <div className="flex items-center gap-4">
                                <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
                                    <TabsList className="h-9 bg-background/40 border border-white/5 p-0.5 gap-1">
                                        <TabsTrigger value="overview" className="h-full px-4 text-[10px] uppercase font-bold tracking-wider data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-sm">
                                            Indicators <Badge variant="outline" className="ml-2 bg-primary/10 text-primary border-0 h-4 px-1 rounded-[2px]">{iocs.length}</Badge>
                                        </TabsTrigger>
                                        <TabsTrigger value="raw" className="h-full px-4 text-[10px] uppercase font-bold tracking-wider data-[state=active]:bg-primary/20 data-[state=active]:text-primary rounded-sm">
                                            Raw Output <Badge variant="outline" className="ml-2 bg-white/5 text-foreground-muted border-0 h-4 px-1 rounded-[2px]">{rawStrings.length}</Badge>
                                        </TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="relative w-48">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-white/30" />
                                    <Input
                                        placeholder="Filter results..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="h-8 pl-8 bg-background/40 border-white/5 text-xs focus-visible:ring-1 focus-visible:ring-primary/50"
                                    />
                                </div>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button size="sm" variant="outline" className="h-8 border-white/10 bg-background/20 hover:bg-white/5 gap-2 px-3">
                                            <ListFilter className="h-3 w-3" />
                                            <span className="text-[10px] uppercase font-bold tracking-wider">Bulk Actions</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-56 bg-card border-white/10">
                                        <DropdownMenuLabel className="text-[9px] uppercase text-foreground-muted font-bold tracking-widest pl-2">Automation</DropdownMenuLabel>
                                        <DropdownMenuItem
                                            onClick={handleAddAllIndicators}
                                            disabled={isBulkAdding || iocs.length === 0}
                                            className="text-xs focus:bg-primary/10 text-primary font-medium"
                                        >
                                            <ShieldPlus className="h-3.5 w-3.5 mr-2" />
                                            Add All Indicators ({iocs.length})
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator className="bg-white/5" />
                                        <DropdownMenuItem onClick={() => handleSelectAll(true)} className="text-xs">
                                            <Check className="h-3.5 w-3.5 mr-2" />
                                            Select All Visible
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setSelectedItems(new Set())} disabled={selectedItems.size === 0} className="text-xs text-destructive focus:bg-destructive/10">
                                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                                            Clear Selection
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                <Button size="sm" variant="outline" onClick={downloadResults} className="h-8 border-white/10 bg-background/20 hover:bg-white/5" title="Download">
                                    <Download className="h-3 w-3" />
                                </Button>
                                <Button size="sm" variant="destructive" onClick={handleClearCache} className="h-8 w-8 p-0 bg-destructive/20 hover:bg-destructive/40 text-destructive border border-destructive/30" title="Clear Cache">
                                    <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </header>

                        <div className="flex-1 min-h-0 relative bg-card">
                            {/* Bulk Action Bar */}
                            {selectedItems.size > 0 && (
                                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 p-2 rounded-xl bg-card border border-primary/20 animate-in slide-in-from-top-4 fade-in">
                                    <div className="px-3 text-xs font-bold text-primary border-r border-border-subtle mr-2">
                                        {selectedItems.size} Selected
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={handleBulkAdd}
                                        disabled={isBulkAdding}
                                        className="h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90 min-w-[140px]"
                                    >
                                        {isBulkAdding ? (
                                            <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                                        ) : (
                                            <ShieldPlus className="h-3 w-3 mr-1.5" />
                                        )}
                                        {isBulkAdding ? 'Adding...' : 'Add to Indicators'}
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={handleBulkSendToLab}
                                        variant="outline"
                                        className="h-7 text-xs border-primary/30 hover:bg-primary/5 text-primary"
                                    >
                                        <Terminal className="h-3 w-3 mr-1.5" />
                                        Send to Lab
                                    </Button>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button size="sm" variant="outline" className="h-7 text-xs">
                                                <Copy className="h-3 w-3 mr-1.5" />
                                                Copy As...
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuItem onClick={() => handleBulkCopy('raw')} className="text-xs">Raw List</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleBulkCopy('yara')} className="text-xs">Yara Rules</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleBulkCopy('python')} className="text-xs">Python List</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-full" onClick={() => setSelectedItems(new Set())}>
                                        ×
                                    </Button>
                                </div>
                            )}

                            {activeTab === "overview" && (
                                <div className="absolute inset-0 overflow-auto">
                                    <table className="w-full text-sm">
                                        <thead className="sticky top-0 z-10">
                                            <tr className="border-b border-border-subtle bg-background-secondary">
                                                <th className="w-10 py-3 px-4">
                                                    <Checkbox
                                                        checked={filteredIocs.length > 0 && selectedItems.size === filteredIocs.length}
                                                        onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                                    />
                                                </th>
                                                <th className="text-left py-3 px-4 text-xs font-medium text-foreground-muted uppercase tracking-wide">Type</th>
                                                <th className="text-left py-3 px-4 text-xs font-medium text-foreground-muted uppercase tracking-wide">Offset</th>
                                                <th className="text-left py-3 px-4 text-xs font-medium text-foreground-muted uppercase tracking-wide flex-1">Value</th>
                                                <th className="w-16"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredIocs.length > 0 ? (
                                                filteredIocs.map((ioc, idx) => (
                                                    <tr
                                                        key={`${ioc.offset}-${idx}`}
                                                        className={cn(
                                                            "border-b border-border-subtle last:border-0 transition-colors group",
                                                            selectedItems.has(idx) ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-primary/5"
                                                        )}
                                                    >
                                                        <td className="py-3 px-4">
                                                            <Checkbox
                                                                checked={selectedItems.has(idx)}
                                                                onCheckedChange={(checked) => handleSelectRow(idx, !!checked)}
                                                            />
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <div className="flex items-center gap-2 text-xs font-medium text-foreground-muted uppercase">
                                                                {getIocIcon(ioc.type)}
                                                                {ioc.type || 'UNKNOWN'}
                                                                {getConfidenceBadge(ioc.confidence)}
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <div className="font-mono text-xs text-foreground-muted">
                                                                0x{ioc.offset.toString(16).toUpperCase()}
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            <div className="font-mono text-xs text-primary/90 break-all line-clamp-2">
                                                                {ioc.value}
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-4 text-right">
                                                            <CopyActions text={ioc.value} id={`ioc-${idx}`} />
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={5} className="py-12 text-center text-foreground-muted">
                                                        <ShieldAlert className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                                        <span className="text-xs uppercase tracking-wide">No Indicators Detected</span>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {activeTab === "raw" && (
                                <div className="flex flex-col h-full bg-card">
                                    <div className="flex items-center border-b border-border-subtle bg-background-secondary sticky top-0 z-10">
                                        <div className="w-10 py-3 px-4 flex items-center justify-center shrink-0">
                                            <Checkbox
                                                checked={filteredRaw.length > 0 && selectedItems.size === filteredRaw.length}
                                                onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                            />
                                        </div>
                                        <div className="py-3 px-4 text-xs font-medium text-foreground-muted uppercase tracking-wide w-[120px]">Offset</div>
                                        <div className="py-3 px-4 text-xs font-medium text-foreground-muted uppercase tracking-wide w-[100px]">Encoding</div>
                                        <div className="py-3 px-4 text-xs font-medium text-foreground-muted uppercase tracking-wide flex-1">Value</div>
                                        <div className="py-3 px-4 text-xs font-medium text-foreground-muted uppercase tracking-wide w-[80px] text-right">Length</div>
                                        <div className="py-3 px-4 w-[60px]"></div>
                                    </div>
                                    <div ref={containerRef} className="flex-1 overflow-auto relative bg-card">
                                        {filteredRaw.length > 0 ? (
                                            <div style={{ height: vTotalHeight, position: 'relative' }}>
                                                {visibleItems.map(({ index, item, style }) => (
                                                    <div
                                                        key={`str-${index}`}
                                                        style={style}
                                                        className={cn(
                                                            "flex items-center border-b border-border-subtle transition-colors group box-border",
                                                            selectedItems.has(index) ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-primary/5"
                                                        )}
                                                    >
                                                        <div className="w-10 py-3 px-4 flex items-center justify-center shrink-0">
                                                            <Checkbox
                                                                checked={selectedItems.has(index)}
                                                                onCheckedChange={(checked) => handleSelectRow(index, !!checked)}
                                                            />
                                                        </div>
                                                        <div className="py-3 px-4 w-[120px] font-mono text-xs text-foreground-muted shrink-0 truncate">
                                                            {item.offset.toString(16).toUpperCase().padStart(8, '0')}
                                                        </div>
                                                        <div className="py-3 px-4 w-[100px] shrink-0">
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-foreground-muted font-mono border border-border-subtle">
                                                                {item.encoding.substring(0, 3).toUpperCase()}
                                                            </span>
                                                        </div>
                                                        <div className="py-3 px-4 flex-1 min-w-0">
                                                            <div className="font-mono text-xs text-foreground/80 break-all truncate group-hover:whitespace-normal group-hover:bg-card group-hover:absolute group-hover:z-10 group-hover:p-3 group-hover:rounded-md group-hover:border group-hover:border-primary/20 group-hover:left-[220px] group-hover:max-w-xl transition-all">
                                                                {item.value}
                                                            </div>
                                                        </div>
                                                        <div className="py-3 px-4 w-[80px] font-mono text-xs text-foreground-muted shrink-0 text-right">
                                                            {item.value.length}
                                                        </div>
                                                        <div className="py-3 px-4 w-[60px] flex justify-end shrink-0">
                                                            <CopyActions text={item.value} id={`raw-${index}`} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center h-full text-foreground-muted">
                                                <ListFilter className="h-8 w-8 mb-2 opacity-50" />
                                                <span className="text-xs uppercase tracking-wide">No Strings Found</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </main>
        </div>
    );
};
