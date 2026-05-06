import { Theme } from "@/components/providers/ThemeProvider";

export const AXALOTE_DARK_THEME_NAME = 'axalote-dark';
export const AXALOTE_LIGHT_THEME_NAME = 'axalote-light';

export const defineMonacoThemes = (monaco: any) => {
    // Axalote Dark Theme (REPORTS Intelligence)
    monaco.editor.defineTheme(AXALOTE_DARK_THEME_NAME, {
        base: 'vs-dark',
        inherit: true,
        rules: [
            { token: 'keyword', foreground: '009982', fontStyle: 'bold' },
            { token: 'variable', foreground: '009982' },
            { token: 'string', foreground: '16dbb3' },
            { token: 'comment', foreground: '5c6a6a', fontStyle: 'italic' },
            { token: 'number', foreground: '16dbb3' },
            // ASM Specific
            { token: 'keyword.directive', foreground: '569CD6', fontStyle: 'bold' },
            { token: 'type', foreground: '4EC9B0' },
            { token: 'identifier', foreground: '9CDCFE' },
        ],
        colors: {
            'editor.background': '#111618',
            'editor.foreground': '#ebeeee',
            'editor.lineHighlightBackground': '#1a2225',
            'editorCursor.foreground': '#009982',
            'editorIndentGuide.background': '#20282b',
            'editorLineNumber.foreground': '#5c6a6a',
            'editor.selectionBackground': '#00998233',
            'editorInactiveSelectionBackground': '#00998211',
        }
    });

    // Axalote Light Theme (Remoob Blog Style)
    monaco.editor.defineTheme(AXALOTE_LIGHT_THEME_NAME, {
        base: 'vs',
        inherit: true,
        rules: [
            { token: 'keyword', foreground: '10b981', fontStyle: 'bold' }, // Emerald-500
            { token: 'variable', foreground: '059669' }, // Emerald-600
            { token: 'string', foreground: '000000', fontStyle: 'bold' }, // Black/Bold for impact
            { token: 'comment', foreground: '9ca3af', fontStyle: 'italic' }, // Gray-400
            { token: 'number', foreground: '000000' },
            // ASM Specific (Light)
            { token: 'keyword.directive', foreground: '047857', fontStyle: 'bold' }, // Emerald-700
            { token: 'type', foreground: '059669' }, // Emerald-600
            { token: 'identifier', foreground: '1f2937' }, // Gray-800
        ],
        colors: {
            'editor.background': '#ffffff', // Pure white
            'editor.foreground': '#111827', // Gray-900
            'editor.lineHighlightBackground': '#f3f4f6', // Gray-100
            'editorCursor.foreground': '#10b981', // Emerald-500
            'editorIndentGuide.background': '#e5e7eb', // Gray-200
            'editorLineNumber.foreground': '#9ca3af', // Gray-400
            'editor.selectionBackground': '#10b98122',
            'editorInactiveSelectionBackground': '#10b98111',
        }
    });
};

export const getMonacoThemeName = (theme: Theme): string => {
    if (theme === 'light') return AXALOTE_LIGHT_THEME_NAME;
    if (theme === 'dark') return AXALOTE_DARK_THEME_NAME;
    // For 'system', we need to check preference, but typically we pass resolved theme.
    // Assuming the component passes the resolved theme ('light' | 'dark').
    // If it passes 'system', we default to dark for now or handle it if we have access to system pref.
    return AXALOTE_DARK_THEME_NAME;
};
