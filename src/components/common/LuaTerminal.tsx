import { useState, useRef, useEffect } from 'react';
import { Terminal, X, ChevronUp, ChevronDown, Lightbulb, Copy, Check, Info, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiService } from '@/services/api.service';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TerminalLine {
  type: 'input' | 'output' | 'error' | 'info' | 'success';
  content: string;
  timestamp: Date;
}

interface LuaTerminalProps {
  isOpen: boolean;
  onClose: () => void;
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
  { type: 'success' as const, content: '╔═══════════════════════════════════════════════════════════╗' },
  { type: 'success' as const, content: '║  AXALOTE Lua REPL v1.0.0 - Interactive Lua Environment  ║' },
  { type: 'success' as const, content: '╚═══════════════════════════════════════════════════════════╝' },
  { type: 'info' as const, content: '' },
  { type: 'info' as const, content: '📦 Available: cov object with full engine access' },
  { type: 'info' as const, content: '💡 Type "help" for available commands' },
  { type: 'info' as const, content: '⌨️  Use ↑↓ for history, Tab for autocomplete, Ctrl+L to clear' },
  { type: 'info' as const, content: '' },
];

const HELP_TEXT = `
╔═══════════════════════════════════════════════════════════╗
║                    AVAILABLE COMMANDS                     ║
╚═══════════════════════════════════════════════════════════╝

  help              Show this help message
  clear             Clear terminal screen
  history           Show command history
  exit              Close terminal
  
╔═══════════════════════════════════════════════════════════╗
║                    LUA EXAMPLES                           ║
╚═══════════════════════════════════════════════════════════╝

  print("Hello")                    Print to console
  return 2 + 2                      Return value
  cov:execute(...)                  Execute engine action
  
╔═══════════════════════════════════════════════════════════╗
║                    KEYBOARD SHORTCUTS                     ║
╚═══════════════════════════════════════════════════════════╝

  ↑ / ↓             Navigate command history
  Tab               Autocomplete
  Ctrl+L            Clear screen
  Ctrl+\`            Toggle terminal
  Enter             Execute command
`;

