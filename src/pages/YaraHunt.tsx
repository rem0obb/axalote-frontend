import { useState, useRef, useEffect, useMemo } from 'react';
import { useTheme } from '@/components/providers/ThemeProvider';
import { defineMonacoThemes, AXALOTE_DARK_THEME_NAME, AXALOTE_LIGHT_THEME_NAME } from '@/lib/monaco-theme';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { apiService } from '@/services/api.service';
import {
    Search,
    Terminal,
    Code,
    Shield,
    FileText,
    Braces,
    Hash,
    AlignLeft,
    Box,
    LayoutList,
    AlertTriangle,
    Eye,
    ChevronRight,
    Loader2,
    Save,
    FlaskConical,
    CheckCircle2,
    XCircle,
    Play
} from 'lucide-react';
import { toast } from 'sonner';
import Editor from '@monaco-editor/react';
import { cn } from '@/lib/utils';
import { YaraDiagnostic, YaraHuntMatch } from '@/types/threat.types';
import { YaraDiagnosticsPanel } from '@/components/common/YaraDiagnosticsPanel';

type TestStatus = 'pending' | 'loading' | 'match' | 'no_match' | 'error';

interface TestResult {
    sha256: string;
    status: TestStatus;
    filename?: string;
    errorMsg?: string;
}

const YARA_LANGUAGE_ID = 'yara';

const DEFAULT_HUNT_TEMPLATE = `rule Hunting_Rule {
    meta:
        description = "Quick hunt for..."
    
    strings:
        $a = "suspicious_string" ascii wide
    
    condition:
        $a
}`;

const CACHE_KEY = 'yara_hunt_state';

