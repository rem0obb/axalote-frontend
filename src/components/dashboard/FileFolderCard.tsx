import { memo } from 'react';
import { Folder, MoreVertical, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface FileFolderCardProps {
    name: string;
    itemCount: number;
    onClick: () => void;
    onEditFamily?: (e: React.MouseEvent) => void;
}

export const FileFolderCard = memo(({ name, itemCount, onClick, onEditFamily }: FileFolderCardProps) => {
    return (
        <div
            onClick={onClick}
            className="group relative flex flex-col bg-card hover:bg-background-secondary/30 border border-border-subtle rounded-xl overflow-hidden cursor-pointer transition-colors active:scale-[0.98] duration-200"
        >
            {/* Three dots menu */}
            {onEditFamily && (
                <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            onClick={(e) => e.stopPropagation()}
                            className="h-7 w-7 flex items-center justify-center rounded-md bg-background/80 backdrop-blur-sm hover:bg-background border border-border-subtle shadow-sm transition-colors"
                        >
                            <MoreVertical className="h-3.5 w-3.5 text-foreground-muted" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEditFamily(e);
                                }}
                                className="gap-2"
                            >
                                <Edit2 className="h-4 w-4" />
                                <span>Rename Family</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}

            <div className="p-4 flex flex-col items-center justify-center gap-3 aspect-[4/3] bg-background-secondary/20 group-hover:bg-primary/5 transition-colors">
                <div className="relative">
                    <Folder className="h-16 w-16 text-primary/40 fill-primary/10 group-hover:text-primary group-hover:fill-primary/20 transition-all duration-300" />
                    {/* Subtle badge for item count if > 0 */}
                    {itemCount > 0 && (
                        <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                            {itemCount}
                        </div>
                    )}
                </div>
                <div className="text-center w-full px-2">
                    <h3 className="text-sm font-bold text-foreground truncate w-full group-hover:text-primary transition-colors" title={name}>
                        {name}
                    </h3>
                    <p className="text-[10px] text-foreground-muted font-medium uppercase tracking-wider">
                        {itemCount} {itemCount === 1 ? 'item' : 'items'}
                    </p>
                </div>
            </div>

            {/* Decorative bottom bar */}
            <div className="h-1 w-full bg-border-subtle group-hover:bg-primary/50 transition-colors" />
        </div>
    );
});
