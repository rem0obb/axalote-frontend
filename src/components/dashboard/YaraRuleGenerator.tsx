import { useEffect, useState } from 'react';
import copy from 'copy-to-clipboard';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ApiError, apiService } from '@/services/api.service';
import { useTheme } from '@/components/providers/ThemeProvider';
import { defineMonacoThemes, AXALOTE_DARK_THEME_NAME, AXALOTE_LIGHT_THEME_NAME } from '@/lib/monaco-theme';
import { Braces, Copy, FileEdit, Loader2, RefreshCw, SearchCode } from 'lucide-react';
import { YaraGeneratedRuleResponse } from '@/types/threat.types';

const YARA_LANGUAGE_ID = 'yara';

interface YaraRuleGeneratorProps {
  sha256: string;
  filename?: string;
  family?: string;
}

function defaultRuleName(filename?: string, family?: string) {
  const source = family || filename || 'auto_rule';
  const normalized = source
    .replace(/\.[^.]+$/, '')
    .replace(/[^\w]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || 'auto_rule';
}

export function YaraRuleGenerator({ sha256, filename, family }: YaraRuleGeneratorProps) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [ruleName, setRuleName] = useState(defaultRuleName(filename, family));
  const [maxStrings, setMaxStrings] = useState(20);
  const [entropyThreshold, setEntropyThreshold] = useState(7);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<YaraGeneratedRuleResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [editableRule, setEditableRule] = useState('');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  });

  useEffect(() => {
    setRuleName(defaultRuleName(filename, family));
    setResult(null);
    setError(null);
    setEditableRule('');
  }, [sha256, filename, family]);

  useEffect(() => {
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (event: MediaQueryListEvent) => {
        setResolvedTheme(event.matches ? 'dark' : 'light');
      };

      setResolvedTheme(mediaQuery.matches ? 'dark' : 'light');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    setResolvedTheme(theme === 'dark' ? 'dark' : 'light');
  }, [theme]);

  const handleEditorWillMount = (monaco: any) => {
    monaco.languages.register({ id: YARA_LANGUAGE_ID });
    monaco.languages.setMonarchTokensProvider(YARA_LANGUAGE_ID, {
      keywords: [
        'rule', 'meta', 'strings', 'condition', 'all', 'any', 'of', 'them', 'at', 'in', 'filesize', 'entrypoint',
        'int8', 'int16', 'int32', 'uint8', 'uint16', 'uint32', 'ascii', 'wide', 'nocase', 'fullword',
        'private', 'global', 'import', 'include', 'for', 'true', 'false', 'and', 'or', 'not'
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
          [/\$[a-zA-Z0-9_*]*/, 'variable'],
          [/\b0x[0-9a-fA-F]+\b/, 'number.hex'],
          [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
          [/\d+/, 'number'],
          [/"([^"\\]|\\.)*$/, 'string.invalid'],
          [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
          [/{\s*([0-9a-fA-F?]{2}\s*)+}/, 'number.hex'],
        ],
        comment: [
          [/[^\/*]+/, 'comment'],
          [/\/\*/, 'comment', '@push'],
          ['\\*/', 'comment', '@pop'],
          [/[\/*]/, 'comment']
        ],
        string: [
          [/[^\\"]+/, 'string'],
          [/\\./, 'string.escape'],
          [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }]
        ],
        whitespace: [
          [/[ \t\r\n]+/, 'white'],
          [/\/\*/, 'comment', '@comment'],
          [/\/\/.*$/, 'comment'],
        ],
      },
    });

    defineMonacoThemes(monaco);
  };

  const generateRule = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await apiService.generateYaraRule(sha256, {
        name: ruleName,
        options: {
          max_strings: maxStrings,
          entropy_threshold: entropyThreshold,
        },
      });

      if (response.error) {
        setError(response.error);
        const returnedRule = response.error.data?.rule;
        if (typeof returnedRule === 'string') {
          setEditableRule(returnedRule);
        }
        toast.error(`Rule generation failed: ${response.error.message}`);
        return;
      }

      if (response.data) {
        setResult(response.data);
        setEditableRule(response.data.rule);
        toast.success('YARA rule generated and compiled');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const copyRule = () => {
    if (!editableRule) return;
    if (copy(editableRule)) {
      toast.success('Rule copied');
    } else {
      toast.error('Copy failed');
    }
  };

  const sendToHunt = () => {
    if (!editableRule) return;
    localStorage.setItem('yara_hunt_state', JSON.stringify({
      rules: editableRule,
      matches: [],
      huntCount: null,
      timestamp: Date.now(),
    }));
    toast.success('Rule staged for hunt');
    navigate('/hunt');
  };

  const openEditor = () => {
    if (!editableRule) return;
    navigate('/rules/editor', {
      state: {
        rules: editableRule,
        fileName: `${ruleName || result?.rule_name || 'generated_rule'}.yar`,
        namespace: 'generated',
      },
    });
  };

  const summary = result?.selection_summary;
  const selectedStrings = result?.strings || [];
  const highEntropySections = result?.high_entropy_sections || [];

  return (
    <div className="absolute inset-0 overflow-hidden bg-background-secondary/10">
      <div className="h-full grid grid-cols-[360px_minmax(0,1fr)]">
        <aside className="border-r border-border-subtle bg-background-secondary/40 overflow-y-auto custom-scrollbar">
          <div className="p-4 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Braces className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-black uppercase tracking-widest text-foreground">YARA Generator</h2>
              </div>
              <p className="text-[11px] text-foreground-muted font-mono break-all">{sha256}</p>
            </div>

            <div className="space-y-3 rounded-lg border border-border-subtle bg-background/40 p-3">
              <label className="block">
                <span className="text-[9px] font-black uppercase tracking-widest text-foreground-muted">Rule Name</span>
                <input
                  value={ruleName}
                  onChange={(event) => setRuleName(event.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-border-subtle bg-background px-3 text-xs font-mono text-foreground outline-none focus:border-primary/60"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[9px] font-black uppercase tracking-widest text-foreground-muted">Strings</span>
                  <input
                    type="number"
                    min={1}
                    max={64}
                    value={maxStrings}
                    onChange={(event) => setMaxStrings(Number(event.target.value))}
                    className="mt-1 h-9 w-full rounded-md border border-border-subtle bg-background px-3 text-xs font-mono text-foreground outline-none focus:border-primary/60"
                  />
                </label>

                <label className="block">
                  <span className="text-[9px] font-black uppercase tracking-widest text-foreground-muted">Entropy</span>
                  <input
                    type="number"
                    min={0}
                    max={8}
                    step={0.1}
                    value={entropyThreshold}
                    onChange={(event) => setEntropyThreshold(Number(event.target.value))}
                    className="mt-1 h-9 w-full rounded-md border border-border-subtle bg-background px-3 text-xs font-mono text-foreground outline-none focus:border-primary/60"
                  />
                </label>
              </div>

              <Button
                onClick={generateRule}
                disabled={isGenerating || !sha256}
                className="w-full h-9 gap-2 text-[10px] font-black uppercase tracking-widest"
              >
                {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Generate Rule
              </Button>
            </div>

            {result && (
              <div className="grid grid-cols-2 gap-2">
                <Metric label="Type" value={result.file_type} />
                <Metric label="Selected" value={String(result.strings.length)} />
                <Metric label="Unique" value={String(summary?.unique_selected ?? 0)} />
                <Metric label="Corpus" value={String(summary?.corpus_records ?? 0)} />
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <div className="text-xs font-bold text-destructive">Generation failed</div>
                <div className="mt-1 text-[11px] text-foreground-muted">{error.message}</div>
              </div>
            )}

            {highEntropySections.length > 0 && (
              <div>
                <h3 className="mb-2 text-[10px] font-black uppercase tracking-widest text-foreground-muted">High Entropy</h3>
                <div className="space-y-1.5">
                  {highEntropySections.slice(0, 8).map((section, index) => (
                    <div key={`${section.name}-${index}`} className="flex items-center justify-between rounded-md border border-border-subtle bg-background/40 px-2 py-1.5">
                      <code className="text-[10px] text-foreground">{section.name}</code>
                      <Badge variant="secondary" className="h-5 text-[9px]">{section.entropy?.toFixed?.(2) ?? section.entropy}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedStrings.length > 0 && (
              <div>
                <h3 className="mb-2 text-[10px] font-black uppercase tracking-widest text-foreground-muted">Selected Strings</h3>
                <div className="space-y-1.5">
                  {selectedStrings.slice(0, 12).map((item, index) => (
                    <div key={`${item.offset}-${index}`} className="rounded-md border border-border-subtle bg-background/40 p-2">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <Badge variant={item.uniqueness === 'unique' ? 'default' : 'secondary'} className="h-5 text-[9px]">
                          {item.uniqueness || 'candidate'}
                        </Badge>
                        <span className="text-[9px] font-mono text-foreground-muted">score {item.score?.toFixed?.(1) ?? item.score}</span>
                      </div>
                      <code className="block text-[10px] text-foreground-muted break-all">{item.value}</code>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        <main className="min-w-0 flex flex-col">
          <div className="h-11 border-b border-border-subtle bg-background-secondary/30 px-4 flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-xs font-black uppercase tracking-widest text-foreground">Editable Rule</div>
              <div className="text-[10px] text-foreground-muted truncate">{result?.message || 'Generate a rule, then tune it here before copying or hunting.'}</div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={copyRule} disabled={!editableRule} className="h-7 gap-2 text-[10px] font-bold uppercase tracking-wider">
                <Copy className="h-3 w-3" />
                Copy
              </Button>
              <Button variant="outline" size="sm" onClick={sendToHunt} disabled={!editableRule} className="h-7 gap-2 text-[10px] font-bold uppercase tracking-wider">
                <SearchCode className="h-3 w-3" />
                Hunt
              </Button>
              <Button variant="outline" size="sm" onClick={openEditor} disabled={!editableRule} className="h-7 gap-2 text-[10px] font-bold uppercase tracking-wider">
                <FileEdit className="h-3 w-3" />
                Editor
              </Button>
            </div>
          </div>

          <div className="flex-1 min-h-0 bg-[#101318]">
            <Editor
              key={resolvedTheme}
              height="100%"
              language={YARA_LANGUAGE_ID}
              theme={resolvedTheme === 'light' ? AXALOTE_LIGHT_THEME_NAME : AXALOTE_DARK_THEME_NAME}
              value={editableRule}
              onChange={(value) => setEditableRule(value || '')}
              beforeMount={handleEditorWillMount}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 16, bottom: 16 },
                roundedSelection: true,
                wordWrap: 'on',
                tabSize: 4,
                fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
                scrollbar: {
                  vertical: 'visible',
                  horizontal: 'visible',
                  useShadows: false,
                  verticalScrollbarSize: 8,
                  horizontalScrollbarSize: 8,
                },
              }}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-background/40 p-2">
      <div className="text-[8px] uppercase tracking-widest text-foreground-muted">{label}</div>
      <div className="mt-1 text-xs font-black text-foreground truncate">{value}</div>
    </div>
  );
}
