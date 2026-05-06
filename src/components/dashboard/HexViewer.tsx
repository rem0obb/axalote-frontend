import { useState, useEffect, useRef, useMemo } from 'react';
import { apiService } from '@/services/api.service';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertTriangle, Binary, Copy, Terminal, Code2, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import copy from 'copy-to-clipboard';
import { saveToLabInput } from '@/lib/lab-storage';
// HtmlPreview moved to CodeViewer component

import { HexRegion } from '@/types/hex.types';

// Constants
const ROW_HEIGHT = 22; // px
const BYTES_PER_ROW = 16;
const OVERSCAN = 10; // Extra rows to render

interface HexViewerProps {
    sha256: string;
    mimeType?: string;
    filename?: string;
    regions?: HexRegion[];
    highlightStart?: number | null;
    highlightEnd?: number | null;
}

export function HexViewer({ sha256, mimeType, filename, regions = [], highlightStart, highlightEnd }: HexViewerProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<Uint8Array | null>(null);
    const [progress, setProgress] = useState(0);
    const [hoveredByte, setHoveredByte] = useState<number | null>(null);


    // Virtualization State
    const containerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [containerHeight, setContainerHeight] = useState(0);

    // Selection & Context Menu State
    const [selectionStart, setSelectionStart] = useState<number | null>(null);
    const [selectionEnd, setSelectionEnd] = useState<number | null>(null);
    const [isSelecting, setIsSelecting] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    const navigate = useNavigate();

    // Layout State
    const [layout, setLayout] = useState<{ blocks: LayoutBlock[]; totalRows: number }>({ blocks: [], totalRows: 0 });

    // Block Defs
    type LayoutBlock =
        | { type: 'hex'; start: number; end: number; rowStart: number; rowCount: number }
        | { type: 'struct'; region: HexRegion; rowStart: number; rowCount: number };

    // Calculate Layout
    useEffect(() => {
        if (!data) return;

        const blocks: LayoutBlock[] = [];
        let currentRow = 0;
        let currentOffset = 0;

        // Filter regions that have fields (headers), ignore simple ranges (sections) for inline expansion unless requested?
        // User wants struct view. We should only expand regions with 'fields'.
        // Sort regions by start.
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
            // Rows = number of fields + header/footer overhead?
            // Let's just map 1 field = 1 row for now.
            // visual: 
            // struct RegionName {
            //   field...
            // }
            // Let's say header + fields + footer = fields.length + 2 rows. 
            // Or simple list. Let's do simple list with header overlay.
            const fieldRows = region.fields!.length;
            const rowCount = fieldRows + 1; // +1 for "struct Name {" header

            blocks.push({
                type: 'struct',
                region,
                rowStart: currentRow,
                rowCount: rowCount
            });

            currentRow += rowCount;
            // Update offset to end of region (or max field offset + size)
            // Some regions might be smaller than the sum of fields?
            // Usually region.end is accurate.
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

    }, [data, regions]);


    // Selection Handlers
    const handleMouseDown = (e: React.MouseEvent, index: number) => {
        // Only allow left click (button 0) to start selection
        if (e.button !== 0) return;

        if (contextMenu) setContextMenu(null); // Close menu if open
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
        window.addEventListener('click', closeMenu);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('click', closeMenu);
            window.removeEventListener('mouseup', handleMouseUp);
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

    const getRegionForByte = (index: number) => {
        return regions.find(r => index >= r.start && index <= r.end);
    };

    const getSelectedBytes = (): Uint8Array | null => {
        if (!data || selectionStart === null || selectionEnd === null) return null;
        const start = Math.min(selectionStart, selectionEnd);
        const end = Math.max(selectionStart, selectionEnd);
        return data.slice(start, end + 1);
    };

    const handleCopy = (format: 'raw' | 'yara' | 'python' | 'lua' | 'ascii') => {
        const bytes = getSelectedBytes();
        if (!bytes) return;

        let content = '';
        if (format === 'raw') {
            content = Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
        } else if (format === 'yara') {
            const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
            content = `{ ${hex} }`;
        } else if (format === 'python') {
            content = `b'${Array.from(bytes).map(b => '\\x' + b.toString(16).padStart(2, '0').toUpperCase()).join('')}'`;
        } else if (format === 'lua') {
            content = `"${Array.from(bytes).map(b => '\\x' + b.toString(16).padStart(2, '0').toUpperCase()).join('')}"`;
        } else if (format === 'ascii') {
            content = Array.from(bytes).map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.').join('');
        }

        copy(content);
        toast.success(`Copied as ${format.toUpperCase()}`);
        setContextMenu(null);
    };

    const handleSendToLab = (format: 'hex' | 'ascii') => {
        const bytes = getSelectedBytes();
        if (!bytes) return;

        let content = '';
        if (format === 'hex') {
            content = Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
        } else {
            // ASCII
            content = Array.from(bytes).map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.').join('');
        }

        saveToLabInput(content);
        toast.info(`Sent ${format.toUpperCase()} selection to Cyber Lab`);
        navigate('/lab');
    };

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

    // Handle Scroll to Highlight
    useEffect(() => {
        if (highlightStart !== null && highlightStart !== undefined && data && containerRef.current) {
            // Find layout block containing this start
            // Or just calculates offset
            // We use raw hex rows for scrolling usually
            // If struct view is active, it might be tricky, but let's assume raw offset calculation is enough 
            // to bring it into view for 'hex' blocks.
            // If the highlight is inside a struct block, we should find that block.

            // Simple approach: calculate row based on byte index
            // This might be off if there are struct headers expanding rows, but it's a good start.
            // Better: Iterate blocks to find where this byte is.
            let targetRow = -1;

            for (const block of layout.blocks) {
                if (block.type === 'hex') {
                    if (highlightStart >= block.start && highlightStart <= block.end) {
                        const searchOffset = highlightStart - block.start;
                        targetRow = block.rowStart + Math.floor(searchOffset / BYTES_PER_ROW);
                        break;
                    }
                } else if (block.type === 'struct') {
                    if (highlightStart >= block.region.start && highlightStart <= block.region.end) {
                        // It's in this struct
                        targetRow = block.rowStart; // Scroll to header
                        // Could refine to specific field row if we knew it?
                        break;
                    }
                }
            }

            // Fallback if not found in blocks (maybe in a gap?) -> just raw calc
            if (targetRow === -1) {
                targetRow = Math.floor(highlightStart / BYTES_PER_ROW);
            }

            if (targetRow >= 0) {
                containerRef.current.scrollTo({ top: targetRow * ROW_HEIGHT - 100, behavior: 'smooth' });
            }
        }
    }, [highlightStart, data, layout]);

    // Handle Resize
    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerHeight(entry.contentRect.height);
            }
        });

        observer.observe(containerRef.current);
        // Initial height
        setContainerHeight(containerRef.current.clientHeight);

        return () => observer.disconnect();
    }, [loading]); // Re-run when loading changes

    // Handle Scroll
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
    };

    // Calculate Visible Lines
    const { visibleLines, startOffset } = useMemo(() => {
        if (!data || layout.totalRows === 0 || containerHeight === 0) return { visibleLines: [], startOffset: 0 };

        const startIndex = Math.floor(scrollTop / ROW_HEIGHT);
        const renderStartIndex = Math.max(0, startIndex - OVERSCAN);
        const visibleCount = Math.ceil(containerHeight / ROW_HEIGHT) + 2 * OVERSCAN;
        const renderEndIndex = Math.min(layout.totalRows, renderStartIndex + visibleCount);

        const lines: React.ReactNode[] = [];

        // Find start block
        // Binary search or linear (linear is fine for < 100 blocks)

        for (let i = renderStartIndex; i < renderEndIndex; i++) {
            const block = layout.blocks.find(b => i >= b.rowStart && i < b.rowStart + b.rowCount);
            if (!block) continue;

            const relativeIndex = i - block.rowStart;

            if (block.type === 'hex') {
                const byteOffset = block.start + (relativeIndex * BYTES_PER_ROW);
                const endByte = Math.min(byteOffset + BYTES_PER_ROW, block.end + 1);
                const rowData = data.slice(byteOffset, endByte);

                // Hex Row Renderer (Inline)
                lines.push(
                    <div key={i} className="flex h-[22px] hover:bg-white/[0.04]">
                        {/* Offset */}
                        <div className="text-primary/50 w-24 shrink-0 select-none mr-6 font-medium opacity-70 px-4 text-xs font-mono flex items-center">
                            {byteOffset.toString(16).padStart(8, '0').toUpperCase()}
                        </div>

                        {/* Bytes */}
                        <div className="text-foreground/90 w-[450px] shrink-0 font-medium tracking-wide flex items-center font-mono text-xs">
                            {Array.from(rowData).map((byte, bIdx) => {
                                const globalIdx = byteOffset + bIdx;
                                const selected = isSelected(globalIdx);
                                const isHovered = hoveredByte === globalIdx;
                                // Simple check for region highlight overlap (visual only)
                                // If we are in 'hex' block, we are NOT in a struct with fields, but maybe in a section?
                                // We can use getRegionForByte purely for color if needed, but struct regions are excluded from hex blocks.
                                const region = getRegionForByte(globalIdx); // This might find Sections!

                                return (
                                    <span key={bIdx}
                                        className={`inline-block text-center mr-3 w-6 cursor-pointer select-none
                                            ${selected ? 'bg-primary text-primary-foreground font-bold' :
                                                (highlightStart !== null && highlightEnd !== null && globalIdx >= highlightStart && globalIdx <= highlightEnd) ? 'bg-yellow-500/50 text-white font-bold rounded-sm ring-1 ring-yellow-400' :
                                                    isHovered ? 'bg-primary/20 text-primary font-bold rounded-sm' :
                                                        region ? region.color : ''}
                                            ${(region || (highlightStart !== null && highlightEnd !== null && globalIdx >= highlightStart && globalIdx <= highlightEnd)) && !selected ? 'rounded-sm' : ''}
                                        `}
                                        onMouseEnter={() => handleMouseEnter(globalIdx)}
                                        onMouseDown={(e) => handleMouseDown(e, globalIdx)}
                                    >
                                        {byte.toString(16).padStart(2, '0').toUpperCase()}
                                    </span>
                                )
                            })}
                            {/* Padding */}
                            {rowData.length < BYTES_PER_ROW && <span style={{ width: (BYTES_PER_ROW - rowData.length) * 36 }}></span>}
                        </div>

                        {/* ASCII */}
                        <div className="border-l border-border-subtle/30 pl-8 ml-2 tracking-[0.2em] opacity-80 text-foreground-muted/80 flex items-center text-xs font-mono">
                            {Array.from(rowData).map((byte, bIdx) => (
                                <span key={bIdx} className="w-[1ch] text-center">
                                    {(byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.'}
                                </span>
                            ))}
                        </div>
                    </div>
                );
            } else if (block.type === 'struct') {
                // Struct Renderer
                // Row 0 = Header
                // Row N = Field N-1
                const region = block.region;

                if (relativeIndex === 0) {
                    // Struct Header
                    lines.push(
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
                    if (field) {
                        const fieldBytes = data.slice(field.offset, field.offset + Math.min(field.size, 16)); // Show max 16 bytes

                        lines.push(
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
                                    {/* Edit/Interaction placeholder */}
                                </div>
                            </div>
                        );
                    }
                }
            }
        }

        return { visibleLines: lines, startOffset: renderStartIndex * ROW_HEIGHT };
    }, [data, layout, scrollTop, containerHeight, hoveredByte, selectionStart, selectionEnd]); // Add deps


    // Render Main
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

    if (error) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center p-8 bg-card border border-border-subtle rounded-lg">
                <AlertTriangle className="h-10 w-10 text-destructive mb-2 opacity-80" />
                <p className="text-sm text-foreground-muted mb-4">{error}</p>
                <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Retry</Button>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="flex flex-col h-full w-full bg-card border border-border-subtle rounded-lg overflow-hidden shadow-sm select-none relative">
            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed z-50 min-w-[180px] bg-background border border-border-subtle rounded-md shadow-xl p-1 animate-in fade-in zoom-in-95 duration-100"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <div className="px-2 py-1.5 text-[10px] uppercase font-bold text-foreground-muted border-b border-white/5 mb-1 tracking-widest">
                        Selection Action
                    </div>
                    <button onClick={() => handleCopy('raw')} className="w-full text-left px-2 py-1.5 text-xs text-foreground/80 hover:bg-white/5 hover:text-primary rounded flex items-center gap-2 transition-colors">
                        <Copy className="h-3 w-3" /> Copy Hex Bytes
                    </button>
                    <button onClick={() => handleCopy('ascii')} className="w-full text-left px-2 py-1.5 text-xs text-foreground/80 hover:bg-white/5 hover:text-cyan-400 rounded flex items-center gap-2 transition-colors">
                        <Type className="h-3 w-3" /> Copy as ASCII
                    </button>
                    <div className="h-px bg-white/5 my-1" />
                    <button onClick={() => handleCopy('yara')} className="w-full text-left px-2 py-1.5 text-xs text-foreground/80 hover:bg-white/5 hover:text-green-400 rounded flex items-center gap-2 transition-colors">
                        <Code2 className="h-3 w-3" /> Copy as Yara
                    </button>
                    <button onClick={() => handleCopy('python')} className="w-full text-left px-2 py-1.5 text-xs text-foreground/80 hover:bg-white/5 hover:text-yellow-400 rounded flex items-center gap-2 transition-colors">
                        <Code2 className="h-3 w-3" /> Copy as Python
                    </button>
                    <button onClick={() => handleCopy('lua')} className="w-full text-left px-2 py-1.5 text-xs text-foreground/80 hover:bg-white/5 hover:text-blue-400 rounded flex items-center gap-2 transition-colors">
                        <Code2 className="h-3 w-3" /> Copy as Lua
                    </button>
                    <div className="h-px bg-white/5 my-1" />
                    <div className="px-2 py-1 text-[9px] uppercase font-bold text-foreground-muted tracking-widest">Send to Lab</div>
                    <button onClick={() => handleSendToLab('hex')} className="w-full text-left px-2 py-1.5 text-xs text-foreground/80 hover:bg-white/5 hover:text-purple-400 rounded flex items-center gap-2 transition-colors">
                        <Terminal className="h-3 w-3" /> As Hex
                    </button>
                    <button onClick={() => handleSendToLab('ascii')} className="w-full text-left px-2 py-1.5 text-xs text-foreground/80 hover:bg-white/5 hover:text-purple-400 rounded flex items-center gap-2 transition-colors">
                        <Terminal className="h-3 w-3" /> As ASCII
                    </button>
                </div>
            )}

            {/* Header (Simplified) */}
            <div className="bg-background-secondary/40 border-b border-border-subtle px-4 py-2 flex items-center justify-between shrink-0 h-10">
                <span className="text-xs font-bold text-foreground">Hex Inspector</span>
                <span className="text-[10px] text-foreground-muted">{data.length.toLocaleString()} bytes</span>
            </div>

            <div className="flex-1 min-h-0 flex bg-background/50 relative font-mono cursor-text">
                {/* Content */}
                <div
                    ref={containerRef}
                    onScroll={handleScroll}
                    className="flex-1 min-h-0 w-full overflow-y-auto custom-scrollbar relative"
                >
                    <div style={{ height: layout.totalRows * ROW_HEIGHT, position: 'relative' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${startOffset}px)` }}>
                            {visibleLines}
                        </div>
                    </div>
                </div>

                {/* Keep Sidebar for fast navigation */}

            </div>
        </div>
    );
}
