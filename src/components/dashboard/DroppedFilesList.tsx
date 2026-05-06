import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFileChildren } from '@/hooks/useEndpointData';
import { ThreatFile } from '@/types/threat.types';
import { FileCode, Loader2, Bug, Download, ArrowRight, FileImage, FileText, FileArchive, FileDigit, Copy, Check, Folder, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EntropyIndicator } from '@/components/dashboard/EntropyIndicator';
import { CopyableHash } from '@/components/dashboard/CopyableHash';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface DroppedFilesListProps {
    sha256: string;
    onSelect?: (file: ThreatFile) => void;
    selectedSha256?: string | null;
}

// Tree Node Structure
interface TreeNode {
    name: string;
    path: string;
    type: 'folder' | 'file';
    children?: TreeNode[];
    file?: ThreatFile;
    isOpen?: boolean;
}

export function DroppedFilesList({ sha256, onSelect, selectedSha256 }: DroppedFilesListProps) {
    const navigate = useNavigate();
    const { data: children, isLoading, isError } = useFileChildren(sha256);

    // Build File Tree
    const fileTree = useMemo(() => {
        if (!children) return [];

        const root: TreeNode[] = [];
        const map: Record<string, TreeNode> = {};

        children.forEach(file => {
            // Normalize path separators to forward slashes for processing
            const fullPath = (file.dropped_path || file.filename || '').replace(/\\/g, '/');
            const parts = fullPath.split('/').filter(Boolean);

            // If it's just a filename with no path, put it at root
            if (parts.length === 1) {
                root.push({
                    name: file.filename || parts[0],
                    path: fullPath,
                    type: 'file',
                    file: file
                });
                return;
            }

            let currentPath = '';
            let currentLevel = root;
            let currentMap = map;

            parts.forEach((part, index) => {
                const isFile = index === parts.length - 1;
                currentPath = currentPath ? `${currentPath}/${part}` : part;

                if (isFile) {
                    currentLevel.push({
                        name: file.filename || part, // Prefer filename if available
                        path: currentPath,
                        type: 'file',
                        file: file
                    });
                } else {
                    // It's a folder
                    if (!currentMap[currentPath]) {
                        const newFolder: TreeNode = {
                            name: part,
                            path: currentPath,
                            type: 'folder',
                            children: [],
                            isOpen: true // Default open?
                        };
                        currentLevel.push(newFolder);
                        currentMap[currentPath] = newFolder;
                    }
                    // Move deeper
                    currentLevel = currentMap[currentPath].children!;
                }
            });
        });

        // Sort: Folders first, then files, alphabetically
        const sortNodes = (nodes: TreeNode[]) => {
            nodes.sort((a, b) => {
                if (a.type === b.type) return a.name.localeCompare(b.name);
                return a.type === 'folder' ? -1 : 1;
            });
            nodes.forEach(node => {
                if (node.children) sortNodes(node.children);
            });
        };

        sortNodes(root);
        return root;
    }, [children]);

    const getFileIcon = (filename: string, mime: string) => {
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico'].includes(ext)) return FileImage;
        if (mime.startsWith('text/') || ['txt', 'md', 'log', 'json', 'xml', 'yml', 'yaml'].includes(ext)) return FileText;
        if (['zip', 'rar', '7z', 'tar', 'gz', 'apk', 'jar'].includes(ext)) return FileArchive;
        if (['exe', 'dll', 'so', 'elf', 'bin', 'sys'].includes(ext)) return FileDigit;
        if (['js', 'ts', 'jsx', 'tsx', 'py', 'rb', 'php', 'html', 'css', 'c', 'cpp', 'h'].includes(ext)) return FileCode;
        return FileCode;
    };

    const handleDownload = async (e: React.MouseEvent, fileSha256: string) => {
        e.stopPropagation();
        // Placeholder for download logic if distinct from main file download
        // reuse the main download logic or emit an event
        toast.info("Download for child files coming soon.");
    };

    const FileNode = ({ node, level }: { node: TreeNode, level: number }) => {
        const [isOpen, setIsOpen] = useState(true); // Default folders to open

        if (node.type === 'folder') {
            return (
                <div className="select-none">
                    <div
                        className={cn(
                            "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors text-foreground/80 hover:bg-background-secondary/50 hover:text-foreground",
                            "ml-2"
                        )}
                        style={{ paddingLeft: `${level * 16 + 8}px` }}
                        onClick={() => setIsOpen(!isOpen)}
                    >
                        {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 opacity-50" /> : <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />}
                        <Folder className="h-4 w-4 shrink-0 text-primary/70 fill-primary/10" />
                        <span className="text-xs font-bold truncate">{node.name}</span>
                        <span className="text-[10px] text-foreground-muted ml-auto mr-2">
                            {node.children?.length} items
                        </span>
                    </div>
                    {isOpen && node.children && (
                        <div className="flex flex-col gap-1 mt-1 border-l border-border-subtle/30 ml-[calc(11px+1.5px)] my-1">
                            {/* The ml calculation aligns the border with the Chevron center */}
                            {node.children.map((child) => (
                                <FileNode key={child.path} node={child} level={level + 1} />
                            ))}
                        </div>
                    )}
                </div>
            );
        }

        // It's a file
        const file = node.file!;
        const metadata = file.metadata || {} as any;
        const isSelected = selectedSha256 === metadata.sha256;
        const Icon = getFileIcon(file.filename || '', metadata.mime_type || '');

        return (
            <div
                onClick={() => {
                    if (!metadata.sha256) {
                        toast.error("Child file metadata is incomplete");
                        return;
                    }
                    if (onSelect) {
                        onSelect(file);
                        return;
                    }
                    navigate(`/files/${metadata.sha256}`);
                }}
                className={cn(
                    "group relative flex items-center gap-3 p-2 rounded-lg border transition-all duration-200 cursor-pointer overflow-hidden mb-1",
                    "ml-2", // Indentation for the node itself
                    isSelected
                        ? "bg-primary/10 border-primary/30"
                        : "bg-background-secondary/20 border-border-subtle hover:bg-background-secondary/60 hover:border-primary/20"
                )}
            // We use paddingLeft to visually indent, but keep the border aligned
            >
                {/* Selection Indicator */}
                {isSelected && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                )}

                {/* Icon Box */}
                <div className={cn(
                    "h-8 w-8 shrink-0 rounded-md flex items-center justify-center transition-colors",
                    isSelected ? "bg-primary/20 text-primary" : "bg-background-secondary text-foreground-muted group-hover:text-primary group-hover:bg-primary/10"
                )}>
                    <Icon className="h-4 w-4" />
                </div>

                {/* Main Info */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="flex items-center gap-2">
                        <span className={cn("text-xs font-bold truncate", isSelected ? "text-primary" : "text-foreground group-hover:text-primary transition-colors")}>
                            {node.name}
                        </span>
                        {file.family && (
                            <span className="px-1 py-0.5 rounded-[2px] bg-destructive/10 text-destructive text-[8px] font-black uppercase tracking-wider border border-destructive/20 leading-none">
                                {file.family}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-foreground-muted mt-0.5">
                        <span className="font-mono opacity-80">{metadata.mime_type?.split('/').pop() || 'file'}</span>
                        <span className="w-0.5 h-0.5 rounded-full bg-foreground-muted" />
                        <span className="font-mono opacity-80">
                            {metadata.size ? (metadata.size < 1024 ? `${metadata.size} B` : `${(metadata.size / 1024).toFixed(1)} KB`) : '0 B'}
                        </span>
                    </div>
                </div>

                {/* Metrics & Actions */}
                <div className="flex items-center gap-4 shrink-0 mr-1">
                    {/* Entropy */}
                    {metadata.entropy !== undefined && (
                        <div className="w-[60px] flex flex-col gap-0.5" title={`Entropy: ${metadata.entropy.toFixed(2)}`}>
                            <div className="flex justify-between items-center text-[8px] font-bold text-foreground-muted/70 uppercase">
                                <span>Entropy</span>
                                <span className={cn(metadata.entropy > 7 ? "text-destructive" : "text-foreground-muted")}>
                                    {metadata.entropy.toFixed(1)}
                                </span>
                            </div>
                            <div className="h-1 w-full bg-background-secondary rounded-full overflow-hidden">
                                <div
                                    className={cn("h-full rounded-full", metadata.entropy > 7 ? "bg-destructive" : metadata.entropy > 5 ? "bg-orange-500" : "bg-success")}
                                    style={{ width: `${(metadata.entropy / 8) * 100}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Hash - Compact */}
                    <div className="w-[20px] lg:w-auto" onClick={(e) => e.stopPropagation()}>
                        <CopyableHash hash={metadata.sha256 || ''} className="hidden lg:flex" />
                        <Button variant="ghost" size="icon" className="h-6 w-6 lg:hidden opacity-0 group-hover:opacity-100">
                            <Copy className="h-3 w-3" />
                        </Button>
                    </div>

                    {/* Action Button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            "h-6 w-6 rounded-full hover:bg-primary/20 hover:text-primary transition-all",
                            isSelected ? "opacity-100 bg-primary/10 text-primary" : "opacity-0 group-hover:opacity-100 text-foreground-muted"
                        )}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onSelect) onSelect(file);
                            else if (metadata.sha256) navigate(`/files/${metadata.sha256}`);
                        }}
                    >
                        <ArrowRight className="h-3 w-3" />
                    </Button>

                </div>
            </div>
        );
    };


    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-foreground-muted animate-in fade-in zoom-in-95 duration-500">
                <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary/50" />
                <p className="text-xs font-bold uppercase tracking-widest opacity-70">Extracting dropped files...</p>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-destructive animate-in fade-in zoom-in-95 duration-500">
                <Bug className="h-10 w-10 mb-4 stroke-1 opacity-50" />
                <p className="text-sm font-bold">Failed to load dropped files</p>
                <p className="text-xs opacity-70 mt-1">Please try refreshing the page.</p>
            </div>
        );
    }

    if (!children || children.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-foreground-muted opacity-40 animate-in fade-in zoom-in-95 duration-500">
                <div className="bg-background-secondary/50 p-6 rounded-full mb-4">
                    <FileCode className="h-12 w-12 stroke-1" />
                </div>
                <p className="text-sm font-bold uppercase tracking-widest">No Dropped Files</p>
                <p className="text-xs mt-2 max-w-[200px] text-center">This artifact did not drop or extract any additional files during analysis.</p>
            </div>
        );
    }

    return (
        <div className="h-full overflow-hidden flex flex-col p-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-4 shrink-0 px-2">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-foreground-muted">Extracted Artifacts</h3>
                    <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20">
                        {children.length}
                    </Badge>
                </div>
                {/* Optional filters or sort controls could go here */}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-10">
                <div className="flex flex-col gap-1">
                    {fileTree.map(node => (
                        <FileNode key={node.path} node={node} level={0} />
                    ))}
                </div>
            </div>
        </div>
    );
}
