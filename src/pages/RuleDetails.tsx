import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { useYaraRule } from '@/hooks/useEndpointData';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorDisplay } from '@/components/common/ErrorDisplay';
import { ApiError } from '@/services/api.service';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Braces, Tag, FileText, Binary, Variable, Code, Fingerprint } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { MainLayoutContextType } from '@/components/layout/MainLayout';

export default function RuleDetails() {
    const { identifier } = useParams<{ identifier: string }>();
    const navigate = useNavigate();
    const { collapsed } = useOutletContext<MainLayoutContextType>();
    const { data: rule, isLoading, isError, error, refetch } = useYaraRule(identifier || '');

    const renderTags = () => {
        const rawTags = rule?.tags;
        if (!rawTags) return null;

        let tagList: string[] = [];
        if (Array.isArray(rawTags)) {
            tagList = rawTags.map(t => {
                if (typeof t === 'string') return t;
                if (typeof t === 'object' && t !== null) return t.name || String(t);
                return String(t);
            });
        } else if (typeof rawTags === 'object' && rawTags !== null) {
            tagList = Object.keys(rawTags);
        }

        if (tagList.length === 0) return null;

        return (
            <div className="flex flex-wrap gap-1.5">
                {tagList.map((tag, i) => (
                    <Badge key={i} variant="secondary" className="px-2 py-0 h-5 text-[10px] font-bold uppercase tracking-wider border-primary/20 bg-primary/5 text-primary">
                        {tag}
                    </Badge>
                ))}
            </div>
        );
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
    };

    if (isLoading) {
        return <LoadingState message={`Accessing rule definitions: ${identifier}...`} />;
    }

    if (isError || !rule) {
        return (
            <div className="p-6">
                <ErrorDisplay
                    error={error as ApiError || { message: 'Rule definition not found' }}
                    endpoint={`/axalote/yara/rules/${identifier}`}
                    onRetry={() => refetch()}
                />
            </div>
        );
    }

    return (
        <div className="p-6 w-full max-w-full space-y-6 animate-in fade-in duration-500 transition-all duration-300 ease-in-out overflow-x-hidden">
            {/* Professional Header */}
            <div className="bg-card border border-border-subtle rounded-xl p-6 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] rotate-12 transition-transform group-hover:scale-110 duration-700">
                    <Braces size={120} />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row md:items-start gap-6">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => navigate(-1)}
                        className="h-12 w-12 rounded-lg bg-background border-border-subtle hover:bg-background-secondary transition-all shrink-0"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>

                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                            <h1 className="text-2xl font-bold tracking-tight text-foreground truncate max-w-2xl" title={rule.identifier}>
                                {rule.identifier}
                            </h1>
                            <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-bold bg-primary/5 text-primary border-primary/20">
                                {typeof rule.namespace === 'object' ? (rule.namespace as any).name : (rule.namespace || 'default')}
                            </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-foreground-muted font-mono">
                            <span className="flex items-center gap-1.5">
                                <Variable className="h-3 w-3" />
                                Strings: {rule.strings ? Object.keys(rule.strings).length : 0}
                            </span>
                            <span className="flex items-center gap-1.5 text-foreground-muted/60">•</span>
                            <span className="flex items-center gap-1.5">
                                <Code className="h-3 w-3" />
                                Atoms: {rule.num_atoms}
                            </span>
                            <span className="flex items-center gap-1.5 text-foreground-muted/60">•</span>
                            <div className="flex items-center gap-3">
                                {renderTags() || (
                                    <div className="flex items-center gap-2 text-foreground-muted/50">
                                        <Tag className="h-3 w-3" />
                                        <span className="text-[10px] uppercase font-bold tracking-widest">No Tags</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <div className="bg-success/10 text-success border border-success/20 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">
                            <Braces className="h-4 w-4" />
                            Rule Active
                        </div>
                    </div>
                </div>
            </div>

            {/* Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Main Content Area */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Strings Card */}
                    <Card className="border-border-subtle shadow-sm overflow-hidden flex flex-col min-h-[500px] min-w-0">
                        <CardHeader className="bg-background-secondary/30 border-b border-border-subtle/50 pb-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Binary className="h-4 w-4 text-primary" />
                                    Rule Implementation (Strings)
                                </CardTitle>
                                <span className="text-[10px] font-mono text-foreground-muted uppercase tracking-widest bg-background-secondary px-2 py-0.5 rounded border border-border-subtle">
                                    Compiled Tokens
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0 flex-1 overflow-hidden">
                            {rule.strings && Object.keys(rule.strings).length > 0 ? (
                                <div className="divide-y divide-border-subtle/30 overflow-x-hidden overflow-y-auto max-h-[700px] w-full">
                                    {/* Table Header */}
                                    <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-background-secondary/10 text-[10px] font-bold uppercase tracking-widest text-foreground-muted sticky top-0 z-10 backdrop-blur-md">
                                        <div className="col-span-4 min-w-0 truncate">Identifier</div>
                                        <div className="col-span-3 min-w-0 truncate">Encoding</div>
                                        <div className="col-span-5 min-w-0 truncate">Properties</div>
                                    </div>

                                    {/* Rows */}
                                    {(Array.isArray(rule.strings) ? rule.strings : Object.entries(rule.strings)).map((item, i) => {
                                        const [key, str] = Array.isArray(rule.strings) ? [null, item] : (item as [string, any]);
                                        const identifier = str.identifier || key;
                                        const flags = typeof str.flags === 'object' ? str.flags.value : str.flags;

                                        return (
                                            <div key={i} className="grid grid-cols-12 gap-2 px-4 py-4 text-sm hover:bg-primary/5 transition-all group">
                                                <div className="col-span-4 min-w-0 font-mono text-primary font-medium truncate flex items-center gap-2">
                                                    <div className="h-1.5 w-1.5 rounded-full bg-primary/30 group-hover:bg-primary transition-colors shrink-0" />
                                                    <span className="truncate">{identifier}</span>
                                                </div>
                                                <div className="col-span-3 min-w-0 flex items-center">
                                                    <Badge variant="secondary" className="text-[9px] h-5 px-1.5 font-bold border-border-subtle bg-background-secondary text-foreground-muted shrink-0">
                                                        {flags & 1 ? 'ASCII' : 'UTF-16/HEX'}
                                                    </Badge>
                                                </div>
                                                <div className="col-span-5 min-w-0 font-mono text-[11px] text-foreground-muted/80 flex items-center gap-2 overflow-hidden">
                                                    <span className="shrink-0">Len: <span className="text-foreground">{str.length}</span></span>
                                                    <span className="opacity-30 shrink-0">|</span>
                                                    <span className="shrink-0">Atoms: <span className="text-foreground">{str.num_atoms || 0}</span></span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                                    <Variable className="h-16 w-16 mb-4 text-foreground-muted/20" />
                                    <h3 className="text-lg font-medium text-foreground-muted">No Strings Defined</h3>
                                    <p className="text-sm text-foreground-muted/60 max-w-xs">This rule might be purely logic-based or use external variables.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar Column */}
                <div className="space-y-6">
                    {/* Metadata Card */}
                    <Card className="border-border-subtle shadow-sm overflow-hidden">
                        <CardHeader className="bg-background-secondary/30 border-b border-border-subtle/50 py-3 px-4">
                            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground-muted">
                                <FileText className="h-4 w-4" />
                                Rule Intelligence
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                            {rule.metas && (Array.isArray(rule.metas) ? rule.metas.length > 0 : Object.keys(rule.metas).length > 0) ? (
                                (Array.isArray(rule.metas) ? rule.metas : Object.entries(rule.metas)).map((item, i) => {
                                    const [key, rawValue] = Array.isArray(rule.metas) ? [null, item] : (item as [string, any]);
                                    const identifier = rawValue.identifier || key;
                                    const displayValue = typeof rawValue === 'object' && rawValue !== null ? String(rawValue.value ?? '') : String(rawValue);

                                    return (
                                        <div key={i} className="space-y-1.5 group">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted">{identifier}</label>
                                                <button
                                                    onClick={() => copyToClipboard(displayValue)}
                                                    className="text-[10px] font-medium text-primary opacity-0 group-hover:opacity-100 transition-all"
                                                >
                                                    COPY
                                                </button>
                                            </div>
                                            <div className="bg-background-secondary/50 border border-border-subtle p-2.5 rounded-md hover:border-primary/20 transition-colors">
                                                <span className="text-xs font-medium text-foreground/90 break-words leading-relaxed">
                                                    {displayValue}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center py-6 opacity-40">
                                    <Braces className="h-8 w-8 mx-auto mb-2 text-foreground-muted/30" />
                                    <p className="text-xs text-foreground-muted">No metadata markers</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Quick Stats Card */}
                    <Card className="border-border-subtle shadow-sm">
                        <CardHeader className="py-3 px-4 border-b border-border-subtle/50">
                            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground-muted">
                                <Fingerprint className="h-4 w-4" />
                                Rule Blueprint
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                            <div className="grid grid-cols-1 gap-2">
                                <div className="flex items-center justify-between p-2.5 bg-background-secondary/50 rounded-md border border-border-subtle">
                                    <span className="text-xs text-foreground-muted">Namespace</span>
                                    <span className="text-xs font-mono font-bold text-foreground">
                                        {typeof rule.namespace === 'object' ? (rule.namespace as any).name : (rule.namespace || 'default')}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between p-2.5 bg-background-secondary/50 rounded-md border border-border-subtle">
                                    <span className="text-xs text-foreground-muted">Complexity Flags</span>
                                    <span className="text-xs font-mono font-bold text-primary">{rule.flags}</span>
                                </div>
                                <div className="flex items-center justify-between p-2.5 bg-background-secondary/50 rounded-md border border-border-subtle">
                                    <span className="text-xs text-foreground-muted">Atoms Count</span>
                                    <span className="text-xs font-mono font-bold text-foreground">{rule.num_atoms}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

            </div>
        </div>
    );
}