export function LuaTerminal({ isOpen, onClose }: LuaTerminalProps) {
  const [lines, setLines] = useState<TerminalLine[]>(
    WELCOME_MESSAGES.map(msg => ({ ...msg, timestamp: new Date() }))
  );
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [height, setHeight] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const [autocompleteData, setAutocompleteData] = useState<AutocompleteData | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const [showTimestamps, setShowTimestamps] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const resizeStartY = useRef(0);
  const resizeStartHeight = useRef(0);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isCollapsed && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isCollapsed]);

  // Load autocomplete data
  useEffect(() => {
    if (isOpen && !autocompleteData) {
      apiService.getPluginAutocomplete().then(response => {
        if (response.data?.success && response.data.data?.exec) {
          setAutocompleteData(response.data.data.exec);
        }
      });
    }
  }, [isOpen]);

  // Handle resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const delta = resizeStartY.current - e.clientY;
      const newHeight = Math.min(Math.max(resizeStartHeight.current + delta, 200), window.innerHeight - 100);
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing]);

  // Update suggestions based on input
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

    // Filter globals and actions
    const suggestions: string[] = [];
    
    // Add globals
    autocompleteData.globals.forEach(g => {
      if (g.toLowerCase().includes(lastWord.toLowerCase())) {
        suggestions.push(g);
      }
    });

    // Add snippets
    autocompleteData.snippets.forEach(s => {
      if (s.label.toLowerCase().includes(lastWord.toLowerCase())) {
        suggestions.push(s.label + ' → ' + s.detail);
      }
    });

    if (suggestions.length > 0) {
      setFilteredSuggestions(suggestions.slice(0, 10));
      setShowSuggestions(true);
      setSelectedSuggestion(0);
    } else {
      setShowSuggestions(false);
    }
  }, [input, autocompleteData]);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartY.current = e.clientY;
    resizeStartHeight.current = height;
  };

  const handleExecute = async () => {
    if (!input.trim() || isExecuting) return;

    const code = input.trim();
    
    // Handle special commands
    if (code === 'help') {
      setLines(prev => [...prev, 
        { type: 'input', content: code, timestamp: new Date() },
        { type: 'info', content: HELP_TEXT, timestamp: new Date() }
      ]);
      setInput('');
      setHistory(prev => [...prev, code]);
      return;
    }

    if (code === 'clear') {
      setLines(WELCOME_MESSAGES.map(msg => ({ ...msg, timestamp: new Date() })));
      setInput('');
      setHistory(prev => [...prev, code]);
      return;
    }

    if (code === 'history') {
      const historyText = history.length === 0 
        ? 'No command history' 
        : history.map((cmd, i) => `  ${i + 1}. ${cmd}`).join('\n');
      setLines(prev => [...prev,
        { type: 'input', content: code, timestamp: new Date() },
        { type: 'info', content: historyText, timestamp: new Date() }
      ]);
      setInput('');
      setHistory(prev => [...prev, code]);
      return;
    }

    if (code === 'exit') {
      onClose();
      return;
    }
    
    // Add input to lines
    setLines(prev => [...prev, {
      type: 'input',
      content: code,
      timestamp: new Date()
    }]);

    // Add to history
    setHistory(prev => [...prev, code]);
    setHistoryIndex(-1);
    setInput('');
    setIsExecuting(true);

    try {
      const response = await apiService.execPluginCode(code);

      if (response.error) {
        setLines(prev => [...prev, {
          type: 'error',
          content: `❌ ${response.error.message || 'Execution failed'}`,
          timestamp: new Date()
        }]);
      } else if (response.data) {
        // Add output lines (from print())
        if (response.data.output && response.data.output.length > 0) {
          response.data.output.forEach(line => {
            setLines(prev => [...prev, {
              type: 'output',
              content: line,
              timestamp: new Date()
            }]);
          });
        }

        // Add result if exists
        if (response.data.result !== undefined && response.data.result !== null) {
          const resultStr = typeof response.data.result === 'object'
            ? JSON.stringify(response.data.result, null, 2)
            : String(response.data.result);
          
          setLines(prev => [...prev, {
            type: 'success',
            content: `✓ ${resultStr}`,
            timestamp: new Date()
          }]);
        }

        // If no output and no result, show success
        if ((!response.data.output || response.data.output.length === 0) && 
            (response.data.result === undefined || response.data.result === null)) {
          setLines(prev => [...prev, {
            type: 'success',
            content: '✓ nil',
            timestamp: new Date()
          }]);
        }
      }
    } catch (error) {
      setLines(prev => [...prev, {
        type: 'error',
        content: `❌ ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      }]);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle suggestions navigation
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
          
          // Check if it's a snippet
          const snippet = autocompleteData?.snippets.find(s => 
            suggestion.startsWith(s.label + ' →')
          );
          
          if (snippet) {
            setInput(snippet.insert);
          } else {
            // Replace last word with suggestion
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
    } else if (e.key === 'ArrowUp' && !showSuggestions) {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      }
    } else if (e.key === 'ArrowDown' && !showSuggestions) {
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
      setLines([{
        type: 'output',
        content: 'Terminal cleared',
        timestamp: new Date()
      }]);
    }
  };

  const handleClear = () => {
    setLines(WELCOME_MESSAGES.map(msg => ({ ...msg, timestamp: new Date() })));
  };

  const copyToClipboard = (content: string, index: number) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedIndex(index);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 bg-zinc-950 border-t border-zinc-800 shadow-2xl transition-all duration-300",
        isCollapsed ? "h-12" : ""
      )}
      style={!isCollapsed ? { height: `${height}px` } : undefined}
    >
      {/* Resize Handle */}
      {!isCollapsed && (
        <div
          onMouseDown={startResize}
          className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize hover:bg-emerald-500/50 transition-colors group"
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-zinc-700 rounded-b group-hover:bg-emerald-500 transition-colors" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-bold text-zinc-100 font-mono uppercase tracking-wider">
              Lua REPL
            </span>
          </div>
          <div className="h-4 w-px bg-zinc-700" />
          <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-mono">
            <span>{lines.length} lines</span>
            <span>•</span>
            <span>{history.length} commands</span>
          </div>
          {autocompleteData && (
            <>
              <div className="h-4 w-px bg-zinc-700" />
              <span className="text-[10px] text-emerald-500 font-mono flex items-center gap-1.5">
                <Lightbulb className="h-3 w-3" />
                Autocomplete Active
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowTimestamps(!showTimestamps)}
            className={cn(
              "h-7 w-7 hover:bg-zinc-800",
              showTimestamps ? "text-emerald-400" : "text-zinc-500 hover:text-zinc-300"
            )}
            title="Toggle Timestamps"
          >
            <Clock className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClear}
            className="h-7 w-7 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            title="Clear Terminal (Ctrl+L)"
          >
            <span className="text-[10px] font-mono font-bold">CLR</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-7 w-7 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            title={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-7 w-7 text-zinc-500 hover:text-red-400 hover:bg-zinc-800"
            title="Close Terminal"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Terminal Content */}
      {!isCollapsed && (
        <>
          <div
            ref={scrollRef}
            className="overflow-y-auto p-4 font-mono text-xs leading-relaxed"
            style={{ height: `calc(${height}px - 8rem)` }}
          >
            {lines.map((line, idx) => (
              <div
                key={idx}
                className={cn(
                  "mb-2 group relative hover:bg-zinc-900/50 rounded px-2 py-1 transition-colors",
                  line.type === 'input' && "border-l-2 border-emerald-500 pl-3",
                  line.type === 'error' && "border-l-2 border-red-500 pl-3 bg-red-950/20",
                  line.type === 'success' && "border-l-2 border-emerald-500 pl-3",
                  line.type === 'info' && "border-l-2 border-blue-500 pl-3"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 whitespace-pre-wrap break-all">
                    {showTimestamps && (
                      <span className="text-zinc-600 text-[9px] mr-2">
                        [{line.timestamp.toLocaleTimeString()}]
                      </span>
                    )}
                    {line.type === 'input' && (
                      <span className="text-emerald-400 font-bold mr-2">{'>'}</span>
                    )}
                    <span className={cn(
                      line.type === 'input' && "text-emerald-300 font-medium",
                      line.type === 'output' && "text-zinc-300",
                      line.type === 'error' && "text-red-300",
                      line.type === 'success' && "text-emerald-300",
                      line.type === 'info' && "text-blue-300"
                    )}>
                      {line.content}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(line.content, idx)}
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  >
                    {copiedIndex === idx ? (
                      <Check className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <Copy className="h-3 w-3 text-zinc-500" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
            {isExecuting && (
              <div className="text-zinc-500 animate-pulse flex items-center gap-2 px-2">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span>Executing...</span>
              </div>
            )}
          </div>

          {/* Suggestions */}
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="absolute bottom-20 left-4 right-4 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
              {filteredSuggestions.map((suggestion, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "px-3 py-2 text-xs font-mono cursor-pointer transition-colors",
                    idx === selectedSuggestion
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "text-zinc-400 hover:bg-zinc-800"
                  )}
                  onClick={() => {
                    const snippet = autocompleteData?.snippets.find(s => 
                      suggestion.startsWith(s.label + ' →')
                    );
                    
                    if (snippet) {
                      setInput(snippet.insert);
                    } else {
                      const words = input.split(/\s+/);
                      words[words.length - 1] = suggestion;
                      setInput(words.join(' '));
                    }
                    
                    setShowSuggestions(false);
                  }}
                >
                  {suggestion}
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-zinc-900 border-t border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="text-emerald-500 font-mono text-sm shrink-0">{'>'}</span>
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter Lua code... (↑↓ for history, Tab for autocomplete, Ctrl+L to clear)"
                disabled={isExecuting}
                className="flex-1 bg-zinc-950 border-zinc-800 text-zinc-300 font-mono text-xs focus:border-emerald-500/50 focus:ring-emerald-500/20"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
