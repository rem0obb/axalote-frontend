import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { apiService } from '@/services/api.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Editor from '@monaco-editor/react';
import { useTheme } from '@/components/providers/ThemeProvider';
import { cn } from '@/lib/utils';
import { defineMonacoThemes, AXALOTE_DARK_THEME_NAME, AXALOTE_LIGHT_THEME_NAME } from '@/lib/monaco-theme';
import { Trash2, Loader2, Play, LayoutList, Terminal, Code2, Puzzle, Pencil } from 'lucide-react';

const SAMPLE_PLUGIN = `-- ────────────────────────────────────── ─────────────────── ────────────────────
--Plugins: file-analyzer
-- Upon receiving a file (auto_exec), performs a complete analysis:
-- 1. Parsing the header (PE/ELF/etc.)
-- 2. Extracting strings and IOCs
-- 3. Querying VirusTotal
-- 4. Storing the result locally for later querying
--
-- Endpoints registered in /axalote/plugins/file-analyzer/
-- GET /report/:sha256 → returns a complete analysis
-- GET /reports → lists all reports
-- DELETE /report/:sha256 → removes the report
-- ─────────────────────────────────────────────────────────────────────────────

local reports = {}   -- in-memory storage: { [sha256] = report }

-- ─── Helpers ──────────────────────────────────────────────────────────────────

local function analyze(file_info, cov)
    local sha256 = file_info.sha256
    local report = {
        sha256      = sha256,
        filename    = file_info.filename,
        file_type   = file_info.type,
        dropped     = file_info.dropped,
        analyzed_at = os.time(),
        parse       = nil,
        strings     = nil,
        iocs        = nil,
        vt          = nil,
        verdict     = "unknown",
    }

    -- 1. Parse the file header
    local parsed, _ = cov:execute(cov.actions.SCANNER.PARSE_FILE, { sha256 = sha256 })
    if parsed and parsed.success then
        report.parse = parsed.parsed
        report.file_type = parsed.file_type or report.file_type
    end

    -- 2. Strings and IOCs (executed synchronously via flag)
    local strings_result
    cov:execute(cov.actions.SCANNER.SCAN_STRINGS, {
        sha256 = sha256,
        fn = function(res) strings_result = res end,
    })
    if strings_result then
        report.iocs = strings_result.iocs
        local top = {}
        for i = 1, math.min(100, #(strings_result.strings or {})) do
            top[i] = strings_result.strings[i]
        end
        report.strings = top
    end

    -- 3. VirusTotal (read-only — no upload)
    local vt_res, _ = cov:execute(cov.actions.VT.GET_FILE_REPORT, { hash = sha256 })
    if vt_res and vt_res.data then
        local d = vt_res.data
        local stats = d.attributes and d.attributes.last_analysis_stats or {}
        report.vt = {
            malicious   = stats.malicious   or 0,
            suspicious  = stats.suspicious  or 0,
            undetected  = stats.undetected  or 0,
            harmless    = stats.harmless    or 0,
            name        = d.attributes and d.attributes.meaningful_name,
        }
    elseif vt_res and vt_res.err then
        report.vt = { error = vt_res.err }
    end

    -- 4. Simple verdict based on the data collected.
    local malicious = report.vt and (report.vt.malicious or 0) or 0
    if malicious >= 10 then
        report.verdict = "malicious"
    elseif malicious >= 3 then
        report.verdict = "suspicious"
    elseif malicious == 0 and report.vt then
        report.verdict = "clean"
    end

    print("Analyzed " .. sha256 .. " → verdict: " .. report.verdict)
    return report
end

-- ─── Plugin table ─────────────────────────────────────────────────────────────

return {
    name        = "file-analyzer",
    version     = "1.0.0",
    description = "Full auto-analysis on upload: parse + strings + VirusTotal",
    auto_exec   = true,

    -- Hook: Called automatically when a file is uploaded.
    on_upload = function(file_info, cov)
        local report = analyze(file_info, cov)
        reports[file_info.sha256] = report
        return { verdict = report.verdict, sha256 = report.sha256 }
    end,

    --── REST endpoints ─────────────────────────── ────────────────────────────
    setup = function(cov, router)
        -- GET /axalote/plugins/file-analyzer/report/:sha256
        router:get("/report/:sha256", function(req)
            local sha256 = req.params.sha256
            local report = reports[sha256]
            if not report then
                return req.res:json({ 
                    success = false, 
                    message = "Report not found: " .. sha256 
                }, 404)
            end
            return req.res:json({ success = true, report = report })
        end)

        -- GET /axalote/plugins/file-analyzer/reports
        router:get("/reports", function(req)
            local list = {}
            for _, r in pairs(reports) do
                table.insert(list, {
                    sha256       = r.sha256,
                    filename     = r.filename,
                    file_type    = r.file_type,
                    verdict      = r.verdict,
                    analyzed_at  = r.analyzed_at,
                    vt_malicious = r.vt and r.vt.malicious or nil,
                })
            end
            table.sort(list, function(a, b) 
                return a.analyzed_at > b.analyzed_at 
            end)
            return req.res:json({ 
                success = true, 
                reports = list, 
                total = #list 
            })
        end)

        -- DELETE /axalote/plugins/file-analyzer/report/:sha256
        router:delete("/report/:sha256", function(req)
            local sha256 = req.params.sha256
            if not reports[sha256] then
                return req.res:json({ 
                    success = false, 
                    message = "Report not found: " .. sha256 
                }, 404)
            end
            reports[sha256] = nil
            return req.res:json({ success = true, sha256 = sha256 })
        end)

        -- POST /axalote/plugins/file-analyzer/analyze/:sha256
        router:post("/analyze/:sha256", function(req)
            local sha256 = req.params.sha256
            local record, _ = cov:execute(cov.actions.SCANNER.DOWNLOAD_FILE, sha256)
            if not record then
                return req.res:json({ 
                    success = false, 
                    message = "File not found: " .. sha256 
                }, 404)
            end
            
            local file_info = {
                sha256   = sha256,
                filename = record.filename,
                type     = record.metadata and record.metadata.type,
                dropped  = {},
            }
            
            local report = analyze(file_info, cov)
            reports[sha256] = report
            return req.res:json({ success = true, report = report })
        end)
    end,
}`;

