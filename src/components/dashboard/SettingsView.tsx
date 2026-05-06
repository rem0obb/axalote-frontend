import { useState, useEffect, useRef } from 'react';
import { apiService } from '@/services/api.service';
import { EngineConfig, LogEntry } from '@/types/threat.types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
    Save, RefreshCcw, Zap, Activity, Palette, Type, Maximize2, Sparkles,
    Square, Droplet, Monitor, Contrast, ChevronRight, Layout, AlignLeft, AlignCenter, AlignRight,
    Shield, Terminal, Eye, EyeOff, Search, Box, Info, Power
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { LoadingState } from '@/components/common/LoadingState';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUISettings } from '@/hooks/useUISettings';
import { Input } from '@/components/ui/input';
import { SystemMonitor } from '@/components/dashboard/SystemMonitor';
import { getDefaultEngineBaseUrl, getEngineBaseUrl, resetEngineBaseUrl, setEngineBaseUrl } from '@/lib/engine-config';

// Keep same prop types to avoid TS errors
const SettingCard = ({ icon, title, description, children }: any) => (
    <div className="rounded-lg border border-border-subtle bg-card p-5">
        <div className="flex gap-4">
            <div className="shrink-0 rounded-md border border-border-subtle bg-background p-2.5 h-fit">
                {icon}
            </div>
            <div className="flex-1 space-y-4">
                <div>
                    <h3 className="font-semibold text-foreground">{title}</h3>
                    <p className="text-sm text-foreground-muted">{description}</p>
                </div>
                <div>
                    {children}
                </div>
            </div>
        </div>
    </div>
);
// Restart Engine Button Component
function RestartEngineButton() {
    const [isRestarting, setIsRestarting] = useState(false);

    const handleRestart = async () => {
        setIsRestarting(true);
        try {
            const response = await apiService.restartEngine();
            if (response.error) {
                toast.error(`Restart failed: ${response.error.message}`);
            } else {
                toast.success('Engine restarted successfully');
            }
        } catch (error) {
            toast.error('Failed to restart engine');
        } finally {
            setIsRestarting(false);
        }
    };

    return (
        <Button
            onClick={handleRestart}
            disabled={isRestarting}
            variant="outline"
            className="gap-2"
        >
            {isRestarting ? (
                <RefreshCcw className="h-4 w-4 animate-spin" />
            ) : (
                <Power className="h-4 w-4" />
            )}
            {isRestarting ? 'Restarting...' : 'Restart Engine'}
        </Button>
    );
}

type SectionId = 'integrations' | 'system' | 'appearance';