export default function YaraHunt() {
    const navigate = useNavigate();
    const { theme } = useTheme();

    const [rules, setRules] = useState(DEFAULT_HUNT_TEMPLATE);
    const [isHunting, setIsHunting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [matches, setMatches] = useState<YaraHuntMatch[]>([]);
    const [huntCount, setHuntCount] = useState<number | null>(null);
    const [huntMessage, setHuntMessage] = useState<string | null>(null);
    const [huntDiagnostics, setHuntDiagnostics] = useState<YaraDiagnostic[]>([]);
    const [huntWarnings, setHuntWarnings] = useState<YaraDiagnostic[]>([]);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const [saveDiagnostics, setSaveDiagnostics] = useState<YaraDiagnostic[]>([]);
    const [saveWarnings, setSaveWarnings] = useState<YaraDiagnostic[]>([]);
    const editorRef = useRef<any>(null);

    // Rule Test state
    const [sidebarTab, setSidebarTab] = useState<'results' | 'test'>('results');
    const [testHashes, setTestHashes] = useState('');
    const [testResults, setTestResults] = useState<TestResult[]>([]);
    const [isRunningTest, setIsRunningTest] = useState(false);

    // Carregar estado do cache ao montar o componente
    useEffect(() => {
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const state = JSON.parse(cached);
                if (state.rules) setRules(state.rules);
                if (state.matches) setMatches(state.matches);
                if (state.huntCount !== undefined) setHuntCount(state.huntCount);
            }
        } catch (error) {
            console.error('Failed to load cached hunt state:', error);
        }
    }, []);

    // Salvar estado no cache sempre que mudar
    useEffect(() => {
        try {
            const state = {
                rules,
                matches,
                huntCount,
                timestamp: Date.now()
            };
            localStorage.setItem(CACHE_KEY, JSON.stringify(state));
        } catch (error) {
            console.error('Failed to cache hunt state:', error);
        }
    }, [rules, matches, huntCount]);

    const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
        if (theme === 'system') {
            return window.matchMedia("(prefers-color-scheme: dark)").matches ? 'dark' : 'light';
        }
        return theme;
    });

    useEffect(() => {
        if (theme === 'system') {
            const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
            const handleChange = (e: MediaQueryListEvent) => {
                setResolvedTheme(e.matches ? 'dark' : 'light');
            };

            // Set initial value
            setResolvedTheme(mediaQuery.matches ? 'dark' : 'light');

            // Listen for changes
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        } else {
            setResolvedTheme(theme);
        }
    }, [theme]);

    const handleEditorWillMount = (monaco: any) => {
        // Syntax highlighting logic (Reused from YaraEditor)
        monaco.languages.register({ id: YARA_LANGUAGE_ID });
        monaco.languages.setMonarchTokensProvider(YARA_LANGUAGE_ID, {
            keywords: [
                'rule', 'meta', 'strings', 'condition', 'all', 'any', 'of', 'them', 'at', 'in', 'filesize', 'entrypoint', 'int8', 'int16', 'int32', 'uint8', 'uint16', 'uint32', 'ascii', 'wide', 'nocase', 'fullword', 'private', 'global', 'import', 'include'
            ],
            typeKeywords: ['true', 'false'],
            operators: ['=', '>', '<', '!', '~', '?', ':', '==', '<=', '>=', '!=', '&&', '||'],
            symbols: /[=><!~?:&|+\-*\/\^%]+/,
            tokenizer: {
                root: [
                    [/[a-zA-Z_]\w*/, {
                        cases: {
                            '@keywords': 'keyword',
                            '@typeKeywords': 'keyword.type',
                            '@default': 'identifier'
                        }
                    }],
                    { include: '@whitespace' },
                    [/[{}()\[\]]/, '@brackets'],
                    [/[<>=\!\|\&\+\-\*\/\^%]+/, 'operator'],
                    [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
                    [/\d+/, 'number'],
                    [/"([^"\\]|\\.)*$/, 'string.invalid'],
                    [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
                    [/\$[a-zA-Z0-9_*]*/, 'variable'],
                ],
                comment: [
                    [/[^\/*]+/, 'comment'],
                    [/\/\*/, 'comment', '@push'],
                    ["\\*/", 'comment', '@pop'],
                    [/[\/*]/, 'comment']
                ],
                string: [
                    [/[^\\"]+/, 'string'],
                    [/\\./, 'string.escape.invalid'],
                    [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
                ],
                whitespace: [
                    [/[ \t\r\n]+/, 'white'],
                    [/\/\*/, 'comment', '@comment'],
                    [/\/\/.*$/, 'comment'],
                ],
            },
        });

        // Define Custom Themes (Shared)
        defineMonacoThemes(monaco);
    };

    const handleEditorDidMount = (editor: any) => {
        editorRef.current = editor;
    };

    const handleHunt = async () => {
        if (!rules.trim()) {
            toast.error("Please enter a Yara rule to hunt.");
            return;
        }

        setIsHunting(true);
        try {
            const response = await apiService.huntYara(rules);
            if (response.error) {
                setHuntMessage(response.error.message);
                setHuntDiagnostics([]);
                setHuntWarnings([]);
                toast.error(`Hunt failed: ${response.error.message}`);
            } else if (response.data) {
                if (response.data.success === false) {
                    setMatches([]);
                    setHuntCount(0);
                    setHuntMessage(response.data.message || 'Unknown error');
                    setHuntDiagnostics(response.data.errors || response.data.diagnostics || []);
                    setHuntWarnings(response.data.warnings || []);
                    toast.error(`Hunt failed: ${response.data.message || 'Unknown error'}`);
                    return;
                }

                const results = response.data.files || [];

                const invalidResults = results.filter(r => !r.sha256);
                if (invalidResults.length > 0) {
                    console.warn('Some results are missing sha256:', invalidResults);
                    toast.warning(`${invalidResults.length} results missing SHA256 identifier`);
                }

                setMatches(results);
                setHuntCount(results.length);
                setHuntMessage(null);
                setHuntDiagnostics(response.data.diagnostics || []);
                setHuntWarnings(response.data.warnings || []);
                toast.success(`Hunt completed: ${results.length} matches found`);
            }
        } catch (error) {
            setHuntMessage('An unexpected error occurred during investigation.');
            toast.error("An unexpected error occurred during investigation.");
        } finally {
            setIsHunting(false);
        }
    };

    const clearHunt = () => {
        setRules(DEFAULT_HUNT_TEMPLATE);
        setMatches([]);
        setHuntCount(null);
        setHuntMessage(null);
        setHuntDiagnostics([]);
        setHuntWarnings([]);
        setSaveMessage(null);
        setSaveDiagnostics([]);
        setSaveWarnings([]);
        localStorage.removeItem(CACHE_KEY);
        toast.success('Hunt workspace cleared');
    };

    const handleSaveToRules = async () => {
        const ruleNameMatch = rules.match(/rule\s+(\w+)/);
        if (!ruleNameMatch) {
            toast.error('No valid rule found. Make sure your rule has a proper name.');
            return;
        }

        const ruleName = ruleNameMatch[1];

        setIsSaving(true);
        try {
            const response = await apiService.loadYaraRules(
                rules,
                { namespace: 'default', name: ruleName }
            );

            if (response.error) {
                setSaveMessage(response.error.message);
                setSaveDiagnostics([]);
                setSaveWarnings([]);
                toast.error(`Save failed: ${response.error.message}`);
            } else if (response.data && response.data.success === false) {
                setSaveMessage(response.data.message || 'Unknown error');
                setSaveDiagnostics(response.data.errors || response.data.diagnostics || []);
                setSaveWarnings(response.data.warnings || []);
                toast.error(`Save failed: ${response.data.message || 'Unknown error'}`);
            } else {
                setSaveMessage(null);
                setSaveDiagnostics(response.data?.diagnostics || []);
                setSaveWarnings(response.data?.warnings || []);
                toast.success(`Rule "${ruleName}" saved to Rules successfully!`);
            }
        } catch (error) {
            setSaveMessage('An unexpected error occurred while saving.');
            toast.error('An unexpected error occurred while saving.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleRunTest = async () => {
        if (!rules.trim()) {
            toast.error('Please write a YARA rule first.');
            return;
        }

        const rawHashes = testHashes
            .split('\n')
            .map(h => h.trim().toLowerCase())
            .filter(h => h.length === 64 && /^[0-9a-f]+$/.test(h));

        if (rawHashes.length === 0) {
            toast.error('Enter at least one valid SHA256 hash (one per line).');
            return;
        }

        // Init all as loading
        setTestResults(rawHashes.map(sha256 => ({ sha256, status: 'loading' })));
        setIsRunningTest(true);

        try {
            const response = await apiService.huntYara(rules);

            if (response.error || !response.data) {
                const msg = response.error?.message || 'Hunt failed';
                setTestResults(rawHashes.map(sha256 => ({ sha256, status: 'error', errorMsg: msg })));
                toast.error(`Test failed: ${msg}`);
                return;
            }

            if (response.data.success === false) {
                const msg = response.data.message || 'Rule error';
                setTestResults(rawHashes.map(sha256 => ({ sha256, status: 'error', errorMsg: msg })));
                toast.error(`Rule error: ${msg}`);
                return;
            }

            const matched = new Map<string, string>();
            (response.data.files || []).forEach(f => {
                if (f.sha256) matched.set(f.sha256.toLowerCase(), f.filename);
            });

            setTestResults(rawHashes.map(sha256 => ({
                sha256,
                status: matched.has(sha256) ? 'match' : 'no_match',
                filename: matched.get(sha256),
            })));

            const matchCount = rawHashes.filter(h => matched.has(h)).length;
            toast.success(`Test complete: ${matchCount}/${rawHashes.length} matched`);
        } catch {
            setTestResults(rawHashes.map(sha256 => ({ sha256, status: 'error', errorMsg: 'Unexpected error' })));
            toast.error('Unexpected error during test.');
        } finally {
            setIsRunningTest(false);
        }
    };

    // Outline Logic (Reused from YaraEditor)

    const outline = useMemo(() => {
        const lines = rules.split('\n');
        const nodes: any[] = [];
        let currentRule: any = null;

        lines.forEach((line, i) => {
            const trimmed = line.trim();
            const ruleMatch = trimmed.match(/^rule\s+([a-zA-Z0-9_]+)/);
            if (ruleMatch) {
                currentRule = { name: ruleMatch[1], line: i + 1, type: 'rule', children: [] };
                nodes.push(currentRule);
            } else if (currentRule) {
                if (trimmed.startsWith('meta:')) {
                    currentRule.children.push({ name: 'Metadata', line: i + 1, type: 'meta' });
                } else if (trimmed.startsWith('strings:')) {
                    currentRule.children.push({ name: 'Strings', line: i + 1, type: 'strings' });
                } else if (trimmed.startsWith('condition:')) {
                    currentRule.children.push({ name: 'Condition', line: i + 1, type: 'condition' });
                }
            }
        });
        return nodes;
    }, [rules]);



    const scrollToLine = (lineNumber: number) => {
        if (editorRef.current) {
            editorRef.current.revealLineInCenter(lineNumber);
            editorRef.current.setPosition({ lineNumber, column: 1 });
            editorRef.current.focus();
        }
    };

    return (
        <div className="h-full flex flex-col p-4 space-y-4 overflow-hidden animate-in fade-in duration-500 bg-background text-foreground">
            {(saveMessage || saveDiagnostics.length > 0 || saveWarnings.length > 0) && (
                <YaraDiagnosticsPanel
                    title="Save Diagnostics"
                    message={saveMessage || undefined}
                    diagnostics={saveDiagnostics}
                    errors={saveDiagnostics}
                    warnings={saveWarnings}
                />
            )}
            {/* Header */}
            <div className="shrink-0">
                <div className="bg-card border border-border-subtle rounded-xl p-3 flex items-center gap-4 relative overflow-hidden group">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Search className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-lg font-bold tracking-tight truncate">Yara Hunting</h1>
                            <p className="text-[10px] text-foreground-muted uppercase font-black tracking-widest opacity-60">Global Scan real-time</p>
                        </div>
                    </div>

                    <div className="ml-auto flex items-center gap-4">
                        <div className="flex items-center gap-6 px-4 py-2 bg-background-secondary/50 rounded-lg border border-border-subtle/50">
                            <div className="flex flex-col items-center">
                                <span className="text-[9px] font-black uppercase tracking-widest text-foreground-muted">Scan Status</span>
                                <span className={cn("text-xs font-bold uppercase", isHunting ? "text-primary animate-pulse" : "text-foreground-muted")}>
                                    {isHunting ? "Scanning..." : "Ready"}
                                </span>
                            </div>
                            <div className="w-px h-6 bg-border-subtle" />
                            <div className="flex flex-col items-center">
                                <span className="text-[9px] font-black uppercase tracking-widest text-foreground-muted">Matches</span>
                                <span className="text-xs font-bold text-foreground">
                                    {huntCount !== null ? huntCount : "---"}
                                </span>
                            </div>
                        </div>
                        <Button
                            onClick={handleSaveToRules}
                            disabled={isSaving || isHunting}
                            variant="outline"
                            className="gap-2 h-10 px-4"
                        >
                            {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            <span className="font-bold uppercase tracking-widest text-[11px]">Save</span>
                        </Button>
                        <Button onClick={handleHunt} disabled={isHunting || isSaving} className="gap-2 h-10 px-6">
                            {isHunting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Terminal className="h-4 w-4" />
                            )}
                            <span className="font-bold uppercase tracking-widest text-[11px]">Hunt</span>
                        </Button>
                    </div>
                </div>
            </div>

            {/* Main Content Area: Editor | Results */}
            <div className="flex-1 flex gap-4 min-h-0">

                {/* Center: Editor */}
                <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-background-secondary rounded-xl border border-border-subtle overflow-hidden">
                    <div className="bg-background-secondary/50 border-b border-border-subtle px-4 py-2 flex items-center justify-between text-[10px] text-foreground-muted font-black uppercase tracking-widest">
                        <div className="flex items-center gap-2">
                            <Code className="h-3 w-3 text-primary" />
                            <span>hunt.yar</span>
                        </div>
                    </div>
                    <div className="flex-1">
                        <Editor
                            key={resolvedTheme} // Force remount on theme change to ensure clean switch
                            height="100%"
                            language={YARA_LANGUAGE_ID}
                            theme={resolvedTheme === 'light' ? AXALOTE_LIGHT_THEME_NAME : AXALOTE_DARK_THEME_NAME}
                            value={rules}
                            onChange={(value) => setRules(value || '')}
                            onMount={handleEditorDidMount}
                            beforeMount={handleEditorWillMount}
                            options={{
                                minimap: { enabled: false },
                                fontSize: 13,
                                lineNumbers: 'on',
                                scrollBeyondLastLine: false,
                                automaticLayout: true,
                                padding: { top: 16, bottom: 16 },
                                roundedSelection: true,
                                fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
                            }}
                        />
                    </div>
                </div>

                {/* 2. Right Sidebar: Tabbed (Hunt Results | Rule Test) */}
                <aside className="w-80 bg-card border border-border-subtle rounded-xl flex flex-col overflow-hidden shrink-0">
                    {/* Tab Header */}
                    <div className="flex border-b border-border-subtle shrink-0">
                        <button
                            onClick={() => setSidebarTab('results')}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all",
                                sidebarTab === 'results'
                                    ? "text-primary border-b-2 border-primary bg-primary/5"
                                    : "text-foreground-muted hover:text-foreground"
                            )}
                        >
                            <Braces className="h-3 w-3" />
                            Results
                            {huntCount !== null && (
                                <span className="text-[9px] font-mono font-bold bg-primary/10 text-primary px-1 py-0.5 rounded">
                                    {huntCount}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setSidebarTab('test')}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all",
                                sidebarTab === 'test'
                                    ? "text-primary border-b-2 border-primary bg-primary/5"
                                    : "text-foreground-muted hover:text-foreground"
                            )}
                        >
                            <FlaskConical className="h-3 w-3" />
                            Rule Test
                        </button>
                    </div>

                    {/* Hunt Results Tab */}
                    {sidebarTab === 'results' && (
                        <>
                            {(huntMessage || huntDiagnostics.length > 0 || huntWarnings.length > 0) && (
                                <div className="border-b border-border-subtle p-3">
                                    <YaraDiagnosticsPanel
                                        title="Hunt Diagnostics"
                                        message={huntMessage || undefined}
                                        diagnostics={huntDiagnostics}
                                        errors={huntDiagnostics}
                                        warnings={huntWarnings}
                                    />
                                </div>
                            )}
                            <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                                {isHunting ? (
                                    <div className="flex flex-col items-center justify-center h-48 space-y-3 opacity-50">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Scanning Repository...</span>
                                    </div>
                                ) : matches.length > 0 ? (
                                    matches.map((match, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => {
                                                if (match.sha256) {
                                                    navigate(`/files/${match.sha256}`);
                                                } else {
                                                    toast.error('Cannot navigate: SHA256 identifier missing');
                                                }
                                            }}
                                            className="p-3 bg-background-secondary/30 border border-border-subtle rounded-lg hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer group animate-in slide-in-from-right-4 duration-300"
                                            style={{ animationDelay: `${idx * 50}ms` }}
                                        >
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <Shield className="h-3.5 w-3.5 text-primary shrink-0" />
                                                    <span className="text-[11px] font-bold truncate text-foreground group-hover:text-primary transition-colors">
                                                        {match.filename}
                                                    </span>
                                                </div>
                                                <Eye size={12} className="text-foreground-muted/30 group-hover:text-primary transition-opacity" />
                                            </div>
                                            <div className="flex items-center gap-1.5 mb-2 opacity-60">
                                                <Hash size={10} className="text-foreground-muted" />
                                                <span className="text-[9px] font-mono truncate text-foreground-muted">
                                                    {match.sha256 ? `${match.sha256.substring(0, 16)}...` : 'SHA256 not available'}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {match.rules && match.rules.length > 0 ? (
                                                    match.rules.map((rule, ridx) => (
                                                        <div key={ridx} className="px-1.5 py-0.5 bg-primary/5 border border-primary/20 rounded text-[8px] font-bold text-primary">
                                                            {rule}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="px-1.5 py-0.5 bg-background-secondary border border-border-subtle rounded text-[8px] font-black uppercase tracking-tighter text-foreground-muted">
                                                        No rules
                                                    </div>
                                                )}
                                                <div className="px-1.5 py-0.5 bg-background-secondary border border-border-subtle rounded text-[8px] font-black uppercase tracking-tighter text-foreground-muted ml-auto">
                                                    {match.rules?.length || 0} Match{match.rules?.length !== 1 ? 'es' : ''}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : huntCount === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-48 opacity-20 text-center p-6">
                                        <AlertTriangle size={32} className="mb-2" />
                                        <span className="text-[9px] font-black uppercase tracking-widest">No indicators matched this rule signature</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full opacity-20 text-center p-6">
                                        <Terminal size={48} className="mb-4" />
                                        <p className="text-[10px] font-black uppercase tracking-widest leading-loose">
                                            Enter a Yara rule and click "Hunt" to scan the repository
                                        </p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Rule Test Tab */}
                    {sidebarTab === 'test' && (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            <div className="p-3 border-b border-border-subtle/50 bg-background-secondary/20">
                                <p className="text-[10px] text-foreground-muted leading-relaxed">
                                    Paste SHA256 hashes below (one per line). Click <span className="text-primary font-bold">Run Test</span> to check if each file matches the current rule.
                                </p>
                            </div>

                            {/* Textarea */}
                            <div className="p-3 border-b border-border-subtle">
                                <textarea
                                    value={testHashes}
                                    onChange={e => setTestHashes(e.target.value)}
                                    placeholder={"e.g.\nabc123...def\n9f8e7d...c6b5a4"}
                                    disabled={isRunningTest}
                                    className={cn(
                                        "w-full h-28 resize-none rounded-lg border border-border-subtle bg-background-secondary/50 text-[11px] font-mono text-foreground p-2.5 placeholder:text-foreground-muted/40",
                                        "focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-all",
                                        "custom-scrollbar"
                                    )}
                                />
                                <Button
                                    onClick={handleRunTest}
                                    disabled={isRunningTest || isHunting || !testHashes.trim()}
                                    className="w-full mt-2 gap-2 h-9"
                                    size="sm"
                                >
                                    {isRunningTest ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Play className="h-3.5 w-3.5" />
                                    )}
                                    <span className="font-black uppercase tracking-widest text-[10px]">
                                        {isRunningTest ? 'Running...' : 'Run Test'}
                                    </span>
                                </Button>
                            </div>

                            {/* Results */}
                            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                                {testResults.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full opacity-20 text-center p-6">
                                        <FlaskConical size={40} className="mb-3" />
                                        <p className="text-[10px] font-black uppercase tracking-widest leading-loose">
                                            Results will appear here
                                        </p>
                                    </div>
                                ) : (
                                    testResults.map((result, idx) => (
                                        <div
                                            key={idx}
                                            className={cn(
                                                "flex items-center gap-2.5 p-2.5 rounded-lg border transition-all animate-in slide-in-from-bottom-2 duration-200",
                                                result.status === 'match' && "bg-success/8 border-success/30",
                                                result.status === 'no_match' && "bg-destructive/8 border-destructive/30",
                                                result.status === 'error' && "bg-warning/8 border-warning/30",
                                                result.status === 'loading' && "bg-background-secondary/30 border-border-subtle",
                                            )}
                                            style={{ animationDelay: `${idx * 30}ms` }}
                                        >
                                            <div className="shrink-0">
                                                {result.status === 'loading' && <Loader2 className="h-4 w-4 animate-spin text-foreground-muted" />}
                                                {result.status === 'match' && <CheckCircle2 className="h-4 w-4 text-success" />}
                                                {result.status === 'no_match' && <XCircle className="h-4 w-4 text-destructive" />}
                                                {result.status === 'error' && <AlertTriangle className="h-4 w-4 text-warning" />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="font-mono text-[10px] truncate text-foreground-muted">
                                                    {result.sha256.substring(0, 20)}…
                                                </div>
                                                {result.filename && (
                                                    <div className="text-[10px] font-bold truncate text-foreground mt-0.5">
                                                        {result.filename}
                                                    </div>
                                                )}
                                                {result.errorMsg && (
                                                    <div className="text-[9px] text-warning truncate mt-0.5 opacity-70">
                                                        {result.errorMsg}
                                                    </div>
                                                )}
                                            </div>
                                            <div className={cn(
                                                "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0",
                                                result.status === 'match' && "bg-success/20 text-success",
                                                result.status === 'no_match' && "bg-destructive/20 text-destructive",
                                                result.status === 'error' && "bg-warning/20 text-warning",
                                                result.status === 'loading' && "bg-foreground-muted/10 text-foreground-muted",
                                            )}>
                                                {result.status === 'match' ? 'HIT' : result.status === 'no_match' ? 'MISS' : result.status === 'error' ? 'ERR' : '...'}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}
