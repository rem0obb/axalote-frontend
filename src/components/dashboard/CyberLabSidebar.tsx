import React, { useState } from 'react';
import {
    Search,
    Shield,
    Binary,
    Fingerprint,
    Network,
    Code,
    Zap,
    ChevronDown,
    Cpu,
    Lock,
    Eye,
    Globe,
    FileCode,
    Terminal,
    Plus
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Operation {
    id: string;
    name: string;
    description: string;
    icon: string;
}

interface Category {
    name: string;
    icon: string;
    operations: Operation[];
}

const ICON_MAP: Record<string, React.ReactNode> = {
    'zap': <Zap className="h-3.5 w-3.5" />,
    'binary': <Binary className="h-3.5 w-3.5" />,
    'shield': <Shield className="h-3.5 w-3.5" />,
    'network': <Network className="h-3.5 w-3.5" />,
    'file-code': <FileCode className="h-3.5 w-3.5" />,
    'globe': <Globe className="h-3 w-3" />,
    'eye': <Eye className="h-3 w-3" />,
    'code': <Code className="h-3 w-3" />,
    'fingerprint': <Fingerprint className="h-3 w-3" />,
    'lock': <Lock className="h-3 w-3" />,
};

const CATEGORIES: Category[] = [
    {
        name: "Extractors",
        icon: "zap",
        operations: [
            { id: 'ext-ip', name: 'Extract IPv4', description: 'Find all IPv4 addresses', icon: 'globe' },
            { id: 'ext-email', name: 'Extract Emails', description: 'Find all email addresses', icon: 'eye' },
            { id: 'ext-url', name: 'Extract URLs', description: 'Find all web links', icon: 'globe' },
            { id: 'ext-domain', name: 'Extract Domains', description: 'Find all domain names', icon: 'globe' },
        ]
    },
    {
        name: "Deobfuscation / Encoding",
        icon: "binary",
        operations: [
            { id: 'enc-b64', name: 'To Base64', description: 'Encode string to Base64', icon: 'code' },
            { id: 'dec-b64', name: 'From Base64', description: 'Decode base64 string', icon: 'code' },
            { id: 'enc-hex', name: 'To Hex', description: 'Convert string to hex', icon: 'binary' },
            { id: 'dec-hex', name: 'From Hex', description: 'Convert hex to raw bytes', icon: 'binary' },
            { id: 'enc-url', name: 'URL Encode', description: 'Percent-encode symbols', icon: 'globe' },
            { id: 'dec-url', name: 'URL Decode', description: 'Decode URL symbols', icon: 'globe' },
            { id: 'enc-html', name: 'To HTML Entity', description: 'Encode < > & etc', icon: 'code' },
            { id: 'dec-html', name: 'From HTML Entity', description: 'Decode &lt; &gt; etc', icon: 'code' },
            { id: 'dec-xor', name: 'XOR', description: 'XOR with a key', icon: 'binary' },
        ]
    },
    {
        name: "String Utilities",
        icon: "file-code",
        operations: [
            { id: 'str-upper', name: 'To Upper Case', description: 'Convert to UPPER CASE', icon: 'type' },
            { id: 'str-lower', name: 'To Lower Case', description: 'Convert to lower case', icon: 'type' },
            { id: 'str-rev', name: 'Reverse', description: 'Reverse the string', icon: 'binary' },
            { id: 'str-trim', name: 'Remove / Trim', description: 'Selective removal of chars', icon: 'code' },
            { id: 'str-strip-html', name: 'Strip HTML tags', description: 'Remove all <tags>', icon: 'eye' },
            { id: 'str-regex', name: 'Regex Extract', description: 'Extract using regex', icon: 'search' },
        ]
    },
    {
        name: "Cryptography",
        icon: "shield",
        operations: [
            { id: 'cry-sha256', name: 'SHA-256', description: 'Calculate SHA-256 hash', icon: 'fingerprint' },
            { id: 'cry-sha1', name: 'SHA-1', description: 'Calculate SHA-1 hash', icon: 'fingerprint' },
            { id: 'cry-sha512', name: 'SHA-512', description: 'Calculate SHA-512 hash', icon: 'fingerprint' },
            { id: 'cry-md5', name: 'MD5', description: 'Calculate MD5 hash', icon: 'fingerprint' },
            { id: 'cry-aes-enc', name: 'AES Encrypt', description: 'Encrypt with AES-CBC', icon: 'lock' },
            { id: 'cry-aes', name: 'AES Decrypt', description: 'Decrypt ciphertext', icon: 'lock' },
        ]
    },
    {
        name: "Networking",
        icon: "network",
        operations: [
            { id: 'net-whois', name: 'WHOIS Lookup', description: 'Domain registration info', icon: 'globe' },
            { id: 'net-dns', name: 'DNS resolve', description: 'Query DNS records', icon: 'network' },
            { id: 'net-geo', name: 'IP Geo', description: 'Geolocate IP address', icon: 'globe' },
            { id: 'net-http', name: 'HTTP Request', description: 'Perform custom GET/POST/...', icon: 'globe' },
        ]
    },
    {
        name: "Data Formats",
        icon: "file-code",
        operations: [
            { id: 'fmt-json', name: 'JSON Beautify', description: 'Pretty-print JSON data', icon: 'code' },
            { id: 'fmt-xml', name: 'XML Beautify', description: 'Pretty-print XML data', icon: 'code' },
            { id: 'fmt-hex', name: 'To Hexdump', description: 'Display data as hexdump', icon: 'binary' },
            { id: 'fmt-template', name: 'Compose', description: 'Build string with ${input}', icon: 'file-code' },
        ]
    },
    {
        name: "Compression",
        icon: "zap",
        operations: [
            { id: 'comp-gz', name: 'Gzip', description: 'Compress data with Gzip', icon: 'zap' },
            { id: 'comp-unzip', name: 'Gunzip', description: 'Decompress Gzip data', icon: 'zap' },
            { id: 'comp-zlib', name: 'Zlib Inflate', description: 'Decompress Deflate data', icon: 'zap' },
        ]
    }
];

interface CyberLabSidebarProps {
    onOperationClick?: (op: Operation) => void;
}

export const CyberLabSidebar: React.FC<CyberLabSidebarProps> = ({ onOperationClick }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(["Extractors"]));

    const toggleCategory = (name: string) => {
        const next = new Set(expandedCategories);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        setExpandedCategories(next);
    };

    const filteredCategories = CATEGORIES.map(cat => ({
        ...cat,
        operations: cat.operations.filter(op =>
            op.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            op.description.toLowerCase().includes(searchQuery.toLowerCase())
        )
    })).filter(cat => cat.operations.length > 0);

    return (
        <aside className="w-64 bg-card/40 backdrop-blur-md border border-border-subtle rounded-xl flex flex-col overflow-hidden shrink-0 animate-in slide-in-from-left-4 duration-500 h-full">
            {/* Header */}
            <div className="p-4 border-b border-border-subtle bg-background-secondary/30">
                <div className="flex items-center gap-2 mb-4">
                    <Terminal className="h-4 w-4 text-primary" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-foreground-muted">CyberLab Suite</h3>
                </div>
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-muted" />
                    <Input
                        placeholder="Search operations..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-8 pl-8 text-[11px] bg-background/50 border-border-subtle focus-visible:ring-primary/20"
                    />
                </div>
            </div>

            {/* Operation List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {filteredCategories.map((cat) => (
                    <div key={cat.name} className="space-y-0.5">
                        <button
                            onClick={() => toggleCategory(cat.name)}
                            className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-background-secondary/50 transition-colors group"
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-primary group-hover:scale-110 transition-transform">
                                    {ICON_MAP[cat.icon]}
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-foreground-muted group-hover:text-foreground transition-colors">
                                    {cat.name}
                                </span>
                            </div>
                            <ChevronDown className={cn(
                                "h-3 w-3 text-foreground-muted/50 transition-transform duration-300",
                                expandedCategories.has(cat.name) && "rotate-180"
                            )} />
                        </button>

                        {expandedCategories.has(cat.name) && (
                            <div className="ml-2 pl-2 border-l border-border-subtle/30 space-y-1 py-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                {cat.operations.map(op => (
                                    <button
                                        key={op.id}
                                        draggable
                                        onDragStart={(e) => {
                                            e.dataTransfer.setData('operation', JSON.stringify(op));
                                        }}
                                        onClick={() => {
                                            if (onOperationClick) {
                                                onOperationClick(op);
                                            }
                                        }}
                                        className="w-full text-left p-2 rounded-lg hover:bg-primary/5 group transition-all relative flex items-center justify-between overflow-hidden"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="text-foreground-muted group-hover:text-primary transition-colors shrink-0">
                                                    {ICON_MAP[op.icon]}
                                                </span>
                                                <span className="text-[11px] font-bold text-foreground/80 group-hover:text-foreground truncate">
                                                    {op.name}
                                                </span>
                                            </div>
                                            <p className="text-[9px] text-foreground-muted/60 pl-5 leading-tight group-hover:text-foreground-muted transition-colors truncate">
                                                {op.description}
                                            </p>
                                        </div>
                                        <div className="px-1 translate-x-8 group-hover:translate-x-0 transition-transform duration-200">
                                            <Plus className="h-3.5 w-3.5 text-primary" />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Footer Status */}
            <div className="p-3 bg-background-secondary/20 border-t border-border-subtle/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Cpu className="h-3 w-3 text-primary animate-pulse" />
                    <span className="text-[8px] font-black uppercase tracking-tighter text-foreground-muted">Lab Ready</span>
                </div>
                <span className="text-[8px] font-mono text-foreground-muted/40">v1.2.4-stable</span>
            </div>
        </aside>
    );
};
