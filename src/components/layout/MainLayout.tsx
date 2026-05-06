import { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopNavbar } from './TopNavbar';
import { GlobalLoader } from '@/components/common/GlobalLoader';
import { useUISettings } from '@/hooks/useUISettings';
import { ENDPOINTS } from '@/config/endpoints.config';

export type MainLayoutContextType = {
    activeEndpoint: string;
    setActiveEndpoint: (id: string) => void;
    navbarPosition: 'top' | 'side';
};

export function MainLayout() {
    const location = useLocation();
    const navigate = useNavigate();
    const [activeEndpoint, setActiveEndpointState] = useState('files');

    const { settings, updateSetting } = useUISettings();
    const navbarPosition = settings.navbarPosition;

    // Apply global root classes immediately on mount
    useEffect(() => {
        // Just triggering the hook is enough to apply classes via its internal effect
    }, []);

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

    // Global keyboard shortcut: Ctrl+Shift+N to toggle navbar
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl+Shift+N to toggle navbar position
            if (e.ctrlKey && e.shiftKey && e.key === 'N') {
                e.preventDefault();
                updateSetting('navbarPosition', navbarPosition === 'side' ? 'top' : 'side');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [navbarPosition, updateSetting]);

    const setActiveEndpoint = (id: string) => {
        const endpoint = ENDPOINTS.find(e => e.id === id);
        if (endpoint && endpoint.enabled) {
            navigate(endpoint.uiPath);
        }
    };

    return (
        <div className="h-screen w-screen bg-background overflow-hidden relative">
            {navbarPosition === 'side' ? (
                <div className="h-full w-full flex">
                    <Sidebar
                        activeEndpoint={activeEndpoint}
                        onEndpointChange={setActiveEndpoint}
                    />
                    <main className="flex-1 h-full w-full overflow-hidden bg-background">
                        <Outlet context={{
                            activeEndpoint,
                            setActiveEndpoint,
                            navbarPosition
                        } satisfies MainLayoutContextType} />
                    </main>
                </div>
            ) : (
                <div className="h-full w-full flex flex-col">
                    <TopNavbar
                        activeEndpoint={activeEndpoint}
                        onEndpointChange={setActiveEndpoint}
                    />
                    <main className="flex-1 w-full overflow-hidden bg-background pt-14">
                        <Outlet context={{
                            activeEndpoint,
                            setActiveEndpoint,
                            navbarPosition
                        } satisfies MainLayoutContextType} />
                    </main>
                </div>
            )}

            <GlobalLoader />
        </div>
    );
}
