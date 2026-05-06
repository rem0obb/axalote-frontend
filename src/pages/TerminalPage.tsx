import { useState, useRef, useEffect } from 'react';
import { 
  Terminal, 
  History, 
  Trash2, 
  Search, 
  Clock,
  ChevronRight,
  Zap,
  Copy,
  Check,
  Lightbulb
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiService } from '@/services/api.service';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TerminalLine {
  type: 'input' | 'output' | 'error' | 'info' | 'success';
  content: string;
  timestamp: Date;
}

interface AutocompleteData {
  globals: string[];
  actions: any;
  snippets: Array<{
    label: string;
    detail: string;
    insert: string;
  }>;
}

const WELCOME_MESSAGES = [
  { type: 'success' as const, content: 'AXALOTE Lua Console v1.1.0' },
  { type: 'info' as const, content: 'Type "help" for commands. Use Tab for autocomplete.' },
];

const HELP_TEXT = `Available Commands:
  help              Show this help message
  clear             Clear terminal screen
  history           Show command history
  
Examples:
  print("Hello")    Print text
  return 2+2        Math operations
  cov:execute(...)  Engine actions`;

export default function TerminalPage() {
  const [lines, setLines] = useState<TerminalLine[]>(
    WELCOME_MESSAGES.map(msg => ({ ...msg, timestamp: new Date() }))
  );
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('terminal_history');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showTimestamps, setShowTimestamps] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Autocomplete states
  const [autocompleteData, setAutocompleteData] = useState<AutocompleteData | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('terminal_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  useEffect(() => {
    inputRef.current?.focus();
    // Fetch autocomplete data
    apiService.getPluginAutocomplete().then(response => {
      if (response.data?.success && response.data.data?.exec) {
        setAutocompleteData(response.data.data.exec);
      }
    });
  }, []);

  // Filter suggestions
  useEffect(() => {
    if (!autocompleteData || !input.trim()) {
      setShowSuggestions(false);
      return;
    }

    const lastWord = input.split(/\s+/).pop() || '';
    if (lastWord.length < 2) {
      setShowSuggestions(false);
      return;
    }

    const suggestions: string[] = [];
    autocompleteData.globals.forEach(g => {
      if (g.toLowerCase().includes(lastWord.toLowerCase())) suggestions.push(g);
    });
    autocompleteData.snippets.forEach(s => {
      if (s.label.toLowerCase().includes(lastWord.toLowerCase())) suggestions.push(s.label + ' → ' + s.detail);
    });

    if (suggestions.length > 0) {
      setFilteredSuggestions(suggestions.slice(0, 10));
      setShowSuggestions(true);
      setSelectedSuggestion(0);
    } else {
      setShowSuggestions(false);
    }
  }, [input, autocompleteData]);

  const formatObject = (obj: any, indent = 0): string => {
    if (obj === null || obj === undefined) return 'nil';
    if (typeof obj !== 'object') return String(obj);
    if (Array.isArray(obj)) {
      return obj.map(item => `${' '.repeat(indent)}- ${formatObject(item, indent + 2)}`).join('\n');
    }

    return Object.entries(obj)
      .map(([key, value]) => {
        const prefix = ' '.repeat(indent);
        if (typeof value === 'object' && value !== null) {
          return `${prefix}${key}:\n${formatObject(value, indent + 2)}`;
        }
        return `${prefix}${key}: ${value}`;
      })
      .join('\n');
  };

  const handleExecute = async (overrideCode?: string) => {
    const code = (overrideCode || input).trim();
    if (!code || isExecuting) return;
    
    if (code === 'help') {
      let fullHelp = HELP_TEXT;
      if (autocompleteData) {
        fullHelp += '\n\nAvailable Engine Globals:\n  ' + autocompleteData.globals.join(', ');
        fullHelp += '\n\nCommon Snippets:\n' + autocompleteData.snippets.map(s => `  ${s.label}: ${s.detail}`).join('\n');
      }
      
      setLines(prev => [...prev, 
        { type: 'input', content: code, timestamp: new Date() },
        { type: 'info', content: fullHelp, timestamp: new Date() }
      ]);
      setInput('');
      return;
    }

    if (code === 'clear') {
      setLines(WELCOME_MESSAGES.map(msg => ({ ...msg, timestamp: new Date() })));
      setInput('');
      return;
    }

    setLines(prev => [...prev, { type: 'input', content: code, timestamp: new Date() }]);
    if (history[history.length - 1] !== code) setHistory(prev => [...prev, code].slice(-100));
    setHistoryIndex(-1);
    setInput('');
    setIsExecuting(true);
    setShowSuggestions(false);

    try {
      const response = await apiService.execPluginCode(code);
      
      if (response.error) {
        setLines(prev => [...prev, { 
          type: 'error', 
          content: `❌ API Error: ${response.error?.message || 'Unknown network error'}`, 
          timestamp: new Date() 
        }]);
        return;
      }

      if (!response.data) {
        setLines(prev => [...prev, { 
          type: 'error', 
          content: '❌ No response data received from engine', 
          timestamp: new Date() 
        }]);
        return;
      }

      const { success, result, output } = response.data;

      // 1. Process Output (Print statements)
      if (output && Array.isArray(output) && output.length > 0) {
        output.forEach(line => setLines(prev => [...prev, { type: 'output', content: line, timestamp: new Date() }]));
      }

      // 2. Process Result (Return value)
      if (result !== undefined && result !== null) {
        const dataToDisplay = (typeof result === 'object' && result.data !== undefined) ? result.data : result;
        const resultStr = formatObject(dataToDisplay);
        setLines(prev => [...prev, { type: 'success', content: `✓ ${resultStr}`, timestamp: new Date() }]);
      } else if (!output || output.length === 0) {
        // No result and no output
        if (success) {
          setLines(prev => [...prev, { type: 'success', content: '✓ (success, no return value)', timestamp: new Date() }]);
        } else {
          setLines(prev => [...prev, { type: 'error', content: '❌ Execution failed with no details', timestamp: new Date() }]);
        }
      }
    } catch (error) {
      setLines(prev => [...prev, { 
        type: 'error', 
        content: `❌ Critical Error: ${error instanceof Error ? error.message : 'Unknown exception'}`, 
        timestamp: new Date() 
      }]);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestion(prev => Math.min(prev + 1, filteredSuggestions.length - 1));
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestion(prev => Math.max(prev - 1, 0));
        return;
      } else if (e.key === 'Tab' || e.key === 'Enter') {
        if (filteredSuggestions.length > 0) {
          e.preventDefault();
          const suggestion = filteredSuggestions[selectedSuggestion];
          const snippet = autocompleteData?.snippets.find(s => suggestion.startsWith(s.label + ' →'));
          
          if (snippet) {
            setInput(snippet.insert);
          } else {
            const words = input.split(/\s+/);
            words[words.length - 1] = suggestion;
            setInput(words.join(' '));
          }
          setShowSuggestions(false);
          return;
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowSuggestions(false);
        return;
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1;
        if (newIndex >= history.length) {
          setHistoryIndex(-1);
          setInput('');
        } else {
          setHistoryIndex(newIndex);
          setInput(history[newIndex]);
        }
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setLines([{ type: 'output', content: 'Terminal cleared', timestamp: new Date() }]);
    }
  };

  return (
    <div className="h-full flex flex-col bg-background text-foreground animate-in fade-in duration-500 overflow-hidden">
      <header className="shrink-0 flex items-center justify-between p-4 border-b border-border-subtle bg-card/30">
        <div className="flex items-center gap-3">
          <Terminal className="h-4 w-4 text-primary" />
          <h1 className="text-xs font-black uppercase tracking-widest">Lua Console</h1>
        </div>
        <div className="flex items-center gap-2">
          {autocompleteData && <div className="flex items-center gap-1.5 text-[10px] text-emerald-500 mr-4 font-bold uppercase"><Lightbulb size={12}/> IntelliSense</div>}
          <Button variant="ghost" size="sm" onClick={() => setShowTimestamps(!showTimestamps)} className={cn("h-8 px-2 text-[10px] font-bold uppercase", showTimestamps && "text-primary")}>
            <Clock className="h-3.5 w-3.5 mr-1.5" /> Time
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setLines([])} className="h-8 px-2 text-[10px] font-bold uppercase">
            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Clear
          </Button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <aside className="w-64 shrink-0 border-r border-border-subtle flex flex-col bg-card/10">
          <div className="p-3 border-b border-border-subtle space-y-2">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-foreground-muted">
              <span className="flex items-center gap-1.5"><History size={12}/> History</span>
              <button onClick={() => setHistory([])}><Trash2 size={10}/></button>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-foreground-muted" />
              <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-7 pl-7 text-[10px] bg-background/50" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
            {history.filter(h => h.toLowerCase().includes(searchQuery.toLowerCase())).reverse().map((cmd, idx) => (
              <button key={idx} onClick={() => setInput(cmd)} className="w-full text-left p-2 rounded hover:bg-muted text-[11px] font-mono truncate text-foreground-muted hover:text-foreground">
                {cmd}
              </button>
            ))}
          </div>
        </aside>

        <main className="flex-1 flex flex-col min-w-0 bg-background/50 relative">
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 font-mono text-[13px] leading-relaxed custom-scrollbar">
            {lines.map((line, idx) => (
              <div key={idx} className="mb-1 flex items-start gap-3 group">
                {showTimestamps && <span className="text-[10px] text-foreground-muted opacity-40 shrink-0 mt-0.5">{line.timestamp.toLocaleTimeString()}</span>}
                <span className={cn(
                  "flex-1 break-all whitespace-pre-wrap",
                  line.type === 'input' && "text-primary font-bold",
                  line.type === 'error' && "text-destructive font-bold",
                  line.type === 'success' && "text-emerald-500 font-bold",
                  line.type === 'info' && "text-foreground-muted italic"
                )}>
                  {line.type === 'input' && <span className="mr-2 opacity-50">❯</span>}
                  {line.content}
                </span>
                <button onClick={() => { navigator.clipboard.writeText(line.content); toast.success('Copied'); }} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded"><Copy size={12}/></button>
              </div>
            ))}
            {isExecuting && <div className="text-[11px] text-primary animate-pulse mt-2 px-4">Executing on engine...</div>}
          </div>

          {/* Autocomplete Suggestions */}
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute bottom-20 left-4 right-4 bg-zinc-900 border border-border-subtle rounded-xl shadow-2xl z-50 overflow-hidden max-h-48 overflow-y-auto custom-scrollbar">
              {filteredSuggestions.map((s, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "px-4 py-2 text-[12px] font-mono cursor-pointer transition-colors border-b border-zinc-800/50 last:border-0",
                    idx === selectedSuggestion ? "bg-primary/10 text-primary" : "text-foreground-muted hover:bg-zinc-800"
                  )}
                  onClick={() => {
                    const snippet = autocompleteData?.snippets.find(snip => s.startsWith(snip.label + ' →'));
                    if (snippet) setInput(snippet.insert);
                    else {
                      const words = input.split(/\s+/);
                      words[words.length - 1] = s;
                      setInput(words.join(' '));
                    }
                    setShowSuggestions(false);
                    inputRef.current?.focus();
                  }}
                >
                  {s}
                </div>
              ))}
            </div>
          )}

          <div className="p-4 border-t border-border-subtle bg-card/20">
            <div className="flex items-center gap-3">
              <span className="text-primary font-bold select-none">❯</span>
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter Lua code..."
                disabled={isExecuting}
                className="flex-1 bg-background border-border-subtle text-[13px] font-mono h-10"
              />
              <Button 
                onClick={() => handleExecute()} 
                disabled={isExecuting || !input.trim()} 
                size="sm" 
                variant="outline"
                className="h-10 px-4"
              >
                {isExecuting ? <Zap className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