export function SettingsView() {
    const { settings, updateSetting, resetSettings } = useUISettings();
    const [config, setConfig] = useState<EngineConfig | null>(null);
    const [engineBaseUrl, setEngineBaseUrlState] = useState(() => getEngineBaseUrl());
    const [engineStatus, setEngineStatus] = useState<'connected' | 'error' | 'idle'>('idle');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isApplyingEngineUrl, setIsApplyingEngineUrl] = useState(false);
    const [activeSection, setActiveSection] = useState<SectionId>('appearance');
    const [showVtApiKey, setShowVtApiKey] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isPollingLogs, setIsPollingLogs] = useState(false);
    const scrollViewportRef = useRef<HTMLDivElement>(null);
    const shouldAutoScrollRef = useRef(true);

    const handleScroll = () => {
        if (!scrollViewportRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollViewportRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;
        shouldAutoScrollRef.current = isNearBottom;
    };

    useEffect(() => {
        if (activeSection === 'system' && logs.length > 0) {
            if (shouldAutoScrollRef.current && scrollViewportRef.current) {
                scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
            }
        }
    }, [logs, activeSection]);

    useEffect(() => {
        if (activeSection === 'system') {
            fetchLogs();
            const interval = setInterval(fetchLogs, 3000);
            setIsPollingLogs(true);
            return () => {
                clearInterval(interval);
                setIsPollingLogs(false);
            };
        }
    }, [activeSection]);

    const fetchLogs = async () => {
        try {
            const response = await apiService.getLogs();
            if (response.data && response.data.success) {
                setLogs(response.data.logs);
            }
        } catch (error) {
            console.error("Failed to fetch logs", error);
        }
    };

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        setIsLoading(true);
        try {
            const response = await apiService.getEngineConfig();
            if (response.data) {
                setEngineStatus('connected');
                //@ts-ignore
                if (response.data.config) {
                    //@ts-ignore
                    setConfig(response.data.config);
                } else {
                    setConfig(response.data);
                }
            } else if (response.error) {
                setEngineStatus('error');
                toast.error(`Failed to load config: ${response.error.message}`);
            }
        } catch (error) {
            setEngineStatus('error');
            toast.error("Failed to connect to engine");
        } finally {
            setIsLoading(false);
        }
    };

    const handleApplyEngineConnection = async () => {
        setIsApplyingEngineUrl(true);
        try {
            const nextBaseUrl = setEngineBaseUrl(engineBaseUrl || getDefaultEngineBaseUrl());
            setEngineBaseUrlState(nextBaseUrl);
            await fetchConfig();
            toast.success('Engine connection updated');
        } catch (error) {
            setEngineStatus('error');
            toast.error('Failed to update engine connection');
        } finally {
            setIsApplyingEngineUrl(false);
        }
    };

    const handleResetEngineConnection = async () => {
        setIsApplyingEngineUrl(true);
        try {
            const defaultBaseUrl = resetEngineBaseUrl();
            setEngineBaseUrlState(defaultBaseUrl);
            await fetchConfig();
            toast.success('Engine connection reset to default');
        } catch (error) {
            setEngineStatus('error');
            toast.error('Failed to reset engine connection');
        } finally {
            setIsApplyingEngineUrl(false);
        }
    };

    const handleSave = async () => {
        if (!config) return;
        setIsSaving(true);
        try {
            const response = await apiService.updateEngineConfig({
                virustotal: config.virustotal
            });
            if (response.data?.success) {
                toast.success("Settings saved successfully");
                await fetchConfig();
            } else if (response.error) {
                toast.error(`Error: ${response.error.message}`);
            }
        } catch (error) {
            toast.error("Failed to save settings");
        } finally {
            setIsSaving(false);
        }
    };

    const updateVTConfig = (value: string) => {
        if (!config) return;
        setConfig({
            ...config,
            virustotal: {
                ...(config.virustotal || { api_key: '' }),
                api_key: value
            }
        });
    };

    if (isLoading) {
        return <LoadingState message="Loading configuration..." />;
    }

    const navigation = [
        { id: 'appearance' as const, name: 'Appearance', icon: Palette, description: 'Customize interface' },
        { id: 'integrations' as const, name: 'Integrations', icon: Zap, description: 'API keys & services' },
        { id: 'system' as const, name: 'System', icon: Activity, description: 'Health & performance' },
    ];

    return (
        <div className={cn(
            "h-full flex flex-col bg-background overflow-hidden",
            settings.navbarPosition === 'top' ? "h-[calc(100vh-56px)]" : "h-full"
        )}>
            {/* Main Content */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* Sidebar Navigation */}
                <aside className="w-64 border-r border-border-subtle bg-background-secondary/30 overflow-y-auto shrink-0 flex flex-col">
                    <div className="border-b border-border-subtle px-6 py-6 shrink-0">
                        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
                        <p className="text-xs text-foreground-muted mt-2">Manage your preferences</p>
                    </div>

                    <div className="p-4 space-y-1 flex-1 overflow-y-auto">
                        {navigation.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveSection(item.id)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200",
                                    activeSection === item.id
                                        ? "bg-primary/10 text-primary font-medium border border-primary/20"
                                        : "text-foreground-muted hover:text-foreground hover:bg-background/50"
                                )}
                            >
                                <item.icon className="h-5 w-5 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium">{item.name}</div>
                                    <div className="text-xs text-foreground-muted/60 truncate">{item.description}</div>
                                </div>
                                {activeSection === item.id && <ChevronRight className="h-4 w-4 shrink-0" />}
                            </button>
                        ))}
                    </div>
                </aside>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    <div className="border-b border-border-subtle px-8 py-6 shrink-0">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-3xl font-bold tracking-tight text-foreground">
                                    {navigation.find(n => n.id === activeSection)?.name}
                                </h2>
                                <p className="text-sm text-foreground-muted mt-1">Manage your preferences and integrations</p>
                            </div>
                            {activeSection !== 'system' && (
                                <Button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    variant="outline"
                                    className="gap-2"
                                >
                                    {isSaving ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    Save
                                </Button>
                            )}
                        </div>
                    </div>

                    <ScrollArea className="flex-1">
                        <div className="p-8 max-w-5xl space-y-8">
                            {activeSection === 'appearance' && (
                                <AppearanceSection
                                    settings={settings}
                                    updateSetting={updateSetting}
                                    onResetAppearance={() => {
                                        resetSettings();
                                        toast.success('Appearance settings reset to defaults');
                                    }}
                                />
                            )}
                            {activeSection === 'integrations' && (
                                <IntegrationsSection
                                    config={config}
                                    engineBaseUrl={engineBaseUrl}
                                    engineStatus={engineStatus}
                                    isApplyingEngineUrl={isApplyingEngineUrl}
                                    showVtApiKey={showVtApiKey}
                                    onShowVtApiKeyChange={setShowVtApiKey}
                                    onEngineBaseUrlChange={setEngineBaseUrlState}
                                    onApplyEngineConnection={handleApplyEngineConnection}
                                    onResetEngineConnection={handleResetEngineConnection}
                                    onUpdateVTConfig={updateVTConfig}
                                />
                            )}
                            {activeSection === 'system' && (
                                <SystemSection logs={logs} scrollViewportRef={scrollViewportRef} onScroll={handleScroll} />
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </div>
        </div>
    );
}

function AppearanceSection({ settings, updateSetting, onResetAppearance }: any) {
    const handleChange = (key: any, value: any, label: string) => {
        updateSetting(key, value);
        toast.success(`${label} updated`);
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Appearance</h2>
                    <p className="text-sm text-foreground-muted mt-1">Customize how the interface looks and feels</p>
                </div>
                <Button onClick={onResetAppearance} variant="outline" size="sm" className="gap-2">
                    <RefreshCcw className="h-4 w-4" /> Reset
                </Button>
            </div>

            <div className="grid gap-6">
                <SettingCard icon={<Layout className="h-5 w-5" />} title="Navigation Layout" description="Choose position and alignment of the main navigation">
                    <div className="space-y-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <Label className="text-sm font-medium">Position</Label>
                                <p className="text-xs text-foreground-muted mt-1">Top or side navigation</p>
                            </div>
                            <div className="flex items-center rounded-lg border bg-background overflow-hidden p-1 gap-1">
                                <Button size="sm" variant={settings.navbarPosition === 'side' ? 'secondary' : 'ghost'} onClick={() => handleChange('navbarPosition', 'side', 'Navigation')} className="h-8">Side</Button>
                                <Button size="sm" variant={settings.navbarPosition === 'top' ? 'secondary' : 'ghost'} onClick={() => handleChange('navbarPosition', 'top', 'Navigation')} className="h-8">Top</Button>
                            </div>
                        </div>

                        {settings.navbarPosition === 'top' && (
                            <>
                                <div className="flex items-center justify-between pt-4 border-t">
                                    <div>
                                        <Label className="text-sm font-medium">Top Navigation Alignment</Label>
                                        <p className="text-xs text-foreground-muted mt-1">Align icons to left, center or right</p>
                                    </div>
                                    <div className="flex items-center rounded-lg border bg-background overflow-hidden p-1 gap-1">
                                        <Button size="icon" variant={settings.topbarAlignment === 'left' ? 'secondary' : 'ghost'} onClick={() => handleChange('topbarAlignment', 'left', 'Alignment')} className="h-8 w-8"><AlignLeft className="h-4 w-4" /></Button>
                                        <Button size="icon" variant={settings.topbarAlignment === 'center' ? 'secondary' : 'ghost'} onClick={() => handleChange('topbarAlignment', 'center', 'Alignment')} className="h-8 w-8"><AlignCenter className="h-4 w-4" /></Button>
                                        <Button size="icon" variant={settings.topbarAlignment === 'right' ? 'secondary' : 'ghost'} onClick={() => handleChange('topbarAlignment', 'right', 'Alignment')} className="h-8 w-8"><AlignRight className="h-4 w-4" /></Button>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-4 border-t">
                                    <div>
                                        <Label className="text-sm font-medium">Show Text Labels</Label>
                                        <p className="text-xs text-foreground-muted mt-1">Show text next to icons</p>
                                    </div>
                                    <Switch checked={settings.topbarTextVisible} onCheckedChange={(c) => handleChange('topbarTextVisible', c, 'Labels')} />
                                </div>
                            </>
                        )}

                        {settings.navbarPosition === 'side' && (
                            <>
                                <div className="flex items-center justify-between pt-4 border-t">
                                    <div>
                                        <Label className="text-sm font-medium">Sidebar Alignment</Label>
                                        <p className="text-xs text-foreground-muted mt-1">Align icons to start, center or end</p>
                                    </div>
                                    <div className="flex items-center rounded-lg border bg-background overflow-hidden p-1 gap-1">
                                        <Button size="icon" variant={settings.sidebarAlignment === 'left' ? 'secondary' : 'ghost'} onClick={() => handleChange('sidebarAlignment', 'left', 'Alignment')} className="h-8 w-8"><AlignLeft className="h-4 w-4" /></Button>
                                        <Button size="icon" variant={settings.sidebarAlignment === 'center' ? 'secondary' : 'ghost'} onClick={() => handleChange('sidebarAlignment', 'center', 'Alignment')} className="h-8 w-8"><AlignCenter className="h-4 w-4" /></Button>
                                        <Button size="icon" variant={settings.sidebarAlignment === 'right' ? 'secondary' : 'ghost'} onClick={() => handleChange('sidebarAlignment', 'right', 'Alignment')} className="h-8 w-8"><AlignRight className="h-4 w-4" /></Button>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-4 border-t">
                                    <div>
                                        <Label className="text-sm font-medium">Sidebar Width</Label>
                                        <p className="text-xs text-foreground-muted mt-1">Adjust width when expanded</p>
                                    </div>
                                    <Select value={settings.sidebarWidth} onValueChange={(v) => handleChange('sidebarWidth', v, 'Width')}>
                                        <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="narrow">Narrow (56px)</SelectItem>
                                            <SelectItem value="normal">Normal (64px)</SelectItem>
                                            <SelectItem value="wide">Wide (80px)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center justify-between pt-4 border-t">
                                    <div>
                                        <Label className="text-sm font-medium">Show Text Labels</Label>
                                        <p className="text-xs text-foreground-muted mt-1">Show text next to icons</p>
                                    </div>
                                    <Switch checked={settings.sidebarTextVisible} onCheckedChange={(c) => handleChange('sidebarTextVisible', c, 'Labels')} />
                                </div>
                            </>
                        )}
                    </div>
                </SettingCard>

                <SettingCard icon={<Palette className="h-5 w-5" />} title="Color Theme" description="Select your preferred color scheme">
                    <div className="space-y-3">
                        <Select value={settings.colorTheme} onValueChange={(v) => handleChange('colorTheme', v, 'Theme')}>
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="default">Default (Monochrome)</SelectItem>
                                <SelectItem value="slate">Slate</SelectItem>
                                <SelectItem value="blue">Blue</SelectItem>
                                <SelectItem value="green">Green</SelectItem>
                                <SelectItem value="purple">Purple</SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="flex gap-2 flex-wrap">
                            {['default', 'slate', 'blue', 'green', 'purple'].map((theme) => (
                                <button
                                    key={theme}
                                    onClick={() => handleChange('colorTheme', theme, 'Theme')}
                                    className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border transition-all", settings.colorTheme === theme ? "border-primary bg-primary/10" : "border-border hover:border-primary/50")}
                                >
                                    <div className={cn("w-3 h-3 rounded-full", theme === 'default' && "bg-zinc-600", theme === 'slate' && "bg-slate-600", theme === 'blue' && "bg-blue-600", theme === 'green' && "bg-green-600", theme === 'purple' && "bg-purple-600")} />
                                    <span className="text-xs font-medium capitalize">{theme}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </SettingCard>

                <SettingCard icon={<Maximize2 className="h-5 w-5" />} title="Interface Density" description="Adjust spacing and padding">
                    <Select value={settings.density} onValueChange={(v) => handleChange('density', v, 'Density')}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="compact">Compact - More content</SelectItem>
                            <SelectItem value="normal">Normal - Balanced</SelectItem>
                            <SelectItem value="comfortable">Comfortable - More space</SelectItem>
                        </SelectContent>
                    </Select>
                </SettingCard>

                <SettingCard icon={<Type className="h-5 w-5" />} title="Font Size" description="Adjust base font size">
                    <Select value={settings.fontSize} onValueChange={(v) => handleChange('fontSize', v, 'FontSize')}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="small">Small (14px)</SelectItem>
                            <SelectItem value="medium">Medium (16px)</SelectItem>
                            <SelectItem value="large">Large (18px)</SelectItem>
                        </SelectContent>
                    </Select>
                </SettingCard>

                <SettingCard icon={<Sparkles className="h-5 w-5" />} title="Animations" description="Enable or disable UI animations">
                    <div className="flex items-center justify-between">
                        <div>
                            <Label className="text-sm font-medium">Enable Animations</Label>
                            <p className="text-xs text-foreground-muted mt-1">{settings.animations ? 'Enabled' : 'Disabled'}</p>
                        </div>
                        <Switch checked={settings.animations} onCheckedChange={(v) => handleChange('animations', v, 'Animations')} />
                    </div>
                </SettingCard>

                <SettingCard icon={<Square className="h-5 w-5" />} title="Border Radius" description="Adjust corner roundness">
                    <div className="space-y-3">
                        <Select value={settings.borderRadius} onValueChange={(v) => handleChange('borderRadius', v, 'Border')}>
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">None - Sharp</SelectItem>
                                <SelectItem value="small">Small (4px)</SelectItem>
                                <SelectItem value="medium">Medium (8px)</SelectItem>
                                <SelectItem value="large">Large (12px)</SelectItem>
                                <SelectItem value="full">Full (16px)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </SettingCard>

                <SettingCard icon={<Monitor className="h-5 w-5" />} title="Code Editor Theme" description="Select Monaco editor theme">
                    <Select value={settings.monacoTheme} onValueChange={(v) => handleChange('monacoTheme', v, 'Theme')}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="vs-dark">VS Dark</SelectItem>
                            <SelectItem value="vs-light">VS Light</SelectItem>
                            <SelectItem value="hc-black">High Contrast Dark</SelectItem>
                            <SelectItem value="hc-light">High Contrast Light</SelectItem>
                        </SelectContent>
                    </Select>
                </SettingCard>

                <SettingCard icon={<Contrast className="h-5 w-5" />} title="High Contrast Mode" description="Increase contrast">
                    <div className="flex items-center justify-between">
                        <div>
                            <Label className="text-sm font-medium">Enable High Contrast</Label>
                            <p className="text-xs text-foreground-muted mt-1">{settings.highContrast ? 'Enabled' : 'Disabled'}</p>
                        </div>
                        <Switch checked={settings.highContrast} onCheckedChange={(v) => handleChange('highContrast', v, 'Contrast')} />
                    </div>
                </SettingCard>

                <SettingCard icon={<Droplet className="h-5 w-5" />} title="Blur Effects" description="Enable glass morphism">
                    <div className="flex items-center justify-between">
                        <div>
                            <Label className="text-sm font-medium">Enable Blur Effects</Label>
                            <p className="text-xs text-foreground-muted mt-1">{settings.blurEffects ? 'Enabled' : 'Disabled'}</p>
                        </div>
                        <Switch checked={settings.blurEffects} onCheckedChange={(v) => handleChange('blurEffects', v, 'Blur')} />
                    </div>
                </SettingCard>
            </div>
        </div>
    );
}

function IntegrationsSection({
    config,
    engineBaseUrl,
    engineStatus,
    isApplyingEngineUrl,
    showVtApiKey,
    onShowVtApiKeyChange,
    onEngineBaseUrlChange,
    onApplyEngineConnection,
    onResetEngineConnection,
    onUpdateVTConfig
}: any) {
    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-bold text-foreground">Integrations</h2>
                <p className="text-sm text-foreground-muted mt-1">Configure how the desktop app connects to your engine and exposed tools</p>
            </div>

            <div className="grid gap-6">
                <SettingCard icon={<Terminal className="h-5 w-5" />} title="Engine Connection" description="Desktop app endpoint used for files, rules, tools, logs, and telemetry">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Engine Base URL</Label>
                            <Input
                                value={engineBaseUrl}
                                onChange={(event) => onEngineBaseUrlChange(event.target.value)}
                                placeholder="http://127.0.0.1:8081"
                                className="font-mono"
                            />
                            <div className="flex items-center justify-between text-xs text-foreground-muted">
                                <span>Saved locally in the desktop app.</span>
                                <span className={cn(
                                    "rounded-md border px-2 py-1 uppercase tracking-wide",
                                    engineStatus === 'connected' && "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
                                    engineStatus === 'error' && "border-red-500/20 bg-red-500/10 text-red-400",
                                    engineStatus === 'idle' && "border-border-subtle bg-background text-foreground-muted"
                                )}>
                                    {engineStatus === 'connected' ? 'Connected' : engineStatus === 'error' ? 'Unavailable' : 'Idle'}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <Button 
                                onClick={onApplyEngineConnection} 
                                disabled={isApplyingEngineUrl} 
                                variant="outline"
                                className="gap-2"
                            >
                                {isApplyingEngineUrl ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Apply Connection
                            </Button>
                            <Button onClick={onResetEngineConnection} disabled={isApplyingEngineUrl} variant="outline">
                                Reset Default
                            </Button>
                        </div>
                    </div>
                </SettingCard>

                <SettingCard icon={<Zap className="h-5 w-5" />} title="Tools Integration" description="The frontend now uses MCP and /axalote/tools instead of provider-based AI chat">
                    <div className="space-y-3">
                        <div className="rounded-lg border border-border-subtle bg-background/50 p-4 text-sm text-foreground-muted">
                            <p className="font-medium text-foreground">Available backend integration paths</p>
                            <p className="mt-2">`GET /axalote/tools` lists tools from the MCP registry.</p>
                            <p>`POST /axalote/tools/call` executes a tool by `name` and `args`.</p>
                            <p>`POST /axalote/mcp` remains available for JSON-RPC MCP traffic.</p>
                        </div>
                    </div>
                </SettingCard>

                {config && (
                    <SettingCard icon={<Shield className="h-5 w-5" />} title="VirusTotal API" description="Connect to VirusTotal for file intelligence">
                        <div className="space-y-2">
                            <Label>API Key</Label>
                            <div className="relative">
                                <Input
                                    type={showVtApiKey ? 'text' : 'password'}
                                    value={config.virustotal?.api_key || ''}
                                    onChange={(e) => onUpdateVTConfig(e.target.value)}
                                    placeholder="Enter your VirusTotal API key"
                                    className="pr-10"
                                />
                                <button
                                    onClick={() => onShowVtApiKeyChange(!showVtApiKey)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground transition-colors"
                                    title={showVtApiKey ? "Hide key" : "Show key"}
                                >
                                    {showVtApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                    </SettingCard>
                )}
            </div>
        </div>
    );
}

function SystemSection({ logs, scrollViewportRef, onScroll }: any) {
    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-bold text-foreground">System Health</h2>
                <p className="text-sm text-foreground-muted mt-1">Monitor real-time engine status and resource usage</p>
            </div>
            {/* Engine Controls */}
            <div className="bg-card border border-border-subtle rounded-xl p-6 space-y-4">
                <div>
                    <h3 className="text-lg font-bold text-foreground">Engine Controls</h3>
                    <p className="text-sm text-foreground-muted mt-1">Hot-reload and restart engine components</p>
                </div>
                <div className="flex items-center justify-between p-4 bg-background-secondary/30 rounded-lg border border-border-subtle">
                    <div className="space-y-1">
                        <h4 className="font-semibold text-foreground">Restart Engine</h4>
                        <p className="text-xs text-foreground-muted">Reinitialize scanner, YARA rules, and AI client</p>
                    </div>
                    <RestartEngineButton />
                </div>
            </div>

            <SystemMonitor />

            {/* Premium Terminal */}
            <div className="overflow-hidden rounded-lg border border-border-subtle bg-card">
                {/* Terminal chrome bar */}
                <div className="flex items-center justify-between px-4 py-3 bg-[#0d0d0f] border-b border-white/5">
                    <div className="flex items-center gap-2">
                        {/* Traffic lights */}
                        <span className="h-3 w-3 rounded-full bg-red-500/80" />
                        <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
                        <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
                    </div>
                    <div className="flex items-center gap-2">
                        <Terminal className="h-3.5 w-3.5 text-foreground-muted/40" />
                        <span className="text-[10px] font-mono font-bold text-foreground-muted/40 uppercase tracking-widest">axalote · system log</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            logs.length > 0 ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"
                        )} />
                        <span className="text-[9px] font-mono text-foreground-muted/40 uppercase tracking-widest">
                            {logs.length > 0 ? 'live' : 'idle'}
                        </span>
                    </div>
                </div>

                {/* Log body */}
                <div
                    className="h-[420px] overflow-auto p-4 bg-[#0a0a0c] font-mono text-[12px] leading-6 custom-scrollbar"
                    ref={scrollViewportRef}
                    onScroll={onScroll}
                    style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 23px, rgba(255,255,255,0.012) 24px)' }}
                >
                    {logs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center gap-3 text-foreground-muted/30">
                            <Activity className="h-10 w-10 opacity-20" />
                            <div className="text-center">
                                <p className="text-xs font-mono uppercase tracking-widest">Waiting for engine output</p>
                                <p className="text-[10px] mt-1 opacity-60">logs will stream here in real time</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-0.5">
                            {logs.map((log: any, idx: number) => {
                                const levelColors: Record<string, string> = {
                                    ERROR: 'text-red-400 bg-red-500/10 border-red-500/20',
                                    WARN: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
                                    INFO: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
                                    DEBUG: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20',
                                };
                                const msgColors: Record<string, string> = {
                                    ERROR: 'text-red-300/90',
                                    WARN: 'text-yellow-200/80',
                                    INFO: 'text-foreground/75',
                                    DEBUG: 'text-zinc-500',
                                };
                                const lc = levelColors[log.level] || 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20';
                                const mc = msgColors[log.level] || 'text-foreground/60';
                                return (
                                    <div key={idx} className="flex items-start gap-3 px-2 py-1 rounded-lg hover:bg-white/[0.02] transition-colors group">
                                        {/* Timestamp */}
                                        <span className="text-zinc-600 shrink-0 tabular-nums text-[10px] pt-0.5 w-36">
                                            {new Date(log.timestamp).toLocaleTimeString()}
                                        </span>
                                        {/* Level badge */}
                                        <span className={cn(
                                            "shrink-0 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border tabular-nums w-12 text-center",
                                            lc
                                        )}>
                                            {log.level?.slice(0, 4)}
                                        </span>
                                        {/* Message */}
                                        <span className={cn("flex-1 break-all", mc)}>
                                            {log.message}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Terminal bottom bar */}
                <div className="flex items-center justify-between px-4 py-2 bg-[#0d0d0f] border-t border-white/5">
                    <span className="text-[9px] font-mono text-foreground-muted/30 uppercase tracking-widest">
                        {logs.length} events
                    </span>
                    <span className="text-[9px] font-mono text-foreground-muted/20 uppercase tracking-widest">
                        refresh 3s
                    </span>
                </div>
            </div>
        </div>
    );
}
