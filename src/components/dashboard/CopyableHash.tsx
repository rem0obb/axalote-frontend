import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import copy from 'copy-to-clipboard';

interface CopyableHashProps {
    hash: string;
    className?: string;
}

export function CopyableHash({ hash, className }: CopyableHashProps) {
    const [copied, setCopied] = useState(false);

    const onCopy = () => {
        copy(hash);
        setCopied(true);
        toast.success("Hash copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div
            onClick={onCopy}
            className={cn(
                "flex items-center gap-2 px-2 py-1 rounded bg-background-secondary border border-border-subtle cursor-pointer hover:bg-background-secondary/80 group transition-all",
                className
            )}
            title="Click to copy full hash"
        >
            <span className="font-mono text-[10px] text-foreground-muted truncate flex-1">
                {hash.substring(0, 10)}...{hash.substring(hash.length - 10)}
            </span>
            {copied ? (
                <Check className="h-3 w-3 text-success animate-in zoom-in spin-in-90 duration-300" />
            ) : (
                <Copy className="h-3 w-3 text-foreground-muted opacity-50 group-hover:opacity-100 transition-opacity" />
            )}
        </div>
    );
}