const CACHE_KEY = 'plugin_manager_state';
const PLUGIN_ORDER_KEY = 'plugin_manager_order';

export default function PluginManagerView() {
  const [plugins, setPlugins] = useState<string[]>([]);
  const [pluginOrder, setPluginOrder] = useState<string[]>([]);
  const [draggedPlugin, setDraggedPlugin] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pausing, setPausing] = useState<string | null>(null);
  const [resuming, setResuming] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [pluginNameInput, setPluginNameInput] = useState('');
  const [code, setCode] = useState(SAMPLE_PLUGIN);
  const [editingPlugin, setEditingPlugin] = useState<string | null>(null);
  const [autocompleteData, setAutocompleteData] = useState<any>(null);
  const { theme } = useTheme();
  const editorRef = useRef<any>(null);
  
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => {
    if (theme === 'system') {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? 'dark' : 'light';
    }
    return theme;
  });

  // Theme resolution effect
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

  // Load cached state
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const state = JSON.parse(cached);
        if (state.name) setName(state.name);
        if (state.code) setCode(state.code);
      }
      
      // Load plugin order
      const savedOrder = localStorage.getItem(PLUGIN_ORDER_KEY);
      if (savedOrder) {
        setPluginOrder(JSON.parse(savedOrder));
      }
    } catch (error) {
      console.error('Failed to load cached plugin state:', error);
    }
  }, []);

  // Save state to cache
  useEffect(() => {
    try {
      const state = { name, code, timestamp: Date.now() };
      localStorage.setItem(CACHE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to cache plugin state:', error);
    }
  }, [name, code]);

  // Sync plugin order when plugins change
  useEffect(() => {
    setPluginOrder(prev => {
      const newOrder = plugins.filter(p => prev.includes(p));
      const newPlugins = plugins.filter(p => !newOrder.includes(p));
      return [...newOrder, ...newPlugins];
    });
  }, [plugins]);

  const refreshPlugins = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiService.listPlugins();
      if (response.error) {
        toast.error('Could not list plugins');
        setPlugins([]);
        return;
      }
      const pluginsList = response.data?.plugins;
      if (Array.isArray(pluginsList)) {
        // Handle both string[] and object[] formats
        const normalizedPlugins = pluginsList.map(plugin => {
          if (typeof plugin === 'string') {
            return plugin;
          } else if (typeof plugin === 'object' && plugin !== null) {
            // If plugin is an object, extract the name
            return plugin.name || String(plugin);
          }
          return String(plugin);
        });
        setPlugins(normalizedPlugins);
      } else {
        setPlugins([]);
      }
    } catch (error) {
      console.error('Error loading plugins:', error);
      setPlugins([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshPlugins();
    
    // Load autocomplete data
    apiService.getPluginAutocomplete().then(response => {
      if (response.data?.success && response.data.data?.exec) {
        setAutocompleteData(response.data.data.exec);
      }
    });
  }, [refreshPlugins]);

  // Register autocomplete when data is loaded and editor is ready
  useEffect(() => {
    if (autocompleteData && editorRef.current) {
      const monaco = (window as any).monaco;
      if (monaco) {
        registerLuaAutocomplete(monaco);
      }
    }
  }, [autocompleteData]);

  const handleEditorWillMount = (monaco: any) => {
    defineMonacoThemes(monaco);
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    
    // Register Lua autocomplete when data is available
    if (autocompleteData) {
      registerLuaAutocomplete(monaco);
    }
  };

  const registerLuaAutocomplete = (monaco: any) => {
    // Dispose previous provider if exists
    monaco.languages.registerCompletionItemProvider('lua', {
      provideCompletionItems: (model: any, position: any) => {
        const suggestions: any[] = [];
        
        // Add globals
        if (autocompleteData.globals) {
          autocompleteData.globals.forEach((g: string) => {
            suggestions.push({
              label: g,
              kind: monaco.languages.CompletionItemKind.Variable,
              insertText: g,
              documentation: `Global: ${g}`,
              detail: 'Lua global'
            });
          });
        }
        
        // Add cov.actions suggestions
        if (autocompleteData.actions) {
          const addActions = (obj: any, prefix: string = 'cov.actions') => {
            Object.keys(obj).forEach(key => {
              const fullPath = `${prefix}.${key}`;
              if (typeof obj[key] === 'object' && key !== '...') {
                // Nested action
                suggestions.push({
                  label: fullPath,
                  kind: monaco.languages.CompletionItemKind.Module,
                  insertText: fullPath,
                  documentation: `Action module: ${fullPath}`,
                  detail: 'Action module'
                });
                addActions(obj[key], fullPath);
              } else {
                // Action endpoint
                suggestions.push({
                  label: fullPath,
                  kind: monaco.languages.CompletionItemKind.Function,
                  insertText: fullPath,
                  documentation: `Action: ${obj[key]}`,
                  detail: 'Engine action'
                });
              }
            });
          };
          addActions(autocompleteData.actions);
        }
        
        // Add snippets
        if (autocompleteData.snippets) {
          autocompleteData.snippets.forEach((s: any) => {
            suggestions.push({
              label: s.label,
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: s.insert,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: s.detail,
              detail: 'Snippet'
            });
          });
        }
        
        // Add plugin-specific snippets
        suggestions.push({
          label: 'plugin-template',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            'M = {}',
            '',
            'M.name        = "${1:plugin-name}"',
            'M.version     = "${2:1.0.0}"',
            'M.description = "${3:Plugin description}"',
            '',
            'function M.setup(cov, router)',
            '    router:get("/${4:path}", function(req)',
            '        return req.res:json({ success = true, message = "${5:response}" })',
            '    end)',
            'end',
            '',
            'return M'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Complete plugin template',
          detail: 'Plugin template'
        });
        
        suggestions.push({
          label: 'router:get',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            'router:get("/${1:path}", function(req)',
            '    ${2:-- handler code}',
            '    return req.res:json({ success = true })',
            'end)'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'GET route handler',
          detail: 'Route snippet'
        });
        
        suggestions.push({
          label: 'router:post',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: [
            'router:post("/${1:path}", function(req)',
            '    local body = req.body',
            '    ${2:-- handler code}',
            '    return req.res:json({ success = true })',
            'end)'
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'POST route handler',
          detail: 'Route snippet'
        });
        
        suggestions.push({
          label: 'cov:execute',
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: 'cov:execute(cov.actions.${1:ACTION}, ${2:{}})',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: 'Execute engine action',
          detail: 'Engine call'
        });
        
        return { suggestions };
      }
    });
  };

  const handleSave = async () => {
    if (!code.trim()) {
      toast.error('Code is required');
      return;
    }
    
    // If editing, use the plugin name being edited
    let pluginName = editingPlugin;
    
    // If not editing, use the typed name or extract from code
    if (!pluginName) {
      // If the user typed a name, use it
      if (pluginNameInput.trim()) {
        pluginName = pluginNameInput.trim();
      } else {
        // Otherwise, extract the name from code (M.name = "...")
        const nameMatch = code.match(/M\.name\s*=\s*["']([^"']+)["']/);
        if (!nameMatch) {
          toast.error('Plugin name not found in code (M.name = "...")');
          return;
        }
        pluginName = nameMatch[1];
      }
    }
    
    setSaving(true);
    try {
      let response;
      
      // If editing an existing plugin, use PUT
      if (editingPlugin) {
        response = await apiService.updatePlugin(pluginName, code.trim());
        if (response.error) {
          toast.error(response.error.message || 'Failed to update plugin');
        } else {
          toast.success(`Plugin "${pluginName}" updated successfully (hot-reload)`);
          setEditingPlugin(null);
          setName('');
          setPluginNameInput('');
          setCode(SAMPLE_PLUGIN);
          localStorage.removeItem(CACHE_KEY);
          await refreshPlugins();
        }
      } else {
        // Otherwise, create a new plugin with POST
        response = await apiService.loadPlugin({ name: pluginName, code: code.trim() });
        if (response.error) {
          toast.error(response.error.message || 'Failed to load plugin');
        } else {
          toast.success(`Plugin "${pluginName}" loaded successfully`);
          setName('');
          setPluginNameInput('');
          setCode(SAMPLE_PLUGIN);
          localStorage.removeItem(CACHE_KEY);
          await refreshPlugins();
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (pluginName: string) => {
    setDeleting(pluginName);
    try {
      const response = await apiService.deletePlugin(pluginName);
      if (response.error) {
        toast.error(response.error.message || 'Error removing plugin');
      } else {
        toast.success(`${pluginName} removed`);
        // If this plugin was being edited, clear the editor
        if (editingPlugin === pluginName) {
          setEditingPlugin(null);
          setName('');
          setPluginNameInput('');
          setCode(SAMPLE_PLUGIN);
          localStorage.removeItem(CACHE_KEY);
        }
        await refreshPlugins();
      }
    } finally {
      setDeleting(null);
    }
  };

  const handleEditPlugin = async (pluginName: string) => {
    setEditingPlugin(pluginName);
    setName(pluginName);
    setPluginNameInput('');
    
    // Show loading
    toast.info(`Loading code for "${pluginName}"...`);
    
    try {
      const response = await apiService.getPlugin(pluginName);
      
      if (response.error || !response.data) {
        toast.error(response.error?.message || 'Failed to load plugin code');
        setEditingPlugin(null);
        setName('');
        setPluginNameInput('');
        return;
      }
      
      if (response.data.success && response.data.code) {
        setCode(response.data.code);
        toast.success(`Plugin "${pluginName}" loaded in editor`);
        
        // Focus the editor
        if (editorRef.current) {
          editorRef.current.focus();
        }
      } else {
        toast.error('Plugin code not found in response');
        setEditingPlugin(null);
        setName('');
        setPluginNameInput('');
      }
    } catch (error) {
      console.error('Error loading plugin:', error);
      toast.error('Error loading plugin');
      setEditingPlugin(null);
      setName('');
      setPluginNameInput('');
    }
  };

  const handlePausePlugin = async (pluginName: string) => {
    setPausing(pluginName);
    try {
      const response = await apiService.pausePlugin(pluginName);
      
      if (response.error) {
        toast.error(response.error.message || 'Failed to pause plugin');
      } else if (response.data?.success) {
        toast.success(`Plugin "${pluginName}" paused`);
        await refreshPlugins();
      } else {
        toast.error(response.data?.message || 'Failed to pause plugin');
      }
    } finally {
      setPausing(null);
    }
  };

  const handleResumePlugin = async (pluginName: string) => {
    setResuming(pluginName);
    try {
      const response = await apiService.resumePlugin(pluginName);
      
      if (response.error) {
        toast.error(response.error.message || 'Failed to resume plugin');
      } else if (response.data?.success) {
        toast.success(`Plugin "${pluginName}" resumed`);
        await refreshPlugins();
      } else {
        toast.error(response.data?.message || 'Failed to resume plugin');
      }
    } finally {
      setResuming(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingPlugin(null);
    setName('');
    setPluginNameInput('');
    setCode(SAMPLE_PLUGIN);
    localStorage.removeItem(CACHE_KEY);
    toast.info('Edit cancelled');
  };

  const clearWorkspace = () => {
    setName('');
    setPluginNameInput('');
    setCode(SAMPLE_PLUGIN);
    localStorage.removeItem(CACHE_KEY);
    toast.success('Workspace cleared');
  };

  // Simple outline for Lua functions
  const outline = useMemo(() => {
    const lines = code.split('\n');
    const nodes: any[] = [];

    lines.forEach((line, i) => {
      const trimmed = line.trim();
      const funcMatch = trimmed.match(/function\s+([a-zA-Z0-9_]+)/);
      if (funcMatch) {
        nodes.push({ name: funcMatch[1], line: i + 1, type: 'function' });
      }
    });
    return nodes;
  }, [code]);

  const scrollToLine = (lineNumber: number) => {
    if (editorRef.current) {
      editorRef.current.revealLineInCenter(lineNumber);
      editorRef.current.setPosition({ lineNumber, column: 1 });
      editorRef.current.focus();
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, plugin: string) => {
    setDraggedPlugin(plugin);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetPlugin: string) => {
    e.preventDefault();
    if (!draggedPlugin || draggedPlugin === targetPlugin) {
      setDraggedPlugin(null);
      return;
    }

    const newOrder = [...pluginOrder];
    const draggedIndex = newOrder.indexOf(draggedPlugin);
    const targetIndex = newOrder.indexOf(targetPlugin);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedPlugin(null);
      return;
    }

    // Remove dragged item and insert at target position
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedPlugin);

    setPluginOrder(newOrder);
    
    // Save to localStorage
    try {
      localStorage.setItem(PLUGIN_ORDER_KEY, JSON.stringify(newOrder));
    } catch (error) {
      console.error('Failed to save plugin order:', error);
    }

    setDraggedPlugin(null);
  };

  const handleDragEnd = () => {
    setDraggedPlugin(null);
  };

  // Get sorted plugins
  const sortedPlugins = pluginOrder.length > 0 
    ? pluginOrder.filter(p => plugins.includes(p))
    : plugins;

  return (
    <div className="h-full flex flex-col p-4 space-y-4 overflow-hidden animate-in fade-in duration-500 bg-background text-foreground">
      {/* Action Bar */}
      <div className="shrink-0 flex items-center justify-between gap-4 bg-card border border-border-subtle rounded-xl p-3">
        <div className="flex items-center gap-6 px-4 py-2 bg-background-secondary/50 rounded-lg border border-border-subtle/50">
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-black uppercase tracking-widest text-foreground-muted">Status</span>
            <span className={cn("text-xs font-bold uppercase", saving ? "text-primary animate-pulse" : "text-foreground-muted")}>
              {saving ? "Saving..." : editingPlugin ? "Editing" : "Ready"}
            </span>
          </div>
          <div className="w-px h-6 bg-border-subtle" />
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-black uppercase tracking-widest text-foreground-muted">Active</span>
            <span className="text-xs font-bold text-foreground">
              {plugins.length}
            </span>
          </div>
          {editingPlugin && (
            <>
              <div className="w-px h-6 bg-border-subtle" />
              <div className="flex flex-col items-center">
                <span className="text-[9px] font-black uppercase tracking-widest text-orange-400">Editing</span>
                <span className="text-xs font-bold text-orange-400 font-mono">
                  {editingPlugin}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {editingPlugin && (
            <Button
              onClick={handleCancelEdit}
              variant="ghost"
              size="sm"
              className="h-10 px-4 text-foreground-muted hover:text-foreground"
            >
              Cancel
            </Button>
          )}
          <div className="flex items-center gap-2">
            {!editingPlugin && (
              <Input
                value={pluginNameInput}
                onChange={(e) => setPluginNameInput(e.target.value)}
                placeholder="plugin-name"
                className="font-mono text-sm h-10 w-40"
              />
            )}
            <Button
              onClick={clearWorkspace}
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
              title="Clear Workspace"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="w-px h-6 bg-border-subtle/30 mx-1" />
          <Button
            onClick={handleSave}
            disabled={saving || loading}
            className="gap-2 h-10 px-6"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            <span className="font-bold uppercase tracking-widest text-[11px]">
              {editingPlugin ? 'Update' : 'Load'}
            </span>
          </Button>
        </div>
      </div>

      {/* Main Content - Three Columns */}
      <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
        {/* Left Sidebar - Outline */}
        <aside className="w-56 bg-card border border-border-subtle rounded-xl flex flex-col overflow-hidden shrink-0">
          <div className="p-3 border-b border-border-subtle bg-background-secondary/30 flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-foreground-muted flex items-center gap-2">
              <LayoutList className="h-3.5 w-3.5 text-primary" />
              Outline
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {outline.length > 0 ? (
              outline.map((node, idx) => (
                <button
                  key={idx}
                  onClick={() => scrollToLine(node.line)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-background-secondary transition-colors group text-left min-w-0"
                >
                  <Terminal size={14} className="text-primary shrink-0 opacity-70" />
                  <span className="text-xs font-bold text-foreground truncate font-mono">
                    {node.name}
                  </span>
                </button>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center opacity-20 text-center p-4">
                <Code2 size={32} className="mb-2" />
                <span className="text-[9px] font-black uppercase tracking-widest leading-tight">
                  No functions detected
                </span>
              </div>
            )}
          </div>
        </aside>

        {/* Center - Editor */}
        <div className="flex-1 min-w-0 bg-card border border-border-subtle rounded-xl overflow-hidden flex flex-col">
          <div className="p-3 border-b border-border-subtle bg-background-secondary/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-destructive/50" />
                <div className="h-3 w-3 rounded-full bg-warning/50" />
                <div className="h-3 w-3 rounded-full bg-success/50" />
              </div>
              <span className="text-xs font-mono text-foreground-muted ml-2">
                {name || 'plugin'}.lua
              </span>
            </div>
            <div className="flex items-center gap-2">
              {autocompleteData && (
                <span className="text-[9px] text-emerald-600 font-mono flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Autocomplete
                </span>
              )}
              <span className="text-[10px] text-foreground-muted/50">
                {code.split('\n').length} lines
              </span>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <Editor
              key={resolvedTheme}
              height="100%"
              language="lua"
              theme={resolvedTheme === 'light' ? AXALOTE_LIGHT_THEME_NAME : AXALOTE_DARK_THEME_NAME}
              value={code}
              onChange={(v) => setCode(v || '')}
              beforeMount={handleEditorWillMount}
              onMount={handleEditorDidMount}
              options={{
                fontSize: 13,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                minimap: { enabled: false },
                lineNumbers: 'on',
                glyphMargin: false,
                folding: true,
                lineDecorationsWidth: 10,
                lineNumbersMinChars: 3,
                renderLineHighlight: 'all',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 16, bottom: 16 },
                smoothScrolling: true,
                cursorBlinking: 'smooth',
                cursorSmoothCaretAnimation: 'on',
              }}
            />
          </div>
        </div>

        {/* Right Sidebar - Active Plugins */}
        <aside className="w-80 bg-card border border-border-subtle rounded-xl flex flex-col overflow-hidden shrink-0">
          <div className="p-3 border-b border-border-subtle bg-background-secondary/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Puzzle className="h-4 w-4 text-primary" />
              <h2 className="text-xs font-bold uppercase tracking-widest text-foreground-muted">Active Plugins</h2>
            </div>
            {plugins.length > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                {plugins.length}
              </span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 text-primary animate-spin mx-auto mb-2" />
                <p className="text-xs text-foreground-muted">Loading plugins...</p>
              </div>
            ) : plugins.length === 0 ? (
              <div className="text-center py-8">
                <Puzzle className="h-6 w-6 text-foreground-muted/30 mx-auto mb-2" />
                <p className="text-xs text-foreground-muted">No plugins loaded</p>
                <p className="text-[10px] text-foreground-muted/50 mt-1">Create and load a plugin</p>
              </div>
            ) : (
              sortedPlugins.map((plugin) => (
                <div
                  key={plugin}
                  draggable
                  onDragStart={(e) => handleDragStart(e, plugin)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, plugin)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "p-3 bg-background-secondary/50 border border-border-subtle rounded-lg hover:border-primary/30 transition-all group cursor-move",
                    draggedPlugin === plugin && "opacity-50 border-primary/50 bg-primary/5"
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="text-foreground-muted/40 hover:text-foreground-muted transition-colors shrink-0 cursor-grab active:cursor-grabbing">
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="9" cy="5" r="1.5" />
                          <circle cx="9" cy="12" r="1.5" />
                          <circle cx="9" cy="19" r="1.5" />
                          <circle cx="15" cy="5" r="1.5" />
                          <circle cx="15" cy="12" r="1.5" />
                          <circle cx="15" cy="19" r="1.5" />
                        </svg>
                      </div>
                      <Code2 className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-xs font-bold text-foreground truncate font-mono">
                        {plugin}
                      </span>
                      {editingPlugin === plugin && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 font-bold uppercase">
                          Editing
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditPlugin(plugin)}
                        disabled={!!editingPlugin}
                        className="h-7 w-7 p-0 text-primary/70 hover:text-primary hover:bg-primary/10"
                        title="Edit Plugin"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!!deleting}
                        onClick={() => handleDelete(plugin)}
                        className="h-7 w-7 p-0 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                      >
                        {deleting === plugin ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="text-[10px] font-mono text-foreground-muted/70 bg-background/50 px-2 py-1 rounded">
                    /axalote/plugins/{plugin}/...
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
