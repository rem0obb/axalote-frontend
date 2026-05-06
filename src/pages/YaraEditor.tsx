import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiService } from '@/services/api.service';
import { useYaraSourceFiles } from '@/hooks/useEndpointData';
import {
    ArrowLeft,
    Save,
    Code,
    Terminal,
    Folder,
    File,
    ChevronRight,
    ChevronDown,
    Package,
    LayoutList,
    Hash,
    AlignLeft,
    Box
} from 'lucide-react';
import { toast } from 'sonner';
import Editor, { loader } from '@monaco-editor/react';
import { cn } from '@/lib/utils';
import { YaraDiagnostic, YaraSourceFile } from '@/types/threat.types';
import { useRef, useEffect, useMemo } from 'react';
import { useTheme } from '@/components/providers/ThemeProvider';
import { defineMonacoThemes, AXALOTE_DARK_THEME_NAME, AXALOTE_LIGHT_THEME_NAME } from '@/lib/monaco-theme';
import { useOutletContext } from 'react-router-dom';
import { MainLayoutContextType } from '@/components/layout/MainLayout';
import { YaraDiagnosticsPanel } from '@/components/common/YaraDiagnosticsPanel';

// Define a simple Yara highlighting for Monaco
const YARA_LANGUAGE_ID = 'yara';

const DEFAULT_TEMPLATE = `import "pe"

rule New_Ruleset {
    meta:
        description = "Detection rule for..."
        author = "Kaspersky"
        copyright = "Kaspersky"
        distribution = "DISTRIBUTION IS FORBIDDEN. DO NOT UPLOAD TO ANY MULTISCANNER OR SHARE ON ANY THREAT INTEL PLATFORM"
        version = "1.0"
        last_modified = "${new Date().toISOString().split('T')[0]}"
        hash = ""

    strings:
        $a = "unique_string" ascii wide
        $b = { 00 11 22 33 44 55 }

    condition:
        pe.is_pe and ($a or $b)
}`;

