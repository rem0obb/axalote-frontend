import { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { IDAToolbar } from './IDAToolbar';
import { IDAStatusBar, StatusItem } from './IDAStatusBar';
import { GlobalLoader } from '@/components/common/GlobalLoader';
import { LuaTerminal } from '@/components/common/LuaTerminal';
import { ENDPOINTS } from '@/config/endpoints.config';
import { Activity, HardDrive, Clock } from 'lucide-react';

export type MainLayoutContextType = {
    activeEndpoint: string;
    setActiveEndpoint: (id: string) => void;
};

export function MainLayoutIDA() {
    const location = useLocation();
    const navigate = useNavigate();
    const [activeEndpoint, setActiveEndpointState] = useState('files');
    const [isTerminalOpen, setIsTerminalOpen] = useState(false);

    // Sync activeEndpoint with URL
    useEffect(() => {
        const path = location.pathname;
        const matchedEndpoint = ENDPOINTS.find(e => {
            if (e.uiPath === '/' && path === '/') return true;
            if (e.uiPath !== '/' && path.startsWith(e.uiPath)) return true;
            return false;
        });

        if (matchedEndpoint) {
            setActiveEndpointState(matchedEndpoint.id);
        }
    }, [location.pathname]);

    // Global keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl+` or Ctrl+Shift+P to toggle terminal
            if ((e.ctrlKey && e.key === '`') || (e.ctrlKey && e.shiftKey && e.key === 'P')) {
                e.preventDefault();
                setIsTerminalOpen(prev => !prev);
            }
            // Escape to close terminal
            if (e.key === 'Escape' && isTerminalOpen) {
                setIsTerminalOpen(false);
            }
            
            // Quick navigation shortcuts (Alt+Key)
            if (e.altKey && !e.ctrlKey && !e.shiftKey) {
                const shortcuts: Record<string, string> = {
                    'f': 'files',
                    'v': 'virustotal',
                    'r': 'rules',
                    'h': 'hunt',
                    'p': 'plugins',
                    'l': 'lab',
                    's': 'settings',
                };
                
                const endpointId = shortcuts[e.key.toLowerCase()];
                if (endpointId) {
                    e.preventDefault();
                    setActiveEndpoint(endpointId);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isTerminalOpen]);

    const setActiveEndpoint = (id: string) => {
        const endpoint = ENDPOINTS.find(e => e.id === id);
        if (endpoint && endpoint.enabled) {
            navigate(endpoint.uiPath);
        }
    };

    return (
        <div className="h-screen w-screen bg-background flex flex-col overflow-hidden">
            {/* IDA Pro Style Toolbar */}
            <IDAToolbar
                activeView={activeEndpoint}
                onViewChange={setActiveEndpoint}
                rightActions={
                    <button
                        onClick={() => setIsTerminalOpen(prev => !prev)}
                        className="h-6 px-2 flex items-center gap-1 rounded text-[11px] font-medium text-foreground-muted hover:bg-muted/50 hover:text-foreground transition-colors"
                        title="Terminal (Ctrl+`)"
                    >
                        Terminal
                    </button>
                }
            />

            {/* Main Content */}
            <main className="flex-1 overflow-hidden">
                <Outlet context={{
                    activeEndpoint,
                    setActiveEndpoint
                } satisfies MainLayoutContextType} />
            </main>

            {/* IDA Pro Style Status Bar */}
            <IDAStatusBar
                leftItems={[
                    <StatusItem icon={<Activity className="h-3 w-3" />} label="Status" value="Ready" />,
                    <StatusItem label="View" value={activeEndpoint} />,
                ]}
                rightItems={[
                    <StatusItem icon={<HardDrive className="h-3 w-3" />} label="Memory" value="128MB" />,
                    <StatusItem icon={<Clock className="h-3 w-3" />} label="Time" value={new Date().toLocaleTimeString()} />,
                ]}
            />

            <GlobalLoader />
            
            {/* Global Lua Terminal */}
            <LuaTerminal 
                isOpen={isTerminalOpen} 
                onClose={() => setIsTerminalOpen(false)} 
            />
        </div>
    );
}
