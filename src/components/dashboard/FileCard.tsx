import { ThreatFile } from '@/types/threat.types';
import { FileCode, FileText, FileImage, Image as ImageIcon, Video, Music, Archive, Code2, MoreVertical, Download, Edit2, Trash2, Folder, Bug, Package, FileDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { apiService } from '@/services/api.service';
import { toast } from 'sonner';
import { memo } from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from 'date-fns';

interface FileCardProps {
    file: ThreatFile;
    onClick: () => void;
    onEditFamily: (e: React.MouseEvent) => void;
    onDelete: (e: React.MouseEvent) => void;
}

export const FileCard = memo(({ file, onClick, onEditFamily, onDelete }: FileCardProps) => {


    const getFileIcon = (mimeType: string) => {
        if (mimeType.startsWith('image/')) return <ImageIcon className="h-8 w-8 text-purple-400" />;
        if (mimeType.startsWith('video/')) return <Video className="h-8 w-8 text-red-400" />;
        if (mimeType.startsWith('audio/')) return <Music className="h-8 w-8 text-pink-400" />;
        if (mimeType.startsWith('text/')) return <FileText className="h-8 w-8 text-blue-400" />;
        if (mimeType.includes('zip') || mimeType.includes('compressed') || mimeType.includes('tar')) return <Archive className="h-8 w-8 text-yellow-500" />;
        if (mimeType.includes('javascript') || mimeType.includes('json') || mimeType.includes('xml') || mimeType.includes('html')) return <Code2 className="h-8 w-8 text-green-400" />;
        return <FileCode className="h-8 w-8 text-primary" />;
    };

    const formattedSize = file.metadata.size
        ? (file.metadata.size < 1024
            ? `${file.metadata.size} B`
            : (file.metadata.size / 1024).toFixed(1) + ' KB')
        : 'Unknown';

    const handleDownload = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            const toastId = toast.loading("Preparing download...");
            const response = await apiService.downloadFile(file.metadata.sha256); // Assuming id is sha256 or passed appropriately

            if (response.error || !response.data) {
                toast.dismiss(toastId);
                toast.error(response.error?.message || 'Download failed');
                return;
            }

            const binaryString = window.atob(response.data.buff);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            const blob = new Blob([bytes], { type: 'application/octet-stream' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = file.filename || `file-${file.metadata.sha256.substring(0, 8)}.bin`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            toast.dismiss(toastId);
            toast.success('Download started');
        } catch (error) {
            toast.error("Download failed");
        }
    };

    return (
        <div
            onClick={onClick}
            className="group relative flex flex-col bg-card hover:bg-background-secondary/30 border border-border-subtle rounded-xl overflow-hidden cursor-pointer transition-colors active:scale-[0.98] duration-200"
        >
            {/* Thumbnail Area */}
            <div className="aspect-[4/3] w-full bg-background-secondary/30 flex items-center justify-center relative overflow-hidden group-hover:bg-background-secondary/50 transition-colors">
                {/* Decorative Grid Background */}
                <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:16px_16px]" />

                <div className="transform group-hover:scale-110 transition-transform duration-300">
                    {getFileIcon(file.metadata.mime_type || '')}
                </div>

                {/* Selection Checkbox (Optional future feature) */}
                {/* <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="h-5 w-5 rounded-md border border-border-subtle bg-background" />
         </div> */}
            </div>

            {/* Content Area */}
            <div className="p-3 flex flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-medium text-foreground truncate w-full" title={file.filename}>
                        {file.filename || "Unknown File"}
                    </h3>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                onClick={(e) => e.stopPropagation()}
                                className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 hover:bg-background-secondary rounded-md text-foreground-muted transition-all"
                            >
                                <MoreVertical className="h-4 w-4" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={handleDownload} className="gap-2 text-xs font-medium">
                                <Download className="h-3.5 w-3.5" /> Download
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onEditFamily} className="gap-2 text-xs font-medium">
                                <Bug className="h-3.5 w-3.5" /> Edit Family
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={onDelete} className="gap-2 text-xs font-medium text-destructive focus:text-destructive">
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-foreground-muted font-medium uppercase tracking-wider">
                    <span>{formattedSize}</span>
                    <span className="w-1 h-1 rounded-full bg-foreground-muted/30" />
                    <span>{file.metadata.mime_type?.split('/')[1] || 'BIN'}</span>
                </div>

                {/* Badges Container */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {/* Family Badge */}
                    {file.family && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary">
                            <Folder className="h-3 w-3" />
                            {file.family}
                        </span>
                    )}

                    {/* Packer Badge */}
                    {file.is_packed && file.packer && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-[10px] font-bold text-yellow-600 dark:text-yellow-400">
                            <Package className="h-3 w-3" />
                            {file.packer}
                        </span>
                    )}

                    {/* Dropped File Badge - Verde sem emoji */}
                    {file.is_dropped && file.dropped_from && (
                        <span 
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-green-500/10 border border-green-500/20 text-[10px] font-bold text-green-600 dark:text-green-400"
                            title={`Extracted from: ${file.dropped_from}`}
                        >
                            <FileDown className="h-3 w-3" />
                            Extracted
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
});
