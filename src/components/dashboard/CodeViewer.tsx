import { useState, useEffect, useRef, useMemo } from 'react';
import { apiService } from '@/services/api.service';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertTriangle, Code2, Eye, FileCode, CheckCircle, Save, Terminal, LayoutList, Box, Braces as FunctionIcon, Variable as VariableIcon, Hash, ChevronRight, ChevronDown, Maximize2, Minimize2, X, Phone, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import Editor from '@monaco-editor/react';
import { HtmlPreview } from './HtmlPreview';
import { isVBScript } from '@/lib/vbs-detector';
import { saveToLabInput } from '@/lib/lab-storage';
import * as prettier from 'prettier';
import parserBabel from 'prettier/parser-babel';
import parserHtml from 'prettier/parser-html';
import { js as jsBeautify, html as htmlBeautify } from 'js-beautify';

import { defineMonacoThemes, AXALOTE_DARK_THEME_NAME, AXALOTE_LIGHT_THEME_NAME } from '@/lib/monaco-theme';
import { useTheme } from '@/components/providers/ThemeProvider';

interface CodeViewerProps {
    sha256: string;
    mimeType?: string;
    filename?: string;
}

export function CodeViewer({ sha256, mimeType, filename }: CodeViewerProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [codeContent, setCodeContent] = useState<string>('');
    const [viewMode, setViewMode] = useState<'code' | 'preview' | 'graph'>('code');
    const [isFullScreen, setIsFullScreen] = useState(false);
    const { theme } = useTheme();
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

    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['functions', 'variables', 'classes', 'calls', 'ids']));

    // Find References state
    const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
    const [references, setReferences] = useState<{ line: number; column: number; snippet: string }[]>([]);
    const [showReferences, setShowReferences] = useState(false);

    // Context menu state
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; symbol: string } | null>(null);

    const editorRef = useRef<any>(null);
    const navigate = useNavigate();

    // Determine language from mimeType or filename
    const language = useMemo(() => {
        const mime = (mimeType || '').toLowerCase();
        const fname = (filename || '').toLowerCase();

        if (mime.includes('javascript') || fname.endsWith('.js') || fname.endsWith('.mjs')) return 'javascript';
        if (mime.includes('html') || fname.endsWith('.html') || fname.endsWith('.htm')) return 'html';
        if (mime.includes('python') || fname.endsWith('.py')) return 'python';
        if (mime.includes('powershell') || fname.endsWith('.ps1')) return 'powershell';
        if (mime.includes('json') || fname.endsWith('.json')) return 'json';
        if (mime.includes('xml') || fname.endsWith('.xml') || fname.includes('androidmanifest')) return 'xml';
        if (mime.includes('asm') || fname.endsWith('.asm')) return 'custom-asm';

        // VBScript detection by extension
        if (fname.endsWith('.vbs') || fname.endsWith('.vbe')) return 'vbscript';

        // Auto-detect VBScript in plain/text files
        if ((mime.startsWith('text/plain') || mime === 'text/') && codeContent) {
            if (isVBScript(codeContent)) {
                return 'vbscript';
            }
        }

        // Explicitly exclude C/C++ or other compiled langs if they slip through, though FileDetails logic should hide them
        if (fname.endsWith('.c') || fname.endsWith('.cpp') || fname.endsWith('.h')) return 'plaintext';

        return 'plaintext';
    }, [mimeType, filename, codeContent]);

    // Parse Outline / Variables based on language
    const outline = useMemo(() => {
        if (!codeContent) return [];
        const lines = codeContent.split('\n');
        const nodes: { name: string, line: number, type: 'function' | 'variable' | 'class' | 'id' | 'call' }[] = [];

        lines.forEach((line, i) => {
            const trimmed = line.trim();
            if (!trimmed) return;

            if (language === 'javascript' || language === 'html') {
                // JS Functions
                const funcMatch = trimmed.match(/function\s+([a-zA-Z_$][\w$]*)/);
                if (funcMatch) nodes.push({ name: funcMatch[1], line: i + 1, type: 'function' });

                // JS Classes
                const classMatch = trimmed.match(/class\s+([a-zA-Z_$][\w$]*)/);
                if (classMatch) nodes.push({ name: classMatch[1], line: i + 1, type: 'class' });

                // JS Variables (const/let/var) - simplified
                const varMatch = trimmed.match(/(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=/);
                if (varMatch) nodes.push({ name: varMatch[1], line: i + 1, type: 'variable' });

                // HTML IDs (if in HTML mode)
                if (language === 'html') {
                    const idMatch = trimmed.match(/id=["']([^"']+)["']/);
                    if (idMatch) nodes.push({ name: `#${idMatch[1]}`, line: i + 1, type: 'id' });
                }
            }
            else if (language === 'python') {
                const defMatch = trimmed.match(/^def\s+([a-zA-Z_]\w*)/);
                if (defMatch) nodes.push({ name: defMatch[1], line: i + 1, type: 'function' });

                const classMatch = trimmed.match(/^class\s+([a-zA-Z_]\w*)/);
                if (classMatch) nodes.push({ name: classMatch[1], line: i + 1, type: 'class' });

                const varMatch = trimmed.match(/^([a-zA-Z_]\w*)\s*=/);
                if (varMatch) nodes.push({ name: varMatch[1], line: i + 1, type: 'variable' });
            }
            else if (language === 'powershell') {
                const funcMatch = trimmed.match(/function\s+([\w-]+)/i);
                if (funcMatch) nodes.push({ name: funcMatch[1], line: i + 1, type: 'function' });

                const varMatch = trimmed.match(/\$([a-zA-Z_]\w*)\s*=/);
                if (varMatch) nodes.push({ name: `$${varMatch[1]}`, line: i + 1, type: 'variable' });
            }
            else if (language === 'vbscript') {
                // Skip comments
                if (trimmed.startsWith("'")) return;

                // VBScript Functions and Subs
                const funcMatch = trimmed.match(/^(?:Public\s+|Private\s+)?(?:Function|Sub)\s+([a-zA-Z_]\w*)/i);
                if (funcMatch) {
                    nodes.push({ name: funcMatch[1], line: i + 1, type: 'function' });
                    return;
                }

                // VBScript Variables (Dim, Set, Const)
                const varMatch = trimmed.match(/^(?:Dim|Set|Const)\s+([a-zA-Z_]\w*)/i);
                if (varMatch) {
                    nodes.push({ name: varMatch[1], line: i + 1, type: 'variable' });
                    return;
                }

                // VBScript Classes
                const classMatch = trimmed.match(/^Class\s+([a-zA-Z_]\w*)/i);
                if (classMatch) {
                    nodes.push({ name: classMatch[1], line: i + 1, type: 'class' });
                    return;
                }

                // VBScript Function/Sub Calls
                const callMatch = trimmed.match(/^(?:Call\s+)?([a-zA-Z_]\w*)\s*\(/i);
                if (callMatch && !funcMatch) {
                    nodes.push({ name: callMatch[1], line: i + 1, type: 'call' });
                }
            }
            else if (language === 'custom-asm') {
                // Function Definitions
                // .function(export) void !MAIN()
                const funcDefMatch = trimmed.match(/\.function.*?\s+([!a-zA-Z0-9_]+)\(/);
                if (funcDefMatch) nodes.push({ name: funcDefMatch[1], line: i + 1, type: 'function' });

                // Function Calls
                // call DOWNLOADTEMPORARYFILE
                // call TWIZARDFORM->PROGRESSGAUGE
                const callMatch = trimmed.match(/^\s*call\s+([a-zA-Z0-9_>\-!]+)/);
                if (callMatch) nodes.push({ name: callMatch[1], line: i + 1, type: 'call' });

                // Global Variables
                // .global(import) TWIZARDFORM WIZARDFORM
                // .global TDOWNLOADWIZARDPAGE Global2
                if (trimmed.startsWith('.global')) {
                    const parts = trimmed.split(/\s+/);
                    if (parts.length >= 3) {
                        const varName = parts[parts.length - 1];
                        nodes.push({ name: varName, line: i + 1, type: 'variable' });
                    }
                }

                // Local Assignments (Variables)
                // assign Var1, Arg1
                const assignMatch = trimmed.match(/^\s*assign\s+([a-zA-Z0-9_]+),/);
                if (assignMatch) nodes.push({ name: assignMatch[1], line: i + 1, type: 'variable' });
            }
        });
        return nodes;
    }, [codeContent, language]);

    // Find all references to a symbol
    const findReferences = (symbol: string) => {
        if (!codeContent) return [];

        const lines = codeContent.split('\n');
        const refs: { line: number; column: number; snippet: string }[] = [];

        // Escape special regex characters
        const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapeRegex(symbol)}\\b`, 'g');

        lines.forEach((line, idx) => {
            let match;
            regex.lastIndex = 0; // Reset regex

            while ((match = regex.exec(line)) !== null) {
                refs.push({
                    line: idx + 1,
                    column: match.index,
                    snippet: line.trim()
                });
            }
        });

        return refs;
    };

    // Jump to a specific line in the editor
    const jumpToLine = (lineNumber: number) => {
        if (editorRef.current) {
            editorRef.current.revealLineInCenter(lineNumber);
            editorRef.current.setPosition({
                lineNumber,
                column: 1
            });
            editorRef.current.focus();
        }
    };

    // Handle sidebar item click
    const handleSymbolClick = (symbolName: string) => {
        // Only show references in full-screen mode
        if (!isFullScreen) return;

        setSelectedSymbol(symbolName);
        const refs = findReferences(symbolName);
        setReferences(refs);
        setShowReferences(true);
    };



    // Group outline by type
    const groupedOutline = useMemo(() => {
        const groups: Record<string, typeof outline> = {
            functions: [],
            calls: [],
            variables: [],
            classes: [],
            ids: []
        };

        outline.forEach(node => {
            if (node.type === 'function') groups.functions.push(node);
            else if (node.type === 'call') groups.calls.push(node);
            else if (node.type === 'variable') groups.variables.push(node);
            else if (node.type === 'class') groups.classes.push(node);
            else if (node.type === 'id') groups.ids.push(node);
        });

        return groups;
    }, [outline]);

    const toggleSection = (section: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(section)) {
                next.delete(section);
            } else {
                next.add(section);
            }
            return next;
        });
    };

    const scrollToLine = (lineNumber: number) => {
        if (editorRef.current) {
            editorRef.current.revealLineInCenter(lineNumber);
            editorRef.current.setPosition({ lineNumber, column: 1 });
            editorRef.current.focus();
        }
    };

    // Helper component for rendering variable items with send to lab button
    const VariableItem = ({ node }: { node: { name: string; line: number; type: string } }) => (
        <div className="group/item flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-background-secondary/80 transition-all">
            <button
                onClick={() => {
                    setSelectedSymbol(node.name);
                    const refs = findReferences(node.name);
                    setReferences(refs);
                    setShowReferences(true);
                }}
                className="flex-1 flex items-center gap-2 text-left min-w-0 cursor-pointer"
            >
                <span className="text-[11px] font-mono font-medium text-foreground-muted group-hover/item:text-foreground truncate">
                    {node.name}
                </span>
                <span className="ml-auto text-[9px] text-foreground-muted/30 font-mono">
                    :{node.line}
                </span>
            </button>
            <button
                onClick={() => {
                    const value = extractVariableValue(node.name, codeContent, language);

                    
                    if (value) {
                        saveToLabInput(value);
                        toast.success(`Sent value of "${node.name}" to Lab (${value.length} chars)`);
                        navigate('/lab');
                    } else {
                        toast.warning(`Could not find value for "${node.name}". Check console for details.`);
                    }
                }}
                className="opacity-0 group-hover/item:opacity-100 p-1 hover:bg-primary/20 rounded transition-all"
                title="Send value to Lab"
            >
                <Terminal size={10} className="text-primary" />
            </button>
        </div>
    );

    // Helper function to extract variable value from code
    const extractVariableValue = (variableName: string, code: string, lang: string): string | null => {
        const lines = code.split('\n');
        
        if (lang === 'javascript' || lang === 'html') {
            // Look for variable assignments: const/let/var name = value
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const match = line.match(new RegExp(`(?:const|let|var)\\s+${variableName}\\s*=\\s*(.+?)(?:;|$)`));
                if (match) {
                    let value = match[1].trim();
                    
                    // If value is a string literal, try to get the complete string (may span multiple lines)
                    if (value.startsWith('"') || value.startsWith("'") || value.startsWith('`')) {
                        const quote = value[0];
                        if (!value.endsWith(quote) || value.length === 1) {
                            // Multi-line string, collect until closing quote
                            let fullValue = value;
                            for (let j = i + 1; j < lines.length; j++) {
                                fullValue += '\n' + lines[j];
                                if (lines[j].includes(quote)) break;
                            }
                            value = fullValue;
                        }
                    }
                    

                    return value;
                }
            }
        } else if (lang === 'python') {
            // Look for: name = value
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const match = line.match(new RegExp(`^\\s*${variableName}\\s*=\\s*(.+?)(?:#|$)`));
                if (match) {
                    let value = match[1].trim();
                    
                    // Handle multi-line strings
                    if (value.startsWith('"""') || value.startsWith("'''")) {
                        const quote = value.substring(0, 3);
                        if (!value.endsWith(quote) || value.length === 3) {
                            let fullValue = value;
                            for (let j = i + 1; j < lines.length; j++) {
                                fullValue += '\n' + lines[j];
                                if (lines[j].includes(quote)) break;
                            }
                            value = fullValue;
                        }
                    }
                    

                    return value;
                }
            }
        } else if (lang === 'powershell') {
            // Look for: $name = value
            for (const line of lines) {
                const match = line.match(new RegExp(`\\$${variableName}\\s*=\\s*(.+?)(?:#|$)`, 'i'));
                if (match) {
                    const value = match[1].trim();

                    return value;
                }
            }
        } else if (lang === 'vbscript') {
            // Look for: Dim/Set/Const name = value
            for (const line of lines) {
                const match = line.match(new RegExp(`(?:Dim|Set|Const)\\s+${variableName}\\s*=\\s*(.+?)$`, 'i'));
                if (match) {
                    const value = match[1].trim();

                    return value;
                }
            }
        }
        
        console.warn(`Could not find variable ${variableName} in ${lang} code`);
        return null;
    };

    // Helper function to extract function at position
    const extractFunctionAtPosition = (lineNumber: number, code: string, lang: string): string | null => {
        const lines = code.split('\n');
        let startLine = -1;
        let endLine = -1;
        let braceCount = 0;
        let inFunction = false;

        if (lang === 'javascript' || lang === 'html') {
            // Find function start
            for (let i = lineNumber - 1; i >= 0; i--) {
                if (lines[i].match(/function\s+\w+\s*\(|const\s+\w+\s*=\s*\(.*\)\s*=>/)) {
                    startLine = i;
                    break;
                }
            }

            if (startLine === -1) return null;

            // Find function end by counting braces
            for (let i = startLine; i < lines.length; i++) {
                const line = lines[i];
                braceCount += (line.match(/{/g) || []).length;
                braceCount -= (line.match(/}/g) || []).length;
                
                if (braceCount === 0 && i > startLine) {
                    endLine = i;
                    break;
                }
            }

            if (endLine === -1) endLine = lines.length - 1;
            return lines.slice(startLine, endLine + 1).join('\n');

        } else if (lang === 'python') {
            // Find function start
            for (let i = lineNumber - 1; i >= 0; i--) {
                if (lines[i].match(/^def\s+\w+/)) {
                    startLine = i;
                    break;
                }
            }

            if (startLine === -1) return null;

            // Find function end by indentation
            const startIndent = lines[startLine].search(/\S/);
            for (let i = startLine + 1; i < lines.length; i++) {
                const line = lines[i];
                if (line.trim() === '') continue;
                const indent = line.search(/\S/);
                if (indent <= startIndent) {
                    endLine = i - 1;
                    break;
                }
            }

            if (endLine === -1) endLine = lines.length - 1;
            return lines.slice(startLine, endLine + 1).join('\n');

        } else if (lang === 'vbscript') {
            // Find function/sub start
            for (let i = lineNumber - 1; i >= 0; i--) {
                if (lines[i].match(/^(?:Public\s+|Private\s+)?(?:Function|Sub)\s+\w+/i)) {
                    startLine = i;
                    break;
                }
            }

            if (startLine === -1) return null;

            // Find End Function/Sub
            for (let i = startLine + 1; i < lines.length; i++) {
                if (lines[i].match(/^End\s+(?:Function|Sub)/i)) {
                    endLine = i;
                    break;
                }
            }

            if (endLine === -1) endLine = lines.length - 1;
            return lines.slice(startLine, endLine + 1).join('\n');
        }

        return null;
    };

    const handleSendToLab = () => {
        let contentToSend = codeContent;

        // Check for selection
        if (editorRef.current) {
            const selection = editorRef.current.getSelection();
            if (selection && !selection.isEmpty()) {
                const model = editorRef.current.getModel();
                contentToSend = model.getValueInRange(selection);
                toast.info("Sending selected code to Lab...");
            } else {
                toast.info("Sending full file content to Lab...");
            }
        }

        saveToLabInput(contentToSend);
        navigate('/lab');
    };

    // Deobfuscate JavaScript code using the engine
    const [isDeobfuscating, setIsDeobfuscating] = useState(false);
    const handleDeobfuscate = async () => {
        if (!editorRef.current) return;
        
        setIsDeobfuscating(true);
        try {
            toast.info('Deobfuscating code...');
            
            // Backend expects "js" as language
            const langToSend = language.toLowerCase() === 'javascript' ? 'js' : language.toLowerCase();
            const response = await apiService.deobfuscateFile(sha256, langToSend);
            
            if (response.error) {
                toast.error(response.error.message || 'Deobfuscation failed');
                return;
            }
            
            if (response.data?.result?.code) {
                const model = editorRef.current.getModel();
                if (model) {
                    model.setValue(response.data.result.code);
                    setCodeContent(response.data.result.code);
                    
                    const metadata = response.data.result.metadata;
                    if (metadata) {
                        toast.success(`Deobfuscated: ${metadata.changes} changes in ${metadata.iterations} iterations`);
                    } else {
                        toast.success('Code deobfuscated successfully');
                    }
                }
            } else {
                toast.error('No deobfuscated code returned');
            }
        } catch (error) {
            console.error('Deobfuscation error:', error);
            toast.error('Failed to deobfuscate code');
        } finally {
            setIsDeobfuscating(false);
        }
    };

    // Check if deobfuscation is supported for this file
    const isDeobfuscateSupported = useMemo(() => {
        if (!codeContent || codeContent.length === 0) return false;
        
        const lang = language.toLowerCase();
        const fname = (filename || '').toLowerCase();
        
        // Backend supports "js" - check if current file is JavaScript
        return (
            lang === 'javascript' || 
            lang === 'js' || 
            fname.endsWith('.js') || 
            fname.endsWith('.mjs') ||
            fname.endsWith('.cjs')
        );
    }, [language, filename, codeContent]);

    // Format code based on language - custom formatter for single-line code
    const handleFormatCode = async () => {
        if (!editorRef.current) return;

        try {
            toast.info('Formatting code...');
            
            const model = editorRef.current.getModel();
            if (!model) return;

            let formatted = codeContent;

            // Use appropriate formatter based on language
            if (language === 'javascript') {
                // Use Prettier for JavaScript
                try {
                    formatted = await prettier.format(formatted, {
                        parser: 'babel',
                        plugins: [parserBabel],
                        semi: true,
                        singleQuote: true,
                        tabWidth: 4,
                        printWidth: 100
                    });
                } catch (e) {
                    console.error('Prettier error, using fallback:', e);
                    formatted = jsBeautify(formatted, {
                        indent_size: 4,
                        space_in_empty_paren: false,
                        jslint_happy: false,
                        brace_style: 'collapse',
                        keep_array_indentation: false,
                        keep_function_indentation: false,
                        preserve_newlines: true,
                        max_preserve_newlines: 2,
                        break_chained_methods: false,
                        indent_scripts: 'normal',
                        comma_first: false,
                        e4x: false,
                        operator_position: 'before-newline'
                    });
                }

            } else if (language === 'xml') {
                // Use js-beautify for XML/HTML
                try {
                    formatted = htmlBeautify(formatted, {
                        indent_size: 4,
                        indent_char: ' ',
                        max_preserve_newlines: 2,
                        preserve_newlines: true,
                        keep_array_indentation: false,
                        break_chained_methods: false,
                        indent_scripts: 'normal',
                        brace_style: 'collapse',
                        space_before_conditional: true,
                        unescape_strings: false,
                        jslint_happy: false,
                        end_with_newline: false,
                        wrap_line_length: 0,
                        indent_inner_html: true,
                        comma_first: false,
                        e4x: true,
                        indent_empty_lines: false
                    });
                } catch (e) {
                    console.error('XML beautify error:', e);
                }

            } else if (language === 'html') {
                // Use Prettier for HTML
                try {
                    formatted = await prettier.format(formatted, {
                        parser: 'html',
                        plugins: [parserHtml],
                        tabWidth: 4,
                        printWidth: 100,
                        htmlWhitespaceSensitivity: 'ignore'
                    });
                } catch (e) {
                    console.error('Prettier HTML error:', e);
                }

            } else if (language === 'json') {
                // JSON formatter
                try {
                    const parsed = JSON.parse(formatted);
                    formatted = JSON.stringify(parsed, null, 4);
                } catch (e) {
                    toast.error('Invalid JSON');
                    return;
                }

            } else if (language === 'python') {
                // Python formatter - more sophisticated
                const lines = formatted.split(/\r?\n/);
                const formattedLines: string[] = [];
                let indentLevel = 0;
                let inMultilineString = false;
                let multilineStringChar = '';

                for (let i = 0; i < lines.length; i++) {
                    let line = lines[i].trim();
                    if (!line) continue;

                    // Handle multiline strings
                    if (!inMultilineString) {
                        if (line.includes('"""') || line.includes("'''")) {
                            const match = line.match(/"""|\'\'\'/);
                            if (match) {
                                multilineStringChar = match[0];
                                const count = (line.match(new RegExp(multilineStringChar, 'g')) || []).length;
                                if (count === 1) {
                                    inMultilineString = true;
                                }
                            }
                        }
                    } else {
                        if (line.includes(multilineStringChar)) {
                            inMultilineString = false;
                        }
                        formattedLines.push('    '.repeat(indentLevel) + line);
                        continue;
                    }

                    // Decrease indent for dedent keywords
                    if (line.match(/^(elif|else|except|finally|return|break|continue|pass)/)) {
                        indentLevel = Math.max(0, indentLevel - 1);
                    }

                    // Add line with current indent
                    formattedLines.push('    '.repeat(indentLevel) + line);

                    // Increase indent after colon (function, class, if, for, while, etc.)
                    if (line.endsWith(':') && !line.startsWith('#')) {
                        indentLevel++;
                    }

                    // Decrease indent after return, break, continue, pass (if not followed by more code)
                    if (line.match(/^(return|break|continue|pass)(\s|$)/) && i < lines.length - 1) {
                        const nextLine = lines[i + 1].trim();
                        if (nextLine && !nextLine.startsWith('#')) {
                            indentLevel = Math.max(0, indentLevel - 1);
                        }
                    }
                }

                formatted = formattedLines.join('\n');

            } else if (language === 'powershell') {
                // PowerShell formatter
                const lines = formatted.split(/\r?\n/);
                const formattedLines: string[] = [];
                let indentLevel = 0;
                let inHereString = false;

                for (const line of lines) {
                    let trimmed = line.trim();
                    if (!trimmed) continue;

                    // Handle here-strings
                    if (trimmed.includes('@"') || trimmed.includes("@'")) {
                        inHereString = true;
                    }
                    if (inHereString) {
                        formattedLines.push('    '.repeat(indentLevel) + trimmed);
                        if (trimmed.includes('"@') || trimmed.includes("'@")) {
                            inHereString = false;
                        }
                        continue;
                    }

                    // Decrease indent for closing braces
                    if (trimmed.startsWith('}')) {
                        indentLevel = Math.max(0, indentLevel - 1);
                    }

                    // Add line with current indent
                    formattedLines.push('    '.repeat(indentLevel) + trimmed);

                    // Increase indent after opening braces
                    if (trimmed.endsWith('{')) {
                        indentLevel++;
                    }

                    // Handle pipe operators - next line should be at same level
                    if (trimmed.endsWith('|')) {
                        // Keep same indent for next line
                    }
                }

                formatted = formattedLines.join('\n');

            } else if (language === 'vbscript') {
                // VBScript formatter
                const lines = formatted.split(/\r?\n/);
                const formattedLines: string[] = [];
                let indentLevel = 0;

                for (const line of lines) {
                    let trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith("'")) {
                        if (trimmed) formattedLines.push('    '.repeat(indentLevel) + trimmed);
                        continue;
                    }

                    // Decrease indent for End statements and Else
                    if (trimmed.match(/^End\s+(If|Function|Sub|Class|With|Select)/i) ||
                        trimmed.match(/^(Else|ElseIf|Case)/i)) {
                        indentLevel = Math.max(0, indentLevel - 1);
                    }

                    // Add line with current indent
                    formattedLines.push('    '.repeat(indentLevel) + trimmed);

                    // Increase indent after block starters
                    if (trimmed.match(/^(If|ElseIf).*Then$/i) ||
                        trimmed.match(/^(Function|Sub|Class|With|Select\s+Case|For|While|Do)\s+/i) ||
                        trimmed.match(/^Else$/i) ||
                        trimmed.match(/^Case\s+/i)) {
                        indentLevel++;
                    }

                    // Handle inline Then statements
                    if (trimmed.match(/Then\s+\w+/i) && !trimmed.match(/Then$/i)) {
                        // Split inline Then statement
                        const parts = trimmed.split(/\s+Then\s+/i);
                        if (parts.length === 2) {
                            formattedLines[formattedLines.length - 1] = '    '.repeat(indentLevel - 1) + parts[0] + ' Then';
                            formattedLines.push('    '.repeat(indentLevel) + parts[1]);
                        }
                    }
                }

                formatted = formattedLines.join('\n');

            } else if (language === 'plaintext') {
                // Try to detect if it's bash/shell script
                if (formatted.includes('#!/bin/bash') || formatted.includes('#!/bin/sh') || 
                    formatted.match(/\b(if|then|fi|for|do|done|while|case|esac)\b/)) {
                    // Bash formatter
                    const lines = formatted.split(/\r?\n/);
                    const formattedLines: string[] = [];
                    let indentLevel = 0;

                    for (const line of lines) {
                        let trimmed = line.trim();
                        if (!trimmed) continue;

                        // Keep shebang at start
                        if (trimmed.startsWith('#!')) {
                            formattedLines.push(trimmed);
                            continue;
                        }

                        // Decrease indent for closing keywords
                        if (trimmed.match(/^(fi|done|esac|\})/)) {
                            indentLevel = Math.max(0, indentLevel - 1);
                        }

                        // Add line with current indent
                        formattedLines.push('    '.repeat(indentLevel) + trimmed);

                        // Increase indent after opening keywords
                        if (trimmed.match(/^(if|then|else|elif|for|while|do|case|function.*\{|\{)/) ||
                            trimmed.endsWith('then') || trimmed.endsWith('do') || trimmed.endsWith('{')) {
                            indentLevel++;
                        }

                        // Handle else/elif - they should decrease then increase
                        if (trimmed.match(/^(else|elif)/)) {
                            indentLevel++;
                        }
                    }

                    formatted = formattedLines.join('\n');
                }
            }

            // Update editor content
            editorRef.current.updateOptions({ readOnly: false });
            model.setValue(formatted);
            setCodeContent(formatted);
            editorRef.current.updateOptions({ readOnly: true });
            
            toast.success('Code formatted successfully');
        } catch (err: any) {
            console.error('Format error:', err);
            toast.error(`Failed to format: ${err.message || 'Unknown error'}`);
            if (editorRef.current) {
                editorRef.current.updateOptions({ readOnly: true });
            }
        }
    };

    useEffect(() => {
        let mounted = true;

        const fetchData = async () => {
            if (!sha256) return;

            setLoading(true);
            setError(null);

            // Check Cache (check both localStorage and sessionStorage)
            const cacheKey = `axalote_cache_${sha256}`;
            const cachedData = sessionStorage.getItem(cacheKey) || localStorage.getItem(cacheKey);
            if (cachedData) {
                try {
                    const parsed = JSON.parse(cachedData);
                    // Cache expiry (e.g., 10 minutes)
                    if (Date.now() - parsed.timestamp < 10 * 60 * 1000) {
                        if (mounted) {
                            setCodeContent(parsed.content);
                            setLoading(false);
                            return;
                        }
                    }
                } catch (e) {
                    console.error("Cache parse error", e);
                    localStorage.removeItem(cacheKey);
                    sessionStorage.removeItem(cacheKey);
                }
            }

            try {
                const response = await apiService.downloadFile(sha256);

                if (!mounted) return;

                if (response.error || !response.data) {
                    throw new Error(response.error?.message || 'Failed to load file content');
                }

                const binaryString = window.atob(response.data.buff);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }

                const decoder = new TextDecoder('utf-8');
                const text = decoder.decode(bytes);

                if (mounted) {
                    setCodeContent(text);
                    setLoading(false);
                    // Save to Cache with Quota Handling
                    // Use sessionStorage for large files (> 500KB), localStorage for smaller ones
                    const useSessionStorage = text.length > 500 * 1024; // 500KB threshold
                    const storage = useSessionStorage ? sessionStorage : localStorage;
                    const cacheData = JSON.stringify({
                        content: text,
                        timestamp: Date.now()
                    });

                    try {
                        storage.setItem(cacheKey, cacheData);
                        // Clean up from the other storage if it exists
                        const otherStorage = useSessionStorage ? localStorage : sessionStorage;
                        otherStorage.removeItem(cacheKey);
                    } catch (e: any) {
                        // Handle QuotaExceededError
                        if (e.name === 'QuotaExceededError' || e.code === 22) {
                            console.warn("Storage quota exceeded. Clearing old axalote_cache entries.");
                            // Clear all axalote cache keys from both storages
                            [localStorage, sessionStorage].forEach(store => {
                                Object.keys(store).forEach(key => {
                                    if (key.startsWith('axalote_cache_')) {
                                        store.removeItem(key);
                                    }
                                });
                            });
                            // Retry saving to sessionStorage (larger quota)
                            try {
                                sessionStorage.setItem(cacheKey, cacheData);
                            } catch (retryErr) {
                                console.warn("Failed to cache file content even after clearing storage. Content will not be cached.");
                            }
                        }
                    }
                }
            } catch (err: any) {
                console.error("CodeViewer load error:", err);
                if (mounted) {
                    setError(err.message || 'Error loading data');
                    setLoading(false);
                }
            }
        };

        fetchData();

        return () => {
            mounted = false;
        };
    }, [sha256]);

    // Handle Escape key to exit full screen
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isFullScreen) {
                setIsFullScreen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isFullScreen]);

    const handleEditorWillMount = (monaco: any) => {
        // Define Custom Themes (Shared)
        defineMonacoThemes(monaco);

        // Register Custom ASM Language
        monaco.languages.register({ id: 'custom-asm' });

        monaco.languages.setMonarchTokensProvider('custom-asm', {
            ignoreCase: true,
            defaultToken: '',
            tokenPostfix: '.asm',

            keywords: [
                'pushtype', 'assign', 'call', 'ret', 'pushvar', 'pop',
                'ret', 'void', 'primitive', 'class', 'funcptr',
                'returnsval', '__in'
            ],

            typeKeywords: [
                'Pointer', 'U32', 'Variant', 'PChar', 'Currency', 'Extended', 'Double', 'Single', 'S64',
                'String', 'S32', 'S16', 'U16', 'S8', 'ANYMETHOD', 'UnicodeString', 'WideString',
                'WideChar', 'Char', 'U8', 'BOOLEAN', 'TWIZARDFORM', 'TUNINSTALLPROGRESSFORM',
                'TDOWNLOADWIZARDPAGE', 'TNEWPROGRESSBAR', 'TNEWRADIOBUTTON', 'TONDOWNLOADPROGRESS',
                'TSETUPMESSAGEID', 'TEXECWAIT'
            ],

            directives: [
                '.entry', '.type', '.global', '.function', 'import', 'export'
            ],

            operators: [
                '='
            ],

            // we include these common regular expressions
            symbols: /[=><!~?:&|+\-*\/\^%]+/,

            tokenizer: {
                root: [
                    // directives
                    [/^\.[a-zA-Z_]\w*/, 'keyword.directive'],

                    // identifiers and keywords
                    [/[a-zA-Z_]\w*/, {
                        cases: {
                            '@typeKeywords': 'type',
                            '@keywords': 'keyword',
                            '@directives': 'keyword.directive',
                            '@default': 'identifier'
                        }
                    }],

                    // whitespace
                    { include: '@whitespace' },

                    // delimiters and operators
                    [/[{}()\[\]]/, '@brackets'],
                    [/[<>](?!@symbols)/, '@brackets'],
                    [/@symbols/, {
                        cases: {
                            '@operators': 'operator',
                            '@default': ''
                        }
                    }],

                    // numbers
                    [/\d+/, 'number'],

                    // special
                    [/!MAIN/, 'type.identifier'],
                ],

                whitespace: [
                    [/[ \t\r\n]+/, 'white'],
                    [/;.*$/, 'comment'],
                ],
            },
        });
    };

    const handleEditorDidMount = async (editor: any, monaco: any) => {
        editorRef.current = editor;

        // Add context menu actions for sending to Lab
        editor.addAction({
            id: 'send-selection-to-lab',
            label: 'Send Selection to Lab',
            contextMenuGroupId: 'navigation',
            contextMenuOrder: 1.5,
            keybindings: [
                monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyL
            ],
            run: function(ed: any) {
                const selection = ed.getSelection();
                if (selection && !selection.isEmpty()) {
                    const model = ed.getModel();
                    const selectedText = model.getValueInRange(selection);
                    saveToLabInput(selectedText);
                    toast.success(`Sent ${selectedText.length} characters to Lab`);
                    navigate('/lab');
                } else {
                    toast.warning('No text selected');
                }
            }
        });

        // Add action to send variable value to Lab
        editor.addAction({
            id: 'send-variable-value-to-lab',
            label: 'Send Variable Value to Lab',
            contextMenuGroupId: 'navigation',
            contextMenuOrder: 1.6,
            run: function(ed: any) {
                const position = ed.getPosition();
                const model = ed.getModel();
                const word = model.getWordAtPosition(position);
                
                if (word) {
                    const variableName = word.word;

                    
                    // Try to find the variable value in the code
                    const value = extractVariableValue(variableName, codeContent, language);

                    
                    if (value) {
                        saveToLabInput(value);
                        toast.success(`Sent value of "${variableName}" to Lab (${value.length} chars)`);
                        navigate('/lab');
                    } else {
                        toast.warning(`Could not find value for variable "${variableName}". Check console for details.`);
                    }
                } else {
                    toast.warning('No variable under cursor');
                }
            }
        });

        // Add action to send entire function to Lab
        editor.addAction({
            id: 'send-function-to-lab',
            label: 'Send Function to Lab',
            contextMenuGroupId: 'navigation',
            contextMenuOrder: 1.7,
            run: function(ed: any) {
                const position = ed.getPosition();
                const functionCode = extractFunctionAtPosition(position.lineNumber, codeContent, language);
                
                if (functionCode) {
                    saveToLabInput(functionCode);
                    toast.success('Sent function to Lab');
                    navigate('/lab');
                } else {
                    toast.warning('No function found at cursor position');
                }
            }
        });

        // Auto-format on mount
        setTimeout(async () => {
            try {
                if (language === 'xml' || language === 'json' || language === 'javascript') {
                    await handleFormatCode();
                } else {
                    // Temporarily disable read-only to allow formatting
                    editor.updateOptions({ readOnly: false });
                    // Trigger Monaco's built-in format action
                    await editor.getAction('editor.action.formatDocument').run();
                    // Re-enable read-only
                    editor.updateOptions({ readOnly: true });
                }
            } catch (err) {
                console.error('Auto-format error:', err);
                // Ensure read-only is re-enabled even on error
                editor.updateOptions({ readOnly: true });
            }
        }, 500); // Small delay to ensure editor is fully ready
    };

    // removed handleFormat

    if (loading) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center space-y-4 p-8 bg-card border border-border-subtle rounded-lg">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <div className="text-center">
                    <h3 className="text-sm font-bold text-foreground">Loading Code</h3>
                    <p className="text-xs text-foreground-muted">Fetching content...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center p-8 bg-card border border-border-subtle rounded-lg">
                <AlertTriangle className="h-10 w-10 text-destructive mb-2 opacity-80" />
                <p className="text-sm text-foreground-muted mb-4">{error}</p>
                <Button variant="outline" size="sm" onClick={() => window.location.reload()}>Retry</Button>
            </div>
        );
    }

    return (
        <>
            {/* Full Screen Overlay */}
            {isFullScreen && (
                <div className="fixed inset-0 z-[9999] bg-background flex flex-col animate-in fade-in duration-300">
                    {/* Header */}
                    <div className="bg-background-secondary/40 border-b border-border-subtle px-6 py-3 flex items-center justify-between shrink-0 h-14">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Code2 className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                                <span className="text-sm font-bold text-foreground block leading-none">Code Inspector - Full Screen</span>
                                <span className="text-[10px] text-foreground-muted font-medium uppercase tracking-wider">
                                    Source Analysis: <span className="text-primary">{language.toUpperCase()}</span>
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* View Mode Toggle for ASM */}

                            {isDeobfuscateSupported && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 gap-2 bg-orange-500/10 border-orange-500/20 hover:bg-orange-500/20 text-orange-400 text-xs uppercase font-bold tracking-wider"
                                    onClick={handleDeobfuscate}
                                    disabled={isDeobfuscating}
                                    title="Deobfuscate JavaScript code"
                                >
                                    {isDeobfuscating ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <Code2 className="h-3 w-3" />
                                    )}
                                    Deobfuscate
                                </Button>
                            )}

                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-2 bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/20 text-purple-400 text-xs uppercase font-bold tracking-wider"
                                onClick={handleFormatCode}
                                title="Format code (prettify single-line code)"
                            >
                                <Wand2 className="h-3 w-3" />
                                Format
                            </Button>

                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-2 bg-primary/10 border-primary/20 hover:bg-primary/20 text-primary text-xs uppercase font-bold tracking-wider"
                                onClick={handleSendToLab}
                            >
                                <Terminal className="h-3 w-3" />
                                Send to Lab
                            </Button>

                            <div className="flex items-center gap-6 text-[10px] font-mono text-foreground-muted bg-background-secondary/50 px-3 py-1.5 rounded-full border border-border-subtle/30">
                                <span className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary/50"></span>
                                    LINES: <span className="text-foreground font-bold">{codeContent.split('\n').length.toLocaleString()}</span>
                                </span>
                                <span className="w-px h-3 bg-border-subtle"></span>
                                <span className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary/50"></span>
                                    SIZE: <span className="text-foreground font-bold">{new Blob([codeContent]).size.toLocaleString()} B</span>
                                </span>
                            </div>

                            <div className="h-4 w-px bg-border-subtle mx-2" />

                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-background-secondary text-foreground-muted hover:text-foreground transition-all"
                                onClick={() => setIsFullScreen(false)}
                                title="Exit Full Screen"
                            >
                                <Minimize2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-h-0 flex gap-0 relative">
                        {/* Sidebar (Left) */}
                        <aside className="w-64 bg-background-secondary/20 border-r border-border-subtle flex flex-col shrink-0">
                            <div className="p-3 border-b border-border-subtle bg-background-secondary/30 flex items-center justify-between">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-foreground-muted flex items-center gap-2">
                                    <LayoutList className="h-3.5 w-3.5 text-primary" />
                                    {language === 'html' ? 'DOM Elements' : 'Variables & Functions'}
                                </h3>
                                <span className="text-[9px] font-mono text-foreground-muted/60 bg-background-secondary px-1.5 py-0.5 rounded border border-border-subtle">
                                    {outline.length}
                                </span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                                {outline.length > 0 ? (
                                    <>
                                        {/* Functions Section */}
                                        {groupedOutline.functions.length > 0 && (
                                            <div className="space-y-1">
                                                <button
                                                    onClick={() => toggleSection('functions')}
                                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-background-secondary/50 transition-all text-left"
                                                >
                                                    {expandedSections.has('functions') ? (
                                                        <ChevronDown size={12} className="text-foreground-muted shrink-0" />
                                                    ) : (
                                                        <ChevronRight size={12} className="text-foreground-muted shrink-0" />
                                                    )}
                                                    <FunctionIcon size={12} className="text-purple-400 shrink-0" />
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-foreground-muted">
                                                        Functions
                                                    </span>
                                                    <span className="ml-auto text-[9px] text-foreground-muted/60 font-mono">
                                                        {groupedOutline.functions.length}
                                                    </span>
                                                </button>
                                                {expandedSections.has('functions') && (
                                                    <div className="ml-4 space-y-0.5">
                                                        {groupedOutline.functions.map((node, idx) => (
                                                            <button
                                                                key={idx}
                                                                onClick={() => {
                                                                    setSelectedSymbol(node.name);
                                                                    const refs = findReferences(node.name);
                                                                    setReferences(refs);
                                                                    setShowReferences(true);
                                                                }}
                                                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-background-secondary/80 hover:text-foreground transition-all group text-left min-w-0 cursor-pointer"
                                                            >
                                                                <span className="text-[11px] font-mono font-medium text-foreground-muted group-hover:text-foreground truncate">
                                                                    {node.name}
                                                                </span>
                                                                <span className="ml-auto text-[9px] text-foreground-muted/30 font-mono">
                                                                    :{node.line}
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Calls Section (ASM only) */}
                                        {groupedOutline.calls.length > 0 && (
                                            <div className="space-y-1">
                                                <button
                                                    onClick={() => toggleSection('calls')}
                                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-background-secondary/50 transition-all text-left"
                                                >
                                                    {expandedSections.has('calls') ? (
                                                        <ChevronDown size={12} className="text-foreground-muted shrink-0" />
                                                    ) : (
                                                        <ChevronRight size={12} className="text-foreground-muted shrink-0" />
                                                    )}
                                                    <Terminal size={12} className="text-cyan-400 shrink-0" />
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-foreground-muted">
                                                        Calls
                                                    </span>
                                                    <span className="ml-auto text-[9px] text-foreground-muted/60 font-mono">
                                                        {groupedOutline.calls.length}
                                                    </span>
                                                </button>
                                                {expandedSections.has('calls') && (
                                                    <div className="ml-4 space-y-0.5">
                                                        {groupedOutline.calls.map((node, idx) => (
                                                            <button
                                                                key={idx}
                                                                onClick={() => {
                                                                    setSelectedSymbol(node.name);
                                                                    const refs = findReferences(node.name);
                                                                    setReferences(refs);
                                                                    setShowReferences(true);
                                                                }}
                                                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-background-secondary/80 hover:text-foreground transition-all group text-left min-w-0 cursor-pointer"
                                                            >
                                                                <span className="text-[11px] font-mono font-medium text-foreground-muted group-hover:text-foreground truncate">
                                                                    {node.name}
                                                                </span>
                                                                <span className="ml-auto text-[9px] text-foreground-muted/30 font-mono">
                                                                    :{node.line}
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Variables Section */}
                                        {groupedOutline.variables.length > 0 && (
                                            <div className="space-y-1">
                                                <button
                                                    onClick={() => toggleSection('variables')}
                                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-background-secondary/50 transition-all text-left"
                                                >
                                                    {expandedSections.has('variables') ? (
                                                        <ChevronDown size={12} className="text-foreground-muted shrink-0" />
                                                    ) : (
                                                        <ChevronRight size={12} className="text-foreground-muted shrink-0" />
                                                    )}
                                                    <VariableIcon size={12} className="text-blue-400 shrink-0" />
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-foreground-muted">
                                                        Variables
                                                    </span>
                                                    <span className="ml-auto text-[9px] text-foreground-muted/60 font-mono">
                                                        {groupedOutline.variables.length}
                                                    </span>
                                                </button>
                                                {expandedSections.has('variables') && (
                                                    <div className="ml-4 space-y-0.5">
                                                        {groupedOutline.variables.map((node, idx) => (
                                                            <VariableItem key={idx} node={node} />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Classes Section */}
                                        {groupedOutline.classes.length > 0 && (
                                            <div className="space-y-1">
                                                <button
                                                    onClick={() => toggleSection('classes')}
                                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-background-secondary/50 transition-all text-left"
                                                >
                                                    {expandedSections.has('classes') ? (
                                                        <ChevronDown size={12} className="text-foreground-muted shrink-0" />
                                                    ) : (
                                                        <ChevronRight size={12} className="text-foreground-muted shrink-0" />
                                                    )}
                                                    <Box size={12} className="text-orange-400 shrink-0" />
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-foreground-muted">
                                                        Classes
                                                    </span>
                                                    <span className="ml-auto text-[9px] text-foreground-muted/60 font-mono">
                                                        {groupedOutline.classes.length}
                                                    </span>
                                                </button>
                                                {expandedSections.has('classes') && (
                                                    <div className="ml-4 space-y-0.5">
                                                        {groupedOutline.classes.map((node, idx) => (
                                                            <button
                                                                key={idx}
                                                                onClick={() => {
                                                                    setSelectedSymbol(node.name);
                                                                    const refs = findReferences(node.name);
                                                                    setReferences(refs);
                                                                    setShowReferences(true);
                                                                }}
                                                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-background-secondary/80 hover:text-foreground transition-all group text-left min-w-0 cursor-pointer"
                                                            >
                                                                <span className="text-[11px] font-mono font-medium text-foreground-muted group-hover:text-foreground truncate">
                                                                    {node.name}
                                                                </span>
                                                                <span className="ml-auto text-[9px] text-foreground-muted/30 font-mono">
                                                                    :{node.line}
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* IDs Section (HTML) */}
                                        {groupedOutline.ids.length > 0 && (
                                            <div className="space-y-1">
                                                <button
                                                    onClick={() => toggleSection('ids')}
                                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-background-secondary/50 transition-all text-left"
                                                >
                                                    {expandedSections.has('ids') ? (
                                                        <ChevronDown size={12} className="text-foreground-muted shrink-0" />
                                                    ) : (
                                                        <ChevronRight size={12} className="text-foreground-muted shrink-0" />
                                                    )}
                                                    <Hash size={12} className="text-yellow-400 shrink-0" />
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-foreground-muted">
                                                        IDs
                                                    </span>
                                                    <span className="ml-auto text-[9px] text-foreground-muted/60 font-mono">
                                                        {groupedOutline.ids.length}
                                                    </span>
                                                </button>
                                                {expandedSections.has('ids') && (
                                                    <div className="ml-4 space-y-0.5">
                                                        {groupedOutline.ids.map((node, idx) => (
                                                            <button
                                                                key={idx}
                                                                onClick={() => {
                                                                    setSelectedSymbol(node.name);
                                                                    const refs = findReferences(node.name);
                                                                    setReferences(refs);
                                                                    setShowReferences(true);
                                                                }}
                                                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-background-secondary/80 hover:text-foreground transition-all group text-left min-w-0 cursor-pointer"
                                                            >
                                                                <span className="text-[11px] font-mono font-medium text-foreground-muted group-hover:text-foreground truncate">
                                                                    {node.name}
                                                                </span>
                                                                <span className="ml-auto text-[9px] text-foreground-muted/30 font-mono">
                                                                    :{node.line}
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center opacity-30 text-center p-4">
                                        <Code2 size={24} className="mb-2" />
                                        <span className="text-[9px] font-black uppercase tracking-widest leading-tight">No definitions found</span>
                                    </div>
                                )}
                            </div>
                        </aside>

                        {/* Editor */}
                        <div className="flex-1 min-w-0 bg-background h-full">
                            {viewMode === 'code' ? (
                                <Editor
                                    key={resolvedTheme}
                                    height="100%"
                                    language={language}
                                    theme={resolvedTheme === 'light' ? AXALOTE_LIGHT_THEME_NAME : AXALOTE_DARK_THEME_NAME}
                                    value={codeContent}
                                    onChange={(value) => setCodeContent(value || '')}
                                    onMount={handleEditorDidMount}
                                    beforeMount={handleEditorWillMount}
                                    options={{
                                        minimap: { enabled: true },
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
                                            verticalScrollbarSize: 10,
                                            horizontalScrollbarSize: 10
                                        },
                                        fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
                                        readOnly: true,
                                        wordWrap: 'on'
                                    }}
                                />
                            ) : (
                                <HtmlPreview data={new TextEncoder().encode(codeContent)} />
                            )}
                        </div>

                        {/* References Panel (Right) */}
                        {showReferences && (
                            <aside className="w-80 bg-background-secondary/20 border-l border-border-subtle flex flex-col shrink-0">
                                <div className="p-3 border-b border-border-subtle bg-background-secondary/30 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Terminal className="h-3.5 w-3.5 text-primary" />
                                        <div>
                                            <h3 className="text-[10px] font-black uppercase tracking-widest text-foreground-muted">
                                                References
                                            </h3>
                                            <p className="text-[9px] font-mono text-foreground-muted/60">{selectedSymbol}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowReferences(false)}
                                        className="p-1 hover:bg-background rounded transition-colors"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                                <div className="px-3 py-2 bg-background-secondary/50 border-b border-border-subtle">
                                    <p className="text-[9px] text-foreground-muted">
                                        {references.length} {references.length === 1 ? 'reference' : 'references'} found
                                    </p>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                                    {references.length === 0 ? (
                                        <div className="p-8 text-center text-foreground-muted">
                                            <p className="text-xs">No references found</p>
                                        </div>
                                    ) : (
                                        references.map((ref, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => {
                                                    jumpToLine(ref.line);
                                                }}
                                                className="w-full p-2 rounded-lg hover:bg-background-secondary/80 transition-all text-left group border border-transparent hover:border-primary/20"
                                            >
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[9px] font-bold text-primary">
                                                        Line {ref.line}
                                                    </span>
                                                    <span className="text-[8px] text-foreground-muted">
                                                        Col {ref.column}
                                                    </span>
                                                </div>
                                                <code className="text-[9px] font-mono text-foreground-muted group-hover:text-foreground block truncate">
                                                    {ref.snippet}
                                                </code>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </aside>
                        )}
                    </div>
                </div>
            )}

            {/* Normal View */}
            <div className="flex flex-col h-full w-full bg-card border border-border-subtle rounded-lg overflow-hidden shadow-sm relative animate-in fade-in duration-500">
                {/* Header */}
                <div className="bg-background-secondary/40 border-b border-border-subtle px-6 py-3 flex items-center justify-between shrink-0 h-14">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Code2 className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                            <span className="text-sm font-bold text-foreground block leading-none">Code Inspector</span>
                            <span className="text-[10px] text-foreground-muted font-medium uppercase tracking-wider">
                                Source Analysis: <span className="text-primary">{language.toUpperCase()}</span>
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {viewMode === 'code' && (
                            <>
                                {isDeobfuscateSupported && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 gap-2 bg-orange-500/10 border-orange-500/20 hover:bg-orange-500/20 text-orange-400 text-xs uppercase font-bold tracking-wider"
                                        onClick={handleDeobfuscate}
                                        disabled={isDeobfuscating}
                                        title="Deobfuscate JavaScript code"
                                    >
                                        {isDeobfuscating ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <Code2 className="h-3 w-3" />
                                        )}
                                        Deobfuscate
                                    </Button>
                                )}

                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 gap-2 bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/20 text-purple-400 text-xs uppercase font-bold tracking-wider"
                                    onClick={handleFormatCode}
                                    title="Format code (prettify single-line code)"
                                >
                                    <Wand2 className="h-3 w-3" />
                                    Format
                                </Button>

                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 gap-2 bg-primary/10 border-primary/20 hover:bg-primary/20 text-primary text-xs uppercase font-bold tracking-wider"
                                    onClick={handleSendToLab}
                                >
                                    <Terminal className="h-3 w-3" />
                                    Send to Lab
                                </Button>
                            </>
                        )}

                        <div className="flex items-center bg-background p-1 rounded-lg border border-border-subtle">
                            <button
                                onClick={() => setViewMode('code')}
                                className={`flex items-center gap-2 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${viewMode === 'code'
                                    ? 'bg-primary/20 text-primary shadow-sm'
                                    : 'text-foreground-muted hover:text-foreground hover:bg-background-secondary'
                                    }`}
                            >
                                <FileCode className="h-3 w-3" /> Code
                            </button>
                            {language === 'html' && (
                                <button
                                    onClick={() => setViewMode('preview')}
                                    className={`flex items-center gap-2 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${viewMode === 'preview'
                                        ? 'bg-primary/20 text-primary shadow-sm'
                                        : 'text-foreground-muted hover:text-foreground hover:bg-background-secondary'
                                        }`}
                                >
                                    <Eye className="h-3 w-3" /> Preview
                                </button>
                            )}
                        </div>

                        {viewMode === 'code' && (
                            <div className="flex items-center gap-6 text-[10px] font-mono text-foreground-muted bg-background-secondary/50 px-3 py-1.5 rounded-full border border-border-subtle/30 ml-4">
                                <span className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary/50"></span>
                                    LINES: <span className="text-foreground font-bold">{codeContent.split('\n').length.toLocaleString()}</span>
                                </span>
                                <span className="w-px h-3 bg-border-subtle"></span>
                                <span className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary/50"></span>
                                    SIZE: <span className="text-foreground font-bold">{new Blob([codeContent]).size.toLocaleString()} B</span>
                                </span>
                            </div>
                        )}

                        <div className="h-4 w-px bg-border-subtle mx-2" />

                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 hover:bg-background-secondary text-foreground-muted hover:text-foreground transition-all"
                            onClick={() => setIsFullScreen(!isFullScreen)}
                            title={isFullScreen ? "Exit Full Screen" : "Enter Full Screen"}
                        >
                            {isFullScreen ? (
                                <Minimize2 className="h-4 w-4" />
                            ) : (
                                <Maximize2 className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </div>

                {/* Content Container */}
                <div className="flex-1 min-h-0 flex gap-0 relative">

                    {/* Variable Sidebar (Left) */}
                    {viewMode === 'code' && (
                        <aside className="w-64 bg-background-secondary/20 border-r border-border-subtle flex flex-col shrink-0">
                            <div className="p-3 border-b border-border-subtle bg-background-secondary/30 flex items-center justify-between">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-foreground-muted flex items-center gap-2">
                                    <LayoutList className="h-3.5 w-3.5 text-primary" />
                                    {language === 'html' ? 'DOM Elements' : 'Variables & Functions'}
                                </h3>
                                <span className="text-[9px] font-mono text-foreground-muted/60 bg-background-secondary px-1.5 py-0.5 rounded border border-border-subtle">
                                    {outline.length}
                                </span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                                {outline.length > 0 ? (
                                    <>
                                        {/* Functions Section */}
                                        {groupedOutline.functions.length > 0 && (
                                            <div className="space-y-1">
                                                <button
                                                    onClick={() => toggleSection('functions')}
                                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-background-secondary/50 transition-all text-left"
                                                >
                                                    {expandedSections.has('functions') ? (
                                                        <ChevronDown size={12} className="text-foreground-muted shrink-0" />
                                                    ) : (
                                                        <ChevronRight size={12} className="text-foreground-muted shrink-0" />
                                                    )}
                                                    <FunctionIcon size={12} className="text-purple-400 shrink-0" />
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-foreground-muted">
                                                        Functions
                                                    </span>
                                                    <span className="ml-auto text-[9px] text-foreground-muted/60 font-mono">
                                                        {groupedOutline.functions.length}
                                                    </span>
                                                </button>
                                                {expandedSections.has('functions') && (
                                                    <div className="ml-4 space-y-0.5">
                                                        {groupedOutline.functions.map((node, idx) => (
                                                            <button
                                                                key={idx}
                                                                onClick={() => {
                                                                    setSelectedSymbol(node.name);
                                                                    const refs = findReferences(node.name);
                                                                    setReferences(refs);
                                                                    setShowReferences(true);
                                                                }}
                                                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-background-secondary/80 hover:text-foreground transition-all group text-left min-w-0 cursor-pointer"
                                                            >
                                                                <span className="text-[11px] font-mono font-medium text-foreground-muted group-hover:text-foreground truncate">
                                                                    {node.name}
                                                                </span>
                                                                <span className="ml-auto text-[9px] text-foreground-muted/30 font-mono">
                                                                    :{node.line}
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Calls Section (ASM only) */}
                                        {groupedOutline.calls.length > 0 && (
                                            <div className="space-y-1">
                                                <button
                                                    onClick={() => toggleSection('calls')}
                                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-background-secondary/50 transition-all text-left"
                                                >
                                                    {expandedSections.has('calls') ? (
                                                        <ChevronDown size={12} className="text-foreground-muted shrink-0" />
                                                    ) : (
                                                        <ChevronRight size={12} className="text-foreground-muted shrink-0" />
                                                    )}
                                                    <Terminal size={12} className="text-cyan-400 shrink-0" />
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-foreground-muted">
                                                        Calls
                                                    </span>
                                                    <span className="ml-auto text-[9px] text-foreground-muted/60 font-mono">
                                                        {groupedOutline.calls.length}
                                                    </span>
                                                </button>
                                                {expandedSections.has('calls') && (
                                                    <div className="ml-4 space-y-0.5">
                                                        {groupedOutline.calls.map((node, idx) => (
                                                            <button
                                                                key={idx}
                                                                onClick={() => {
                                                                    setSelectedSymbol(node.name);
                                                                    const refs = findReferences(node.name);
                                                                    setReferences(refs);
                                                                    setShowReferences(true);
                                                                }}
                                                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-background-secondary/80 hover:text-foreground transition-all group text-left min-w-0 cursor-pointer"
                                                            >
                                                                <span className="text-[11px] font-mono font-medium text-foreground-muted group-hover:text-foreground truncate">
                                                                    {node.name}
                                                                </span>
                                                                <span className="ml-auto text-[9px] text-foreground-muted/30 font-mono">
                                                                    :{node.line}
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Variables Section */}
                                        {groupedOutline.variables.length > 0 && (
                                            <div className="space-y-1">
                                                <button
                                                    onClick={() => toggleSection('variables')}
                                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-background-secondary/50 transition-all text-left"
                                                >
                                                    {expandedSections.has('variables') ? (
                                                        <ChevronDown size={12} className="text-foreground-muted shrink-0" />
                                                    ) : (
                                                        <ChevronRight size={12} className="text-foreground-muted shrink-0" />
                                                    )}
                                                    <VariableIcon size={12} className="text-blue-400 shrink-0" />
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-foreground-muted">
                                                        Variables
                                                    </span>
                                                    <span className="ml-auto text-[9px] text-foreground-muted/60 font-mono">
                                                        {groupedOutline.variables.length}
                                                    </span>
                                                </button>
                                                {expandedSections.has('variables') && (
                                                    <div className="ml-4 space-y-0.5">
                                                        {groupedOutline.variables.map((node, idx) => (
                                                            <VariableItem key={idx} node={node} />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Classes Section */}
                                        {groupedOutline.classes.length > 0 && (
                                            <div className="space-y-1">
                                                <button
                                                    onClick={() => toggleSection('classes')}
                                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-background-secondary/50 transition-all text-left"
                                                >
                                                    {expandedSections.has('classes') ? (
                                                        <ChevronDown size={12} className="text-foreground-muted shrink-0" />
                                                    ) : (
                                                        <ChevronRight size={12} className="text-foreground-muted shrink-0" />
                                                    )}
                                                    <Box size={12} className="text-orange-400 shrink-0" />
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-foreground-muted">
                                                        Classes
                                                    </span>
                                                    <span className="ml-auto text-[9px] text-foreground-muted/60 font-mono">
                                                        {groupedOutline.classes.length}
                                                    </span>
                                                </button>
                                                {expandedSections.has('classes') && (
                                                    <div className="ml-4 space-y-0.5">
                                                        {groupedOutline.classes.map((node, idx) => (
                                                            <button
                                                                key={idx}
                                                                onClick={() => {
                                                                    setSelectedSymbol(node.name);
                                                                    const refs = findReferences(node.name);
                                                                    setReferences(refs);
                                                                    setShowReferences(true);
                                                                }}
                                                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-background-secondary/80 hover:text-foreground transition-all group text-left min-w-0 cursor-pointer"
                                                            >
                                                                <span className="text-[11px] font-mono font-medium text-foreground-muted group-hover:text-foreground truncate">
                                                                    {node.name}
                                                                </span>
                                                                <span className="ml-auto text-[9px] text-foreground-muted/30 font-mono">
                                                                    :{node.line}
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* IDs Section (HTML) */}
                                        {groupedOutline.ids.length > 0 && (
                                            <div className="space-y-1">
                                                <button
                                                    onClick={() => toggleSection('ids')}
                                                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-background-secondary/50 transition-all text-left"
                                                >
                                                    {expandedSections.has('ids') ? (
                                                        <ChevronDown size={12} className="text-foreground-muted shrink-0" />
                                                    ) : (
                                                        <ChevronRight size={12} className="text-foreground-muted shrink-0" />
                                                    )}
                                                    <Hash size={12} className="text-yellow-400 shrink-0" />
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-foreground-muted">
                                                        IDs
                                                    </span>
                                                    <span className="ml-auto text-[9px] text-foreground-muted/60 font-mono">
                                                        {groupedOutline.ids.length}
                                                    </span>
                                                </button>
                                                {expandedSections.has('ids') && (
                                                    <div className="ml-4 space-y-0.5">
                                                        {groupedOutline.ids.map((node, idx) => (
                                                            <button
                                                                key={idx}
                                                                onClick={() => {
                                                                    setSelectedSymbol(node.name);
                                                                    const refs = findReferences(node.name);
                                                                    setReferences(refs);
                                                                    setShowReferences(true);
                                                                }}
                                                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-background-secondary/80 hover:text-foreground transition-all group text-left min-w-0 cursor-pointer"
                                                            >
                                                                <span className="text-[11px] font-mono font-medium text-foreground-muted group-hover:text-foreground truncate">
                                                                    {node.name}
                                                                </span>
                                                                <span className="ml-auto text-[9px] text-foreground-muted/30 font-mono">
                                                                    :{node.line}
                                                                </span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center opacity-30 text-center p-4">
                                        <Code2 size={24} className="mb-2" />
                                        <span className="text-[9px] font-black uppercase tracking-widest leading-tight">No definitions found</span>
                                    </div>
                                )}
                            </div>
                        </aside>
                    )}

                    <div className="flex-1 min-w-0 bg-[#0E1117] h-full">
                        {viewMode === 'code' ? (
                            <Editor
                                key={resolvedTheme}
                                height="100%"
                                language={language}
                                theme={resolvedTheme === 'light' ? AXALOTE_LIGHT_THEME_NAME : AXALOTE_DARK_THEME_NAME}
                                value={codeContent}
                                onChange={(value) => setCodeContent(value || '')}
                                onMount={handleEditorDidMount}
                                beforeMount={handleEditorWillMount}
                                options={{
                                    minimap: { enabled: true },
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
                                        verticalScrollbarSize: 10,
                                        horizontalScrollbarSize: 10
                                    },
                                    fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
                                    readOnly: true,
                                    wordWrap: 'on'
                                }}
                            />
                        ) : (
                            <HtmlPreview data={new TextEncoder().encode(codeContent)} />
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
