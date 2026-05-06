import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useYaraRules, useYaraSourceFiles } from '@/hooks/useEndpointData';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorDisplay } from '@/components/common/ErrorDisplay';
import { ApiError, apiService } from '@/services/api.service';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Braces, Info, Tag, FileCode, Terminal, Folder, File, ChevronRight, ChevronDown, Package, MoreVertical, Trash2, AlertTriangle } from 'lucide-react';
import { YaraRule, YaraSourceFile } from '@/types/threat.types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { LayoutList } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { MainLayoutContextType } from '@/components/layout/MainLayout';

const ITEM_HEIGHT = 52;
const OVERSCAN = 10;

export default function YaraRulesView() {
    const { navbarPosition } = useOutletContext<MainLayoutContextType>() || { navbarPosition: 'side' };
    const { data: rules, isLoading: rulesLoading, isError: rulesError, error: rulesErr, refetch: refetchRules } = useYaraRules();
    const { data: sourceFiles, isLoading: sourceLoading, isError: sourceError, error: sourceErr, refetch: refetchSource } = useYaraSourceFiles();

    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({ "default": true });
    const [menuOpen, setMenuOpen] = useState<{ id: string | number, x: number, y: number } | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<YaraSourceFile | null>(null);

    // Internal scroll state for virtualization
    const containerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [containerHeight, setContainerHeight] = useState(0);

    // Group source files by namespace
    const groupedSources = useMemo(() => {
        if (!sourceFiles) return {};
        return sourceFiles.reduce((acc, file) => {
            const ns = file.namespace || 'default';
            if (!acc[ns]) acc[ns] = [];
            acc[ns].push(file);
            return acc;
        }, {} as Record<string, YaraSourceFile[]>);
    }, [sourceFiles]);

    const toggleFolder = (ns: string) => {
        setExpandedFolders(prev => ({ ...prev, [ns]: !prev[ns] }));
    };

    const renderExplorerContent = () => {
        return Object.entries(groupedSources).map(([ns, files]) => (
            <div key={ns} className="space-y-1">
                <button
                    onClick={() => toggleFolder(ns)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-background-secondary transition-colors group min-w-0"
                >
                    {expandedFolders[ns] ? <ChevronDown size={14} className="text-primary shrink-0" /> : <ChevronRight size={14} className="text-foreground-muted shrink-0" />}
                    <Folder size={16} className={cn("shrink-0", expandedFolders[ns] ? "text-primary/70 fill-primary/10" : "text-foreground-muted")} />
                    <span className={cn("text-xs font-medium truncate", expandedFolders[ns] ? "text-foreground" : "text-foreground-muted group-hover:text-foreground")}>
                        {ns}
                    </span>
                    <span className="ml-auto text-[10px] text-foreground-muted opacity-50 font-mono shrink-0">
                        {files.length}
                    </span>
                </button>

                {expandedFolders[ns] && (
                    <div className="ml-4 pl-4 border-l border-border-subtle/50 space-y-0.5 mt-1">
                        {files.map((file, idx) => (
                            <div key={file.id || `${ns}-${file.file}-${idx}`} className="group relative flex items-center">
                                <button
                                    onClick={() => navigate('/rules/editor', {
                                        state: { rules: file.content, namespace: file.namespace, fileName: file.file }
                                    })}
                                    className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded hover:bg-primary/5 text-left transition-all min-w-0"
                                >
                                    <File size={13} className="text-foreground-muted group-hover:text-primary/70 shrink-0" />
                                    <span className="text-xs text-foreground-muted group-hover:text-foreground truncate font-mono">
                                        {file.file}
                                    </span>
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteConfirm(file);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-all shrink-0"
                                    title="Delete Rule"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        ));
    };

    useEffect(() => {
        if (!containerRef.current) return;
        const element = containerRef.current;
        const handleScroll = () => requestAnimationFrame(() => setScrollTop(element.scrollTop));
        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) setContainerHeight(entry.contentRect.height);
        });
        element.addEventListener('scroll', handleScroll);
        resizeObserver.observe(element);
        setContainerHeight(element.clientHeight);
        return () => {
            element.removeEventListener('scroll', handleScroll);
            resizeObserver.disconnect();
        };
    }, []);

    const filteredRules = useMemo(() => {
        if (!rules || !Array.isArray(rules)) return [];
        const lowerQuery = searchQuery.toLowerCase();
        return rules.filter(rule => {
            if (!rule) return false;
            const id = rule.identifier || '';
            const ns = (typeof rule.namespace === 'string' ? rule.namespace : (rule.namespace as any)?.name) || 'default';
            return id.toLowerCase().includes(lowerQuery) || ns.toLowerCase().includes(lowerQuery);
        });
    }, [rules, searchQuery]);

    const totalCount = filteredRules.length;
    const totalHeight = totalCount * ITEM_HEIGHT;
    const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - OVERSCAN);
    const endIndex = Math.min(totalCount, Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + OVERSCAN);

    const visibleItems = [];
    for (let i = startIndex; i < endIndex; i++) {
        visibleItems.push({
            index: i,
            rule: filteredRules[i],
            style: {
                position: 'absolute',
                top: i * ITEM_HEIGHT,
                left: 0,
                width: '100%',
                height: ITEM_HEIGHT,
            } as React.CSSProperties
        });
    }

    if (rulesLoading || sourceLoading) return <LoadingState message="Deep scanning rule intelligence..." />;

    const handleDelete = async (file: YaraSourceFile) => {
        try {
            const response = await apiService.deleteYaraRuleFile(file.file, file.namespace);
            if (response.error) {
                toast.error(`Delete failed: ${response.error.message}`);
            } else {
                toast.success(`Rule ${file.file} deleted`);
                refetchSource();
                refetchRules();
            }
        } catch (err) {
            toast.error("An unexpected error occurred during deletion.");
        } finally {
            setDeleteConfirm(null);
        }
    };


    return (
        <div className={cn(
            "flex flex-col gap-6 animate-in fade-in duration-500",
            navbarPosition === 'top' ? "h-[calc(100vh-56px)]" : "h-full"
        )}>
            {/* Header & Stats Strip */}
            <div className="flex flex-col md:flex-row gap-6 shrink-0">
                <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
                            <Input
                                placeholder="Search rules or namespaces..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 bg-background-secondary border-border-subtle focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-foreground/20 focus:bg-background-elevated transition-all"
                            />
                        </div>
                        <Button onClick={() => navigate('/rules/editor')} variant="outline" className="gap-2 h-10">
                            <Terminal className="h-4 w-4" />
                            <span className="hidden sm:inline font-bold uppercase tracking-widest text-[11px]">New Ruleset</span>
                        </Button>

                        {/* Mobile Explorer Trigger */}
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="outline" size="icon" className="lg:hidden h-10 w-10 shrink-0">
                                    <LayoutList className="h-4 w-4" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-[300px] p-0 bg-card border-r border-border-subtle">
                                <SheetHeader className="p-4 border-b border-border-subtle bg-background-secondary/30">
                                    <SheetTitle className="text-xs font-bold uppercase tracking-widest text-foreground-muted flex items-center gap-2">
                                        <Package className="h-3.5 w-3.5 text-primary" />
                                        Rule Explorer
                                    </SheetTitle>
                                </SheetHeader>
                                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                                    {renderExplorerContent()}
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-card border border-border-subtle p-3 rounded-lg shadow-sm">
                            <p className="text-[10px] text-foreground-muted font-bold uppercase tracking-widest mb-1">Active Rules</p>
                            <p className="text-xl font-bold text-primary">{rules?.length || 0}</p>
                        </div>
                        <div className="bg-card border border-border-subtle p-3 rounded-lg shadow-sm">
                            <p className="text-[10px] text-foreground-muted font-bold uppercase tracking-widest mb-1">Source Files</p>
                            <p className="text-xl font-bold">{sourceFiles?.length || 0}</p>
                        </div>
                        <div className="bg-card border border-border-subtle p-3 rounded-lg shadow-sm">
                            <p className="text-[10px] text-foreground-muted font-bold uppercase tracking-widest mb-1">Namespaces</p>
                            <p className="text-xl font-bold">{Object.keys(groupedSources).length}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Application Area (Sidebar + Table) */}
            <div className="flex-1 flex gap-6 min-h-0 overflow-hidden">
                
                {/* Desktop Sidebar - Rule Explorer */}
                <div className="hidden lg:flex w-[280px] bg-card border border-border-subtle rounded-xl overflow-hidden flex-col shadow-sm shrink-0">
                    <div className="flex items-center border-b border-border-subtle bg-background-secondary/30 px-4 h-12 shrink-0">
                        <div className="flex items-center gap-2">
                            <Package className="h-3.5 w-3.5 text-primary" />
                            <span className="text-xs font-bold uppercase tracking-widest text-foreground-muted">Rule Explorer</span>
                        </div>
                        <div className="ml-auto text-[10px] text-foreground-muted opacity-50 font-mono">
                            {sourceFiles?.length || 0}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                        {Object.keys(groupedSources).length > 0 ? renderExplorerContent() : (
                            <div className="flex flex-col items-center justify-center h-full text-foreground-muted text-xs p-6 opacity-40">
                                <FileCode className="h-12 w-12 mb-3" />
                                <p className="font-bold tracking-widest uppercase text-center">No rule files found</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Rules Table Content */}
                <div className="flex-1 bg-card border border-border-subtle rounded-xl overflow-hidden flex flex-col shadow-sm min-w-0">
                    <div className="flex items-center border-b border-border-subtle bg-background-secondary/30 px-6 h-12 shrink-0 text-[10px] font-bold text-foreground-muted uppercase tracking-widest">
                        <div className="w-[35%]">Signature / Rule</div>
                        <div className="w-[15%]">Namespace</div>
                        <div className="w-[35%]">Metadata</div>
                        <div className="w-[15%]">Tags</div>
                    </div>

                    <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden relative custom-scrollbar">
                        {filteredRules.length > 0 ? (
                            <div style={{ height: totalHeight, position: 'relative' }}>
                                {visibleItems.map(({ index, rule, style }) => (
                                    <div
                                        key={`${rule.identifier}-${index}`}
                                        style={style}
                                        onClick={() => navigate(`/rules/${rule.identifier}`)}
                                        className="flex items-center px-6 border-b border-border-subtle/30 hover:bg-primary/5 transition-colors text-sm group cursor-pointer overflow-hidden min-w-0"
                                    >
                                        <div className="w-[35%] flex items-center gap-3 pr-4 group-hover:translate-x-1 transition-transform min-w-0 shrink-0">
                                            <Braces className="h-4 w-4 text-primary shrink-0 opacity-70" />
                                            <span className="font-mono font-bold truncate text-foreground/90" title={rule.identifier}>
                                                {rule.identifier}
                                            </span>
                                        </div>
                                        <div className="w-[15%] pr-4 uppercase text-[10px] font-bold tracking-tighter opacity-60 truncate shrink-0" title={typeof rule.namespace === 'string' ? rule.namespace : (rule.namespace as any)?.name || 'default'}>
                                            {typeof rule.namespace === 'string' ? rule.namespace : (rule.namespace as any)?.name || 'default'}
                                        </div>
                                        <div className="w-[35%] pr-4 flex items-center gap-4 overflow-hidden shrink-0">
                                            {rule.metas && (Array.isArray(rule.metas) ? rule.metas : Object.entries(rule.metas))
                                                .map(item => {
                                                    const [key, rawValue] = Array.isArray(rule.metas) ? [null, item] : (item as [string, any]);
                                                    const identifier = rawValue.identifier || key;
                                                    const displayValue = typeof rawValue === 'object' && rawValue !== null ? String(rawValue.value ?? '') : String(rawValue);
                                                    return { identifier, displayValue };
                                                })
                                                .filter(meta => ['author', 'description', 'last_modified'].includes(meta.identifier))
                                                .map(meta => (
                                                    <div key={`meta-${index}-${meta.identifier}`} className="flex flex-col leading-tight max-w-[150px] min-w-0">
                                                        <span className="text-[8px] font-bold uppercase text-foreground-muted/40 tracking-widest">{meta.identifier}</span>
                                                        <span className="text-[11px] text-foreground-muted truncate font-medium">{meta.displayValue}</span>
                                                    </div>
                                                ))}
                                        </div>
                                        <div className="w-[15%] flex gap-1.5 overflow-hidden shrink-0">
                                            {rule.tags && (Array.isArray(rule.tags) ? rule.tags : Object.keys(rule.tags)).slice(0, 2).map((tag: any, i: number) => {
                                                const tagLabel = typeof tag === 'string' ? tag : (tag.name || String(tag));
                                                return (
                                                    <Badge key={`tag-${index}-${i}`} variant="secondary" className="text-[9px] h-4 font-bold border-border-subtle bg-background-secondary text-foreground-muted/80">
                                                        {tagLabel}
                                                    </Badge>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-foreground-muted text-sm p-12 opacity-30">
                                <Braces className="h-16 w-16 mb-4" />
                                <p className="font-bold tracking-widest uppercase text-xs">No active signatures matched</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {/* Delete Confirmation Dialog */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-card border border-border-subtle p-6 rounded-xl shadow-xl max-w-sm w-full space-y-4 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            <h3 className="font-bold">Remove Signature?</h3>
                        </div>
                        <p className="text-sm text-foreground-muted leading-relaxed">
                            You are about to delete <span className="font-mono text-foreground font-bold">{deleteConfirm.file}</span> from namespace <span className="font-bold text-foreground">{deleteConfirm.namespace}</span>.
                            This action is irreversible.
                        </p>
                        <div className="flex gap-2 justify-end pt-2">
                            <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(null)}>
                                Cancel
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => handleDelete(deleteConfirm)}>
                                Yes, Delete
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
