import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { apiService } from '@/services/api.service';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertTriangle, Terminal, Copy, Search, SkipForward, Binary, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import copy from 'copy-to-clipboard';
import { saveToLabInput } from '@/lib/lab-storage';
import { HexRegion } from '@/types/hex.types';

// Constants
const ROW_HEIGHT = 22;
const BYTES_PER_ROW = 16;
const OVERSCAN = 10;

interface HexViewerNewProps {
    sha256: string;
    mimeType?: string;
    filename?: string;
    regions?: HexRegion[];
    highlightStart?: number | null;
    highlightEnd?: number | null;
}

export function HexViewerNew({ 
    sha256, 
    mimeType, 
    filename, 
    regions = [], 
    highlightStart, 
    highlightEnd 
}: HexViewerNewProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<Uint8Array | null>(null);
    const [progress, setProgress] = useState(0);
    
    // Virtualization
    const containerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [containerHeight, setContainerHeight] = useState(0);
    
    // Selection
    const [selectionStart, setSelectionStart] = useState<number | null>(null);
    const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
    const [isSelecting, setIsSelecting] = useState(false);
    const [hoveredByte, setHoveredByte] = useState<number | null>(null);
    
    // Context Menu
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    
    // Jump to Offset
    const [jumpOffset, setJumpOffset] = useState('');
    const [jumpSize, setJumpSize] = useState('');
    const [showJumpDialog, setShowJumpDialog] = useState(false);
    
    // Parser View Toggle
    const [showParser, setShowParser] = useState(false);
    
    // Search functionality
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchType, setSearchType] = useState<'hex' | 'string'>('string');
    const [searchResults, setSearchResults] = useState<number[]>([]);
    const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
    const [isSearching, setIsSearching] = useState(false);
    
    const navigate = useNavigate();
    
    // Layout for Parser View
    type LayoutBlock =
        | { type: 'hex'; start: number; end: number; rowStart: number; rowCount: number }
        | { type: 'struct'; region: HexRegion; rowStart: number; rowCount: number };
    
    const [layout, setLayout] = useState<{ blocks: LayoutBlock[]; totalRows: number }>({ 
        blocks: [], 
        totalRows: 0 
    });

    // Fetch Data
    useEffect(() => {
        let mounted = true;

        const fetchData = async () => {
            if (!sha256) return;

            setLoading(true);
            setProgress(0);
            setError(null);

            try {
                const response = await apiService.downloadFile(sha256, (prog) => {
                    if (mounted) setProgress(prog);
                });

                if (!mounted) return;

                if (response.error || !response.data) {
                    throw new Error(response.error?.message || 'Failed to load hex data');
                }

                const binaryString = window.atob(response.data.buff);
                const len = binaryString.length;
                const bytes = new Uint8Array(len);

                for (let i = 0; i < len; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }

                if (mounted) {
                    setData(bytes);
                    setLoading(false);
                }
            } catch (err: any) {
                console.error("HexViewer load error:", err);
                if (mounted) {
                    setError(err.message || 'Error loading data');
                    setLoading(false);
                }
            }
        };

        fetchData();

        return () => {
            mounted = false;
        };
    }, [sha256]);

    // Calculate Layout for Parser View
    useEffect(() => {
        if (!data || !showParser) {
            // Simple layout without parser
            const totalRows = Math.ceil(data?.length || 0 / BYTES_PER_ROW);
            setLayout({ 
                blocks: data ? [{
                    type: 'hex',
                    start: 0,
                    end: data.length - 1,
                    rowStart: 0,
                    rowCount: totalRows
                }] : [],
                totalRows 
            });
            return;
        }

        const blocks: LayoutBlock[] = [];
        let currentRow = 0;
        let currentOffset = 0;

        // Filter regions that have fields (headers)
        const structRegions = regions
            .filter(r => r.fields && r.fields.length > 0)
            .sort((a, b) => a.start - b.start);

        for (const region of structRegions) {
            // Gap before region?
            if (region.start > currentOffset) {
                const hexLen = region.start - currentOffset;
                const hexRows = Math.ceil(hexLen / BYTES_PER_ROW);
                blocks.push({
                    type: 'hex',
                    start: currentOffset,
                    end: region.start - 1,
                    rowStart: currentRow,
                    rowCount: hexRows
                });
                currentRow += hexRows;
                currentOffset = region.start;
            }

            // Struct Block
            const fieldRows = region.fields!.length;
            const rowCount = fieldRows + 1; // +1 for header

            blocks.push({
                type: 'struct',
                region,
                rowStart: currentRow,
                rowCount: rowCount
            });

            currentRow += rowCount;
            currentOffset = region.end + 1;
        }

        // Remaining data
        if (currentOffset < data.length) {
            const hexLen = data.length - currentOffset;
            const hexRows = Math.ceil(hexLen / BYTES_PER_ROW);
            blocks.push({
                type: 'hex',
                start: currentOffset,
                end: data.length - 1,
                rowStart: currentRow,
                rowCount: hexRows
            });
            currentRow += hexRows;
        }

        setLayout({ blocks, totalRows: currentRow });

    }, [data, regions, showParser]);

    // Selection Handlers
    const handleMouseDown = (e: React.MouseEvent, index: number) => {
        if (e.button !== 0) return;
        
        if (contextMenu) setContextMenu(null);
        setIsSelecting(true);
        setSelectionStart(index);
        setSelectionEnd(index);
    };

    const handleMouseEnter = (index: number) => {
        if (isSelecting) {
            setSelectionEnd(index);
        }
        setHoveredByte(index);
    };

    const handleMouseUp = () => {
        setIsSelecting(false);
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        if (selectionStart !== null && selectionEnd !== null) {
            setContextMenu({ x: e.clientX, y: e.clientY });
        }
    };

    useEffect(() => {
        const closeMenu = () => setContextMenu(null);
        const handleGlobalMouseUp = () => setIsSelecting(false);
        
        window.addEventListener('click', closeMenu);
        window.addEventListener('mouseup', handleGlobalMouseUp);
        
        return () => {
            window.removeEventListener('click', closeMenu);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, []);

    const isSelected = (index: number) => {
        if (selectionStart !== null && selectionEnd !== null) {
            const start = Math.min(selectionStart, selectionEnd);
            const end = Math.max(selectionStart, selectionEnd);
            return index >= start && index <= end;
        }
        return false;
    };

    const getSelectedBytes = (): Uint8Array | null => {
        if (!data || selectionStart === null || selectionEnd === null) return null;
        const start = Math.min(selectionStart, selectionEnd);
        const end = Math.max(selectionStart, selectionEnd);
        return data.slice(start, end + 1);
    };

    const getSelectionInfo = () => {
        if (selectionStart === null || selectionEnd === null) return null;
        const start = Math.min(selectionStart, selectionEnd);
        const end = Math.max(selectionStart, selectionEnd);
        const size = end - start + 1;
        return { start, end, size };
    };
    
    const getRegionForByte = (index: number) => {
        return regions.find(r => index >= r.start && index <= r.end);
    };

    // Jump to Offset
    const handleJumpToOffset = () => {
        if (!data) return;
        
        try {
            // Parse offset (supports hex with 0x prefix or decimal)
            let offset = 0;
            if (jumpOffset.toLowerCase().startsWith('0x')) {
                offset = parseInt(jumpOffset, 16);
            } else {
                offset = parseInt(jumpOffset, 10);
            }
            
            if (isNaN(offset) || offset < 0 || offset >= data.length) {
                toast.error('Invalid offset');
                return;
            }
            
            // Parse size if provided
            let size = 1;
            if (jumpSize) {
                size = parseInt(jumpSize, 10);
                if (isNaN(size) || size < 1) {
                    toast.error('Invalid size');
                    return;
                }
            }
            
            // Set selection
            const endOffset = Math.min(offset + size - 1, data.length - 1);
            setSelectionStart(offset);
            setSelectionEnd(endOffset);
            
            // Scroll to offset
            const row = Math.floor(offset / BYTES_PER_ROW);
            if (containerRef.current) {
                containerRef.current.scrollTo({ 
                    top: row * ROW_HEIGHT - 100, 
                    behavior: 'smooth' 
                });
            }
            
            setShowJumpDialog(false);
            toast.success(`Jumped to offset 0x${offset.toString(16).toUpperCase()}`);
        } catch (err) {
            toast.error('Invalid input');
        }
    };

    // Send to Lab
    const handleSendToLab = (format: 'hex' | 'ascii') => {
        const bytes = getSelectedBytes();
        if (!bytes) return;

        let content = '';
        if (format === 'hex') {
            content = Array.from(bytes)
                .map(b => b.toString(16).padStart(2, '0').toUpperCase())
                .join(' ');
        } else {
            content = Array.from(bytes)
                .map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.')
                .join('');
        }

        saveToLabInput(content);
        toast.info(`Sent ${format.toUpperCase()} selection to Cyber Lab`);
        setContextMenu(null);
        navigate('/lab');
    };

    // Copy Functions
    const handleCopy = (format: 'hex' | 'ascii' | 'yara' | 'python' | 'c') => {
        const bytes = getSelectedBytes();
        if (!bytes) return;

        let content = '';
        const hexArray = Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase());
        
        switch (format) {
            case 'hex':
                content = hexArray.join(' ');
                break;
            case 'ascii':
                content = Array.from(bytes)
                    .map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.')
                    .join('');
                break;
            case 'yara':
                content = `{ ${hexArray.join(' ')} }`;
                break;
            case 'python':
                content = `b'${Array.from(bytes).map(b => '\\x' + b.toString(16).padStart(2, '0')).join('')}'`;
                break;
            case 'c':
                content = `unsigned char data[] = { ${hexArray.map(h => '0x' + h).join(', ')} };`;
                break;
        }

        copy(content);
        toast.success(`Copied as ${format.toUpperCase()}`);
        setContextMenu(null);
    };

    // Search Functions
    const performSearch = () => {
        if (!data || !searchQuery) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        const results: number[] = [];

        try {
            if (searchType === 'hex') {
                // Parse hex input (supports spaces, 0x prefix, etc.)
                const cleanHex = searchQuery
                    .replace(/0x/gi, '')
                    .replace(/[^0-9A-Fa-f]/g, '');
                
                if (cleanHex.length === 0 || cleanHex.length % 2 !== 0) {
                    toast.error('Invalid hex input (must be even number of hex digits)');
                    setIsSearching(false);
                    return;
                }

                const searchBytes: number[] = [];
                for (let i = 0; i < cleanHex.length; i += 2) {
                    searchBytes.push(parseInt(cleanHex.substr(i, 2), 16));
                }

                // Search for byte pattern
                for (let i = 0; i <= data.length - searchBytes.length; i++) {
                    let match = true;
                    for (let j = 0; j < searchBytes.length; j++) {
                        if (data[i + j] !== searchBytes[j]) {
                            match = false;
                            break;
                        }
                    }
                    if (match) {
                        results.push(i);
                    }
                }
            } else {
                // String search (ASCII)
                const searchBytes = new TextEncoder().encode(searchQuery);
                
                for (let i = 0; i <= data.length - searchBytes.length; i++) {
                    let match = true;
                    for (let j = 0; j < searchBytes.length; j++) {
                        if (data[i + j] !== searchBytes[j]) {
                            match = false;
                            break;
                        }
                    }
                    if (match) {
                        results.push(i);
                    }
                }
            }

            setSearchResults(results);
            setCurrentSearchIndex(0);

            if (results.length > 0) {
                toast.success(`Found ${results.length} match${results.length > 1 ? 'es' : ''}`);
                jumpToSearchResult(0, results);
            } else {
                toast.info('No matches found');
            }
        } catch (err: any) {
            toast.error(`Search error: ${err.message}`);
        } finally {
            setIsSearching(false);
        }
    };

    const jumpToSearchResult = (index: number, results: number[] = searchResults) => {
        if (results.length === 0) return;

        const offset = results[index];
        const searchLength = searchType === 'hex' 
            ? searchQuery.replace(/0x/gi, '').replace(/[^0-9A-Fa-f]/g, '').length / 2
            : searchQuery.length;

        // Set selection
        setSelectionStart(offset);
        setSelectionEnd(offset + searchLength - 1);

        // Scroll to result
        const row = Math.floor(offset / BYTES_PER_ROW);
        if (containerRef.current) {
            containerRef.current.scrollTo({ 
                top: row * ROW_HEIGHT - 100, 
                behavior: 'smooth' 
            });
        }
    };

    const nextSearchResult = () => {
        if (searchResults.length === 0) return;
        const nextIndex = (currentSearchIndex + 1) % searchResults.length;
        setCurrentSearchIndex(nextIndex);
        jumpToSearchResult(nextIndex);
    };

    const previousSearchResult = () => {
        if (searchResults.length === 0) return;
        const prevIndex = currentSearchIndex === 0 
            ? searchResults.length - 1 
            : currentSearchIndex - 1;
        setCurrentSearchIndex(prevIndex);
        jumpToSearchResult(prevIndex);
    };

    const clearSearch = () => {
        setSearchQuery('');
        setSearchResults([]);
        setCurrentSearchIndex(0);
        setSelectionStart(null);
        setSelectionEnd(null);
    };

    // Handle Resize
    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerHeight(entry.contentRect.height);
            }
        });

        observer.observe(containerRef.current);
        setContainerHeight(containerRef.current.clientHeight);

        return () => observer.disconnect();
    }, [loading]);

    // Handle Scroll
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
    };

    // Calculate total rows from layout
    const totalRows = layout.totalRows;

    // Render functions - MUST be defined with useCallback before useMemo
    const renderHexRow = useCallback((i: number, byteOffset: number, rowData: Uint8Array) => {
        return (
            <div key={i} className="flex h-[22px] hover:bg-white/[0.04] group">
                {/* Offset */}
                <div className="text-primary/50 w-24 shrink-0 select-none mr-6 font-medium opacity-70 px-4 text-xs font-mono flex items-center">
                    {byteOffset.toString(16).padStart(8, '0').toUpperCase()}
                </div>

                {/* Hex Bytes */}
                <div className="text-foreground/90 w-[450px] shrink-0 font-medium tracking-wide flex items-center font-mono text-xs">
                    {Array.from(rowData).map((byte, bIdx) => {
                        const globalIdx = byteOffset + bIdx;
                        const selected = isSelected(globalIdx);
                        const isHovered = hoveredByte === globalIdx;
                        const isHighlighted = highlightStart !== null && highlightEnd !== null && 
                            globalIdx >= highlightStart && globalIdx <= highlightEnd;
                        const region = showParser ? getRegionForByte(globalIdx) : null;

                        return (
                            <span
                                key={bIdx}
                                className={`inline-block text-center mr-3 w-6 cursor-pointer select-none transition-all
                                    ${selected ? 'bg-primary text-primary-foreground font-bold scale-110 shadow-sm' :
                                    isHighlighted ? 'bg-yellow-500/50 text-white font-bold rounded-sm ring-1 ring-yellow-400' :
                                    isHovered ? 'bg-primary/20 text-primary font-bold rounded-sm scale-105' :
                                    region ? region.color : ''}
                                    ${(selected || isHighlighted || region) ? 'rounded-sm' : ''}
                                `}
                                onMouseEnter={() => handleMouseEnter(globalIdx)}
                                onMouseDown={(e) => handleMouseDown(e, globalIdx)}
                            >
                                {byte.toString(16).padStart(2, '0').toUpperCase()}
                            </span>
                        );
                    })}
                    {/* Padding for incomplete rows */}
                    {rowData.length < BYTES_PER_ROW && (
                        <span style={{ width: (BYTES_PER_ROW - rowData.length) * 36 }}></span>
                    )}
                </div>

                {/* ASCII */}
                <div className="border-l border-border-subtle/30 pl-8 ml-2 tracking-[0.2em] opacity-80 text-foreground-muted/80 flex items-center text-xs font-mono">
                    {Array.from(rowData).map((byte, bIdx) => {
                        const globalIdx = byteOffset + bIdx;
                        const selected = isSelected(globalIdx);
                        const char = (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
                        
                        return (
                            <span
                                key={bIdx}
                                className={`w-[1ch] text-center cursor-pointer
                                    ${selected ? 'bg-primary text-primary-foreground font-bold' : ''}
                                `}
                                onMouseEnter={() => handleMouseEnter(globalIdx)}
                                onMouseDown={(e) => handleMouseDown(e, globalIdx)}
                            >
                                {char}
                            </span>
                        );
                    })}
                </div>
            </div>
        );
    }, [isSelected, hoveredByte, highlightStart, highlightEnd, showParser, getRegionForByte, handleMouseEnter, handleMouseDown]);

    const renderStructRow = useCallback((i: number, block: LayoutBlock & { type: 'struct' }, relativeIndex: number) => {
        if (!data) return null;
        
        const region = block.region;

        if (relativeIndex === 0) {
            // Struct Header
            return (
                <div key={i} className={`flex h-[22px] items-center px-4 bg-white/[0.02] border-l-4 ${region.color.replace('bg-', 'border-').replace('/20', '')}`}>
                    <div className="text-primary/70 font-bold text-xs font-mono w-24 shrink-0 mr-6">
                        {region.start.toString(16).padStart(8, '0').toUpperCase()}
                    </div>
                    <div className="text-xs font-bold font-mono text-primary flex items-center gap-2">
                        <span className="text-primary/70 dark:text-purple-400">struct</span>
                        <span className="text-foreground">{region.label}</span>
                        <span className="text-foreground-muted text-[10px]">{`{ // size: ${region.end - region.start + 1} bytes }`}</span>
                    </div>
                </div>
            );
        } else {
            // Field Row
            const fieldIndex = relativeIndex - 1;
            const field = region.fields![fieldIndex];
            if (!field) return null;
            
            const fieldBytes = data.slice(field.offset, field.offset + Math.min(field.size, 16));

            return (
                <div key={i} className="flex h-[22px] items-center px-4 hover:bg-white/[0.04] group">
                    {/* Offset */}
                    <div className="text-primary/30 w-24 shrink-0 mr-6 font-mono text-xs opacity-50 group-hover:opacity-100">
                        {field.offset.toString(16).padStart(8, '0').toUpperCase()}
                    </div>

                    {/* Bytes (Mini) */}
                    <div className="w-[200px] shrink-0 flex text-[10px] font-mono text-foreground-muted/50 mr-4 overflow-hidden">
                        {Array.from(fieldBytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')}
                        {field.size > 16 && <span className="ml-1">...</span>}
                    </div>

                    {/* Field Def */}
                    <div className="flex items-center gap-2 font-mono text-xs">
                        <span className="text-primary/70 dark:text-blue-400">{field.type}</span>
                        <span className="text-foreground font-bold">{field.name}</span>
                        <span className="text-foreground-muted">=</span>
                        <span className="text-accent dark:text-green-400">{field.value}</span>
                    </div>
                </div>
            );
        }
    }, [data]);

    // Calculate visible rows
    const { visibleRows, startOffset } = useMemo(() => {
        if (!data || totalRows === 0 || containerHeight === 0) {
            return { visibleRows: [], startOffset: 0 };
        }

        const startIndex = Math.floor(scrollTop / ROW_HEIGHT);
        const renderStartIndex = Math.max(0, startIndex - OVERSCAN);
        const visibleCount = Math.ceil(containerHeight / ROW_HEIGHT) + 2 * OVERSCAN;
        const renderEndIndex = Math.min(totalRows, renderStartIndex + visibleCount);

        const rows: React.ReactNode[] = [];

        if (!showParser || layout.blocks.length === 0) {
            // Simple hex view without parser
            for (let i = renderStartIndex; i < renderEndIndex; i++) {
                const byteOffset = i * BYTES_PER_ROW;
                const endByte = Math.min(byteOffset + BYTES_PER_ROW, data.length);
                const rowData = data.slice(byteOffset, endByte);

                rows.push(renderHexRow(i, byteOffset, rowData));
            }
        } else {
            // Parser view with structured blocks
            for (let i = renderStartIndex; i < renderEndIndex; i++) {
                const block = layout.blocks.find(b => i >= b.rowStart && i < b.rowStart + b.rowCount);
                if (!block) continue;

                const relativeIndex = i - block.rowStart;

                if (block.type === 'hex') {
                    const byteOffset = block.start + (relativeIndex * BYTES_PER_ROW);
                    const endByte = Math.min(byteOffset + BYTES_PER_ROW, block.end + 1);
                    const rowData = data.slice(byteOffset, endByte);
                    rows.push(renderHexRow(i, byteOffset, rowData));
                } else if (block.type === 'struct') {
                    rows.push(renderStructRow(i, block, relativeIndex));
                }
            }
        }

        return { visibleRows: rows, startOffset: renderStartIndex * ROW_HEIGHT };
    }, [data, totalRows, scrollTop, containerHeight, hoveredByte, selectionStart, selectionEnd, highlightStart, highlightEnd, showParser, layout, regions, renderHexRow, renderStructRow]);


    // Render Loading State
    if (loading) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center space-y-4 p-8 bg-card border border-border-subtle rounded-lg">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <div className="text-center">
                    <h3 className="text-sm font-bold text-foreground">Loading Binary Data</h3>
                    <p className="text-xs text-foreground-muted">Fetching... {progress.toFixed(0)}%</p>
                </div>
            </div>
        );
    }

    // Render Error State
    if (error) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center p-8 bg-card border border-border-subtle rounded-lg">
                <AlertTriangle className="h-10 w-10 text-destructive mb-2 opacity-80" />
                <p className="text-sm text-foreground-muted mb-4">{error}</p>
                <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                    Retry
                </Button>
            </div>
        );
    }

    if (!data) return null;

    const selectionInfo = getSelectionInfo();

    return (
        <div 
            className="flex flex-col h-full w-full bg-card border border-border-subtle rounded-lg overflow-hidden shadow-sm select-none relative"
            onContextMenu={handleContextMenu}
        >
            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed z-50 min-w-[200px] bg-background border border-border-subtle rounded-md shadow-xl p-1 animate-in fade-in zoom-in-95 duration-100"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="px-2 py-1.5 text-[10px] uppercase font-bold text-foreground-muted border-b border-white/5 mb-1 tracking-widest">
                        Selection Actions
                    </div>
                    
                    <button 
                        onClick={() => handleCopy('hex')} 
                        className="w-full text-left px-3 py-2 text-xs text-foreground/80 hover:bg-white/5 hover:text-primary rounded flex items-center gap-2 transition-colors"
                    >
                        <Copy className="h-3.5 w-3.5" /> Copy as Hex
                    </button>
                    
                    <button 
                        onClick={() => handleCopy('ascii')} 
                        className="w-full text-left px-3 py-2 text-xs text-foreground/80 hover:bg-white/5 hover:text-cyan-400 rounded flex items-center gap-2 transition-colors"
                    >
                        <Copy className="h-3.5 w-3.5" /> Copy as ASCII
                    </button>
                    
                    <div className="h-px bg-white/5 my-1" />
                    
                    <button 
                        onClick={() => handleCopy('yara')} 
                        className="w-full text-left px-3 py-2 text-xs text-foreground/80 hover:bg-white/5 hover:text-green-400 rounded flex items-center gap-2 transition-colors"
                    >
                        <Copy className="h-3.5 w-3.5" /> Copy as YARA
                    </button>
                    
                    <button 
                        onClick={() => handleCopy('python')} 
                        className="w-full text-left px-3 py-2 text-xs text-foreground/80 hover:bg-white/5 hover:text-yellow-400 rounded flex items-center gap-2 transition-colors"
                    >
                        <Copy className="h-3.5 w-3.5" /> Copy as Python
                    </button>
                    
                    <button 
                        onClick={() => handleCopy('c')} 
                        className="w-full text-left px-3 py-2 text-xs text-foreground/80 hover:bg-white/5 hover:text-blue-400 rounded flex items-center gap-2 transition-colors"
                    >
                        <Copy className="h-3.5 w-3.5" /> Copy as C Array
                    </button>
                    
                    <div className="h-px bg-white/5 my-1" />
                    
                    <div className="px-2 py-1 text-[9px] uppercase font-bold text-foreground-muted tracking-widest">
                        Send to Cyber Lab
                    </div>
                    
                    <button 
                        onClick={() => handleSendToLab('hex')} 
                        className="w-full text-left px-3 py-2 text-xs text-foreground/80 hover:bg-white/5 hover:text-purple-400 rounded flex items-center gap-2 transition-colors"
                    >
                        <Terminal className="h-3.5 w-3.5" /> Send as Hex
                    </button>
                    
                    <button 
                        onClick={() => handleSendToLab('ascii')} 
                        className="w-full text-left px-3 py-2 text-xs text-foreground/80 hover:bg-white/5 hover:text-purple-400 rounded flex items-center gap-2 transition-colors"
                    >
                        <Terminal className="h-3.5 w-3.5" /> Send as ASCII
                    </button>
                </div>
            )}

            {/* Header with Controls */}
            <div className="bg-background-secondary/40 border-b border-border-subtle px-4 py-2 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <span className="text-xs font-bold text-foreground">Hex Inspector</span>
                    <span className="text-[10px] text-foreground-muted">
                        {data.length.toLocaleString()} bytes
                    </span>
                    
                    {selectionInfo && (
                        <div className="flex items-center gap-2 text-[10px] text-primary font-mono">
                            <span className="bg-primary/10 px-2 py-0.5 rounded">
                                Offset: 0x{selectionInfo.start.toString(16).toUpperCase()}
                            </span>
                            <span className="bg-primary/10 px-2 py-0.5 rounded">
                                Size: {selectionInfo.size} bytes
                            </span>
                        </div>
                    )}
                </div>
                
                <div className="flex items-center gap-2">
                    <Button
                        variant={showSearch ? "default" : "outline"}
                        size="sm"
                        onClick={() => setShowSearch(!showSearch)}
                        className="h-7 text-xs"
                    >
                        <Search className="h-3 w-3 mr-1" />
                        Search
                    </Button>
                    
                    {regions.length > 0 && (
                        <Button
                            variant={showParser ? "default" : "outline"}
                            size="sm"
                            onClick={() => setShowParser(!showParser)}
                            className="h-7 text-xs"
                        >
                            <Binary className="h-3 w-3 mr-1" />
                            {showParser ? 'Hide Parser' : 'Show Parser'}
                        </Button>
                    )}
                    
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowJumpDialog(!showJumpDialog)}
                        className="h-7 text-xs"
                    >
                        <SkipForward className="h-3 w-3 mr-1" />
                        Jump to Offset
                    </Button>
                </div>
            </div>

            {/* Jump Dialog */}
            {showJumpDialog && (
                <div className="bg-background-secondary/60 border-b border-border-subtle px-4 py-3 flex items-end gap-3">
                    <div className="flex-1">
                        <Label htmlFor="jumpOffset" className="text-xs text-foreground-muted mb-1">
                            Offset (hex or decimal)
                        </Label>
                        <Input
                            id="jumpOffset"
                            value={jumpOffset}
                            onChange={(e) => setJumpOffset(e.target.value)}
                            placeholder="0x1000 or 4096"
                            className="h-8 text-xs font-mono"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleJumpToOffset();
                            }}
                        />
                    </div>
                    
                    <div className="flex-1">
                        <Label htmlFor="jumpSize" className="text-xs text-foreground-muted mb-1">
                            Size (bytes, optional)
                        </Label>
                        <Input
                            id="jumpSize"
                            value={jumpSize}
                            onChange={(e) => setJumpSize(e.target.value)}
                            placeholder="16"
                            className="h-8 text-xs font-mono"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleJumpToOffset();
                            }}
                        />
                    </div>
                    
                    <Button
                        onClick={handleJumpToOffset}
                        size="sm"
                        className="h-8"
                    >
                        <Search className="h-3 w-3 mr-1" />
                        Jump
                    </Button>
                </div>
            )}

            {/* Search Dialog */}
            {showSearch && (
                <div className="bg-background-secondary/60 border-b border-border-subtle px-4 py-3">
                    <div className="flex items-end gap-3">
                        <div className="flex-1">
                            <Label htmlFor="searchQuery" className="text-xs text-foreground-muted mb-1">
                                Search Query
                            </Label>
                            <Input
                                id="searchQuery"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={searchType === 'hex' ? '48 65 6C 6C 6F or 0x48656C6C6F' : 'Search text...'}
                                className="h-8 text-xs font-mono"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') performSearch();
                                }}
                            />
                        </div>
                        
                        <div className="flex items-center gap-2 bg-background-secondary/40 rounded-md p-1 h-8">
                            <button
                                onClick={() => setSearchType('string')}
                                className={`px-3 py-1 text-xs rounded transition-colors ${
                                    searchType === 'string' 
                                        ? 'bg-primary text-primary-foreground font-medium' 
                                        : 'text-foreground-muted hover:text-foreground'
                                }`}
                            >
                                String
                            </button>
                            <button
                                onClick={() => setSearchType('hex')}
                                className={`px-3 py-1 text-xs rounded transition-colors ${
                                    searchType === 'hex' 
                                        ? 'bg-primary text-primary-foreground font-medium' 
                                        : 'text-foreground-muted hover:text-foreground'
                                }`}
                            >
                                Hex
                            </button>
                        </div>
                        
                        <Button
                            onClick={performSearch}
                            size="sm"
                            className="h-8"
                            disabled={isSearching || !searchQuery}
                        >
                            {isSearching ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                                <Search className="h-3 w-3 mr-1" />
                            )}
                            Search
                        </Button>
                        
                        {searchResults.length > 0 && (
                            <>
                                <div className="flex items-center gap-1 bg-background-secondary/40 rounded-md p-1 h-8">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={previousSearchResult}
                                        className="h-6 w-6 p-0"
                                    >
                                        <ChevronLeft className="h-3 w-3" />
                                    </Button>
                                    
                                    <span className="text-xs font-mono px-2 text-foreground-muted">
                                        {currentSearchIndex + 1} / {searchResults.length}
                                    </span>
                                    
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={nextSearchResult}
                                        className="h-6 w-6 p-0"
                                    >
                                        <ChevronRight className="h-3 w-3" />
                                    </Button>
                                </div>
                                
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearSearch}
                                    className="h-8 w-8 p-0"
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Hex Content */}
            <div className="flex-1 min-h-0 flex bg-background/50 relative font-mono cursor-text">
                <div
                    ref={containerRef}
                    onScroll={handleScroll}
                    className="flex-1 min-h-0 w-full overflow-y-auto custom-scrollbar relative"
                >
                    <div style={{ height: totalRows * ROW_HEIGHT, position: 'relative' }}>
                        <div style={{ 
                            position: 'absolute', 
                            top: 0, 
                            left: 0, 
                            right: 0, 
                            transform: `translateY(${startOffset}px)` 
                        }}>
                            {visibleRows}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
