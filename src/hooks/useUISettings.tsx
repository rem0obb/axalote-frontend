import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { configSetSection, configGetSection } from '@/lib/persistent-config';

export type NavbarPosition = 'top' | 'side';
export type Alignment = 'left' | 'center' | 'right';

export interface UISettings {
    animations: boolean;
    colorTheme: string;
    density: string;
    fontSize: string;
    borderRadius: string;
    highContrast: boolean;
    blurEffects: boolean;
    monacoTheme: string;
    navbarPosition: NavbarPosition;
    sidebarWidth: string;
    sidebarTextVisible: boolean;
    sidebarAlignment: Alignment;
    topbarTextVisible: boolean;
    topbarAlignment: Alignment;
}

const DEFAULT_SETTINGS: UISettings = {
    animations: true,
    colorTheme: 'default',
    density: 'normal',
    fontSize: 'medium',
    borderRadius: 'medium',
    highContrast: false,
    blurEffects: false,
    monacoTheme: 'vs-dark',
    navbarPosition: 'side',
    sidebarWidth: 'normal',
    sidebarTextVisible: true,
    sidebarAlignment: 'left',
    topbarTextVisible: true,
    topbarAlignment: 'center',
};

interface UISettingsContextType {
    settings: UISettings;
    updateSetting: <K extends keyof UISettings>(key: K, value: UISettings[K]) => void;
    resetSettings: () => void;
}

const UISettingsContext = createContext<UISettingsContextType | undefined>(undefined);

export function UISettingsProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<UISettings>(() => {
        // Synchronous load from localStorage for immediate render
        try {
            const saved = localStorage.getItem('axalote_ui_settings');
            if (saved) {
                return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
            }
        } catch (e) {
            console.error('Failed to parse UI settings', e);
        }

        // Migration from old individual keys
        return {
            animations: localStorage.getItem('axalote_animations') !== 'false',
            colorTheme: localStorage.getItem('axalote_color_theme') || 'default',
            density: localStorage.getItem('axalote_density') || 'normal',
            fontSize: localStorage.getItem('axalote_font_size') || 'medium',
            borderRadius: localStorage.getItem('axalote_border_radius') || 'medium',
            highContrast: localStorage.getItem('axalote_high_contrast') === 'true',
            blurEffects: localStorage.getItem('axalote_blur_effects') === 'true',
            monacoTheme: localStorage.getItem('axalote_monaco_theme') || 'vs-dark',
            navbarPosition: (localStorage.getItem('axalote_navbar_position') as NavbarPosition) || 'side',
            sidebarWidth: localStorage.getItem('axalote_sidebar_width') || 'normal',
            sidebarTextVisible: localStorage.getItem('axalote_sidebar_text_visible') !== 'false',
            sidebarAlignment: (localStorage.getItem('axalote_sidebar_alignment') as Alignment) || 'left',
            topbarTextVisible: localStorage.getItem('axalote_topbar_text_visible') !== 'false',
            topbarAlignment: (localStorage.getItem('axalote_topbar_alignment') as Alignment) || 'center',
        };
    });

    // Load from persistent config on mount (async, overrides localStorage if file exists)
    useEffect(() => {
        configGetSection<UISettings>('ui').then((persisted) => {
            if (persisted && typeof persisted === 'object') {
                setSettings(prev => ({ ...prev, ...persisted }));
            }
        }).catch(() => {});
    }, []);

    useEffect(() => {
        // Save to localStorage (synchronous, immediate)
        localStorage.setItem('axalote_ui_settings', JSON.stringify(settings));

        // Save to persistent config file (async, fire-and-forget)
        configSetSection('ui', settings).catch(() => {});

        applyThemeClasses(settings);
    }, [settings]);

    const updateSetting = <K extends keyof UISettings>(key: K, value: UISettings[K]) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const resetSettings = () => {
        setSettings(DEFAULT_SETTINGS);
    };

    return (
        <UISettingsContext.Provider value={{ settings, updateSetting, resetSettings }}>
            {children}
        </UISettingsContext.Provider>
    );
}

export function useUISettings() {
    const context = useContext(UISettingsContext);
    if (context === undefined) {
        throw new Error('useUISettings must be used within a UISettingsProvider');
    }
    return context;
}

function applyThemeClasses(settings: UISettings) {
    const root = document.documentElement;

    root.classList.remove('theme-slate', 'theme-blue', 'theme-green', 'theme-purple');
    root.classList.remove('density-compact', 'density-normal', 'density-comfortable');
    root.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
    root.classList.remove('radius-none', 'radius-small', 'radius-medium', 'radius-large', 'radius-full');
    root.classList.remove('sidebar-narrow', 'sidebar-normal', 'sidebar-wide');
    root.classList.remove('reduce-motion', 'high-contrast', 'blur-enabled');

    if (settings.colorTheme !== 'default') root.classList.add(`theme-${settings.colorTheme}`);
    root.classList.add(`density-${settings.density}`);
    root.classList.add(`font-size-${settings.fontSize}`);
    root.classList.add(`radius-${settings.borderRadius}`);
    root.classList.add(`sidebar-${settings.sidebarWidth}`);

    if (!settings.animations) root.classList.add('reduce-motion');
    if (settings.highContrast) root.classList.add('high-contrast');
    if (settings.blurEffects) root.classList.add('blur-enabled');
}
