
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '@/services/api.service';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Database, Globe, Link, Terminal, Shield, Fingerprint, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

/**
 * StringAnalysisPage
 * A dedicated, clean implementation for String Intelligence.
 * Focuses on robust API communication and clear data visualization.
 */
interface StringMatch {
    string: string;
    offset: number;
    encoding: string;
}

interface IocMatch {
    type: string;
    value: string;
    description?: string;
}

const StringAnalysisPage = () => {
    const { id: sha256 } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [strings, setStrings] = useState<StringMatch[]>([]);
    const [iocs, setIocs] = useState<IocMatch[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (sha256) {
            runScan();
        }
    }, [sha256]);

    const runScan = async () => {
        setLoading(true);
        setError(null);
        try {


            // Standard options aligned with what works
            const options = {
                min_length: 4,
                encoding: "ascii", // default
            };

            const response = await apiService.extractStrings(sha256!, options);

            if (response.error) {
                throw new Error(response.error.message);
            }

            // Direct parsing strategy
            const payload = (response.data as any)?.data;
            if (payload) {
                const fetchedStrings = payload.strings || [];
                const fetchedIocs = payload.iocs || [];

                setStrings(fetchedStrings);
                setIocs(fetchedIocs);

            } else {
                throw new Error("Invalid response format from server");
            }

        } catch (err: any) {
            console.error("[StringAnalysis] Scan Failed:", err);
            setError(err.message);
            toast.error("Failed to extract strings");
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
    };

    // Helper to categorize IOCs
    const getIocsByType = (type: string) => iocs.filter(i => i.type === type);
    const ips = getIocsByType('ip');
    const domains = getIocsByType('domain');
    const urls = getIocsByType('url');

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
            {/* Top Bar */}
            <div className="h-14 border-b border-border-subtle bg-background-secondary/30 flex items-center px-6 gap-4">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/files/${sha256}`)}
                    className="text-foreground-muted hover:text-foreground"
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to File
                </Button>
                <div className="h-6 w-px bg-border-subtle/50" />
                <h1 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                    <Fingerprint className="h-4 w-4 text-[#00A88E]" />
                    String Analysis
                    <span className="text-foreground-muted font-mono normal-case opacity-50 ml-2">{sha256}</span>
                </h1>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-6 overflow-hidden flex flex-col gap-6">

                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center opacity-50">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#00A88E] mb-4"></div>
                        <p className="font-mono text-sm uppercase tracking-widest animate-pulse">Extracting Intelligence...</p>
                    </div>
                ) : error ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-destructive">
                        <Shield className="h-16 w-16 mb-4 opacity-20" />
                        <h2 className="text-xl font-bold mb-2">Extraction Failed</h2>
                        <p className="font-mono text-sm opacity-70 mb-6">{error}</p>
                        <Button onClick={runScan} variant="outline" className="border-destructive/30 hover:bg-destructive/10">
                            Retry Analysis
                        </Button>
                    </div>
                ) : (
                    <div className="flex-1 grid grid-cols-1 xl:grid-cols-2 gap-6 min-h-0">

                        {/* LEFT COLUMN: STRATEGIC INTELLIGENCE (IOCs) */}
                        <div className="flex flex-col gap-6 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <StatsCard icon={<Database />} label="IP Addresses" count={ips.length} color="text-blue-400" />
                                <StatsCard icon={<Globe />} label="Domains" count={domains.length} color="text-green-400" />
                                <StatsCard icon={<Link />} label="URLs" count={urls.length} color="text-purple-400" />
                            </div>

                            {/* IOC Lists */}
                            <IocSection title="Infrastructure (IPs)" items={ips} icon={<Database className="h-4 w-4" />} />
                            <IocSection title="Domains" items={domains} icon={<Globe className="h-4 w-4" />} />
                            <IocSection title="URLs" items={urls} icon={<Link className="h-4 w-4" />} />
                        </div>

                        {/* RIGHT COLUMN: TECHNICAL INTELLIGENCE (RAW STRINGS) */}
                        <Card className="flex flex-col min-h-0 border-border-subtle bg-card shadow-none">
                            <CardHeader className="py-3 px-4 border-b border-border-subtle/50 bg-background-secondary/20 flex flex-row items-center justify-between">
                                <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                                    <Terminal className="h-4 w-4 text-[#00A88E]" />
                                    Extracted Strings
                                    <span className="bg-[#00A88E]/10 text-[#00A88E] px-2 py-0.5 rounded text-[10px] ml-2">
                                        {strings.length.toLocaleString()}
                                    </span>
                                </CardTitle>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => copyToClipboard(strings.map(s => s.string).join('\n'))}>
                                    <Copy className="h-4 w-4" />
                                </Button>
                            </CardHeader>
                            <CardContent className="flex-1 p-0 overflow-hidden bg-[#0a0a0a]">
                                <div className="h-full overflow-y-auto font-mono text-xs p-2 space-y-0.5 custom-scrollbar">
                                    {strings.length > 0 ? (
                                        strings.map((s, idx) => (
                                            <div key={idx} className="flex gap-4 hover:bg-white/5 px-2 py-0.5 rounded cursor-text select-text group">
                                                <span className="text-foreground-muted select-none w-16 text-right opacity-30">{s.offset}</span>
                                                <span className="text-foreground break-all group-hover:text-[#00A88E] transition-colors">
                                                    {s.string}
                                                </span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full opacity-30">
                                            <p>No strings found matching criteria</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
};

// Sub-components for cleaner code
const StatsCard = ({ icon, label, count, color }: any) => (
    <Card className="border-border-subtle bg-background-secondary/20">
        <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-white/5 ${color} opacity-80`}>{icon}</div>
                <span className="text-xs font-bold uppercase tracking-wider text-foreground-muted">{label}</span>
            </div>
            <span className="text-xl font-mono font-bold">{count}</span>
        </CardContent>
    </Card>
);

const IocSection = ({ title, items, icon }: any) => {
    if (items.length === 0) return null;
    return (
        <Card className="border-border-subtle shadow-none">
            <CardHeader className="py-3 px-4 border-b border-border-subtle/50 bg-background-secondary/20">
                <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                    {icon} {title}
                </CardTitle>
            </CardHeader>
            <div className="max-h-[200px] overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {items.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 hover:bg-background-secondary/50 rounded group">
                        <code className="text-xs text-foreground font-mono break-all">{item.value}</code>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                            onClick={() => {
                                navigator.clipboard.writeText(item.value);
                                toast.success("Copied");
                            }}
                        >
                            <Copy className="h-3 w-3" />
                        </Button>
                    </div>
                ))}
            </div>
        </Card>
    );
};

export default StringAnalysisPage;