export default function YaraEditor() {
    const navigate = useNavigate();
    const location = useLocation();
    const initialState = location.state || {};

    const [namespace, setNamespace] = useState(initialState.namespace || 'default');
    const [rules, setRules] = useState(initialState.rules || DEFAULT_TEMPLATE);
    const [fileName, setFileName] = useState(initialState.fileName || '');
    const [isDeploying, setIsDeploying] = useState(false);
    const [deployMessage, setDeployMessage] = useState<string | null>(null);
    const [deployDiagnostics, setDeployDiagnostics] = useState<YaraDiagnostic[]>([]);
    const [deployWarnings, setDeployWarnings] = useState<YaraDiagnostic[]>([]);
    const { theme } = useTheme();
    const editorRef = useRef<any>(null);

    // Track original metadata if this is an update
    const [originalMetadata, setOriginalMetadata] = useState<{ namespace: string, name: string } | null>(
        initialState.fileName ? {
            namespace: initialState.namespace || 'default',
            name: initialState.fileName.replace(/\.yar$/, '')
        } : null
    );

    // Explorer State
    const { data: sourceFiles, refetch: refetchSource } = useYaraSourceFiles();
    const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({ "default": true });

    // Outline State
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

            setResolvedTheme(mediaQuery.matches ? 'dark' : 'light');
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        } else {
            setResolvedTheme(theme === 'dark' ? 'dark' : 'light');
        }
    }, [theme]);

    const scrollToLine = (lineNumber: number) => {
        if (editorRef.current) {
            editorRef.current.revealLineInCenter(lineNumber);
            editorRef.current.setPosition({ lineNumber, column: 1 });
            editorRef.current.focus();
        }
    };

    const groupedSources = useMemo(() => {
        if (!sourceFiles) return {};
        return sourceFiles.reduce((acc, file) => {
            const ns = file.namespace || 'default';
            if (!acc[ns]) acc[ns] = [];
            acc[ns].push(file);
            return acc;
        }, {} as Record<string, YaraSourceFile[]>);
    }, [sourceFiles]);

    const selectFile = (file: YaraSourceFile) => {
        setNamespace(file.namespace || 'default');
        setRules(file.content || '');
        setFileName(file.file);
        setOriginalMetadata({
            namespace: file.namespace || 'default',
            name: file.file.replace(/\.yar$/, '')
        });
    };

    const handleEditorDidMount = (editor: any) => {
        editorRef.current = editor;
    };

    const handleEditorWillMount = (monaco: any) => {
        // Basic syntax highlighting for Yara
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

    const handleDeploy = async () => {
        const trimmedRules = rules.trim();
        const trimmedFileName = fileName.trim();
        const trimmedNamespace = namespace.trim();

        if (!trimmedRules) {
            toast.error("Please enter a valid Yara rule.");
            return;
        }

        if (!trimmedFileName) {
            toast.error("Please specify a filename.");
            return;
        }

        const ensureArray = (data: any) => {
            if (!data) return [];
            if (Array.isArray(data)) return data;
            return Object.values(data);
        };

        setIsDeploying(true);
        try {
            const ruleName = trimmedFileName.replace(/\.yar$/, '');
            const newMetadata = { namespace: trimmedNamespace, name: ruleName };

            // If we have original metadata, it's an update
            const response = await apiService.loadYaraRules(
                trimmedRules,
                newMetadata,
                originalMetadata || undefined
            );

            if (response.error) {
                const errData = response.error.data;
                setDeployMessage(response.error.message || errData?.message || 'Failed to compile YARA rule');
                setDeployDiagnostics(ensureArray(errData?.errors) || ensureArray(errData?.diagnostics));
                setDeployWarnings(ensureArray(errData?.warnings));
                toast.error(`Deployment failed: ${response.error.message || errData?.message}`);
            } else if (response.data) {
                if (response.data.success) {
                    setDeployMessage(null);
                    setDeployDiagnostics(ensureArray(response.data.diagnostics));
                    setDeployWarnings(ensureArray(response.data.warnings));
                    toast.success(originalMetadata ? "Rule updated successfully!" : "Rule created successfully!");
                    refetchSource(); // Refresh explorer
                    // Keep the state for further editing if needed
                } else {
                    setDeployMessage(response.data.message || 'Unknown error');
                    setDeployDiagnostics(ensureArray(response.data.errors).length > 0 ? ensureArray(response.data.errors) : ensureArray(response.data.diagnostics));
                    setDeployWarnings(ensureArray(response.data.warnings));
                    toast.error(`Deployment failed: ${response.data.message || 'Unknown error'}`);
                }
            }
        } catch (error) {
            setDeployMessage("An unexpected error occurred during deployment.");
            toast.error("An unexpected error occurred during deployment.");
            console.error(error);
        } finally {
            setIsDeploying(false);
        }
    };

    const context = useOutletContext<MainLayoutContextType | null>();
    const navbarPosition = context?.navbarPosition || 'side';

    return (
        <div className={cn(
            "h-full flex flex-col p-4 space-y-4 overflow-hidden animate-in fade-in duration-500 bg-background text-foreground",
            navbarPosition === 'top' && "pt-18" // slightly more than 14 for visual balance inside its own p-4
        )}>
            {(deployMessage || deployDiagnostics.length > 0 || deployWarnings.length > 0) && (
                <YaraDiagnosticsPanel
                    title="Compilation Diagnostics"
                    message={deployMessage || undefined}
                    diagnostics={deployDiagnostics}
                    errors={deployDiagnostics}
                    warnings={deployWarnings}
                />
            )}
            {/* Header */}
            <div className="shrink-0">
                <div className="bg-card border border-border-subtle rounded-xl p-3 shadow-sm flex items-start gap-4 relative overflow-hidden group">
                    <Button variant="outline" size="icon" onClick={() => navigate(-1)} className="shrink-0 h-10 w-10">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Terminal className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-lg font-bold tracking-tight truncate">Yara Editor</h1>
                            <p className="text-[10px] text-foreground-muted uppercase font-black tracking-widest opacity-60">Rule Intelligence Architect</p>
                        </div>
                    </div>

                    <div className="ml-auto flex items-end gap-4">
                        <div className="flex flex-col gap-1 min-w-0">
                            <span className="text-[9px] font-black uppercase tracking-widest text-foreground-muted ml-0.5">Filename</span>
                            <Input
                                value={fileName}
                                onChange={(e) => setFileName(e.target.value)}
                                className="w-48 h-9 font-mono text-sm bg-background-secondary border-border-subtle"
                                placeholder="rule_name.yar"
                            />
                        </div>
                        <div className="flex flex-col gap-1 min-w-0">
                            <span className="text-[9px] font-black uppercase tracking-widest text-foreground-muted ml-0.5">Namespace</span>
                            <Input
                                value={namespace}
                                onChange={(e) => setNamespace(e.target.value)}
                                className="w-32 h-9 font-mono text-sm bg-background-secondary border-border-subtle"
                                placeholder="default"
                            />
                        </div>
                        <Button 
                            onClick={handleDeploy} 
                            disabled={isDeploying} 
                            variant="outline"
                            className="gap-2"
                        >
                            {isDeploying ? (
                                <span className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            Save
                        </Button>
                    </div>
                </div>
            </div>

            {/* Editor Layout: Editor | Outline */}
            <div className="flex-1 flex gap-4 min-h-0">

                {/* Center: Editor Area */}
                <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-background-secondary rounded-xl border border-border-subtle overflow-hidden">
                    <div className="bg-background-secondary/50 border-b border-border-subtle px-4 py-2 flex items-center justify-between text-[10px] text-foreground-muted font-black uppercase tracking-widest">
                        <div className="flex items-center gap-2">
                            <Code className="h-3 w-3 text-primary" />
                            <span>{fileName || 'new_rule.yar'}</span>
                        </div>
                    </div>
                    <div className="flex-1">
                        <Editor
                            key={resolvedTheme} // Force remount on theme change
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
                                scrollbar: {
                                    vertical: 'visible',
                                    horizontal: 'visible',
                                    useShadows: false,
                                    verticalScrollbarSize: 8,
                                    horizontalScrollbarSize: 8
                                },
                                fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
                            }}
                        />
                    </div>
                </div>

                {/* 2. Right Sidebar: Outline */}
                <aside className="w-56 bg-card border border-border-subtle rounded-xl flex flex-col shadow-sm overflow-hidden shrink-0">
                    <div className="p-3 border-b border-border-subtle bg-background-secondary/30 flex items-center justify-between">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-foreground-muted flex items-center gap-2">
                            <LayoutList className="h-3.5 w-3.5 text-primary" />
                            Outline
                        </h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                        {outline.length > 0 ? (
                            outline.map((ruleNode, idx) => (
                                <div key={idx} className="space-y-0.5">
                                    <button
                                        onClick={() => scrollToLine(ruleNode.line)}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-background-secondary transition-colors group text-left min-w-0"
                                    >
                                        <Box size={14} className="text-primary shrink-0 opacity-70" />
                                        <span className="text-xs font-bold text-foreground truncate font-mono">
                                            {ruleNode.name}
                                        </span>
                                    </button>
                                    <div className="ml-3 pl-3 border-l border-border-subtle/30 space-y-0.5">
                                        {ruleNode.children.map((child: any, cidx: number) => (
                                            <button
                                                key={cidx}
                                                onClick={() => scrollToLine(child.line)}
                                                className="w-full flex items-center gap-2 px-2 py-1 rounded-md hover:bg-primary/5 text-left transition-all group min-w-0"
                                            >
                                                {child.type === 'meta' && <AlignLeft size={12} className="text-foreground-muted/60 shrink-0" />}
                                                {child.type === 'strings' && <Hash size={12} className="text-foreground-muted/60 shrink-0" />}
                                                {child.type === 'condition' && <Terminal size={12} className="text-foreground-muted/60 shrink-0" />}
                                                <span className="text-[11px] text-foreground-muted group-hover:text-foreground font-medium">
                                                    {child.name}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center opacity-20 text-center p-4">
                                <Code size={32} className="mb-2" />
                                <span className="text-[9px] font-black uppercase tracking-widest leading-tight">No rules detected in content</span>
                            </div>
                        )}
                    </div>
                </aside>

            </div>
        </div>
    );
}
