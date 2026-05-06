import { Terminal, ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ENDPOINTS } from '@/config/endpoints.config';
import { useState, useEffect } from 'react';
import { useUISettings } from '@/hooks/useUISettings';
import { getAssetPath } from '@/lib/runtime';

interface SidebarProps {
  activeEndpoint: string;
  onEndpointChange: (id: string) => void;
}

const SIDEBAR_ORDER_KEY = 'sidebar_icon_order';
const APP_LOGO = getAssetPath('logo/axalote.png');

export function Sidebar({ activeEndpoint, onEndpointChange }: SidebarProps) {
  const [endpointOrder, setEndpointOrder] = useState<string[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const { settings } = useUISettings();
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_ORDER_KEY);
      if (saved) setEndpointOrder(JSON.parse(saved));
    } catch (error) {
      console.error('Failed to load sidebar order:', error);
    }
  }, []);

  const getSortedEndpoints = (category: string) => {
    const endpoints = ENDPOINTS.filter(e => e.category === category);
    if (endpointOrder.length === 0) return endpoints;
    return endpoints.sort((a, b) => {
      const aIndex = endpointOrder.indexOf(a.id);
      const bIndex = endpointOrder.indexOf(b.id);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) { setDraggedId(null); return; }
    const newOrder = endpointOrder.length > 0 ? [...endpointOrder] : ENDPOINTS.map(e => e.id);
    const draggedIndex = newOrder.indexOf(draggedId);
    const targetIndex = newOrder.indexOf(targetId);
    if (draggedIndex === -1 || targetIndex === -1) { setDraggedId(null); return; }
    [newOrder[draggedIndex], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[draggedIndex]];
    setEndpointOrder(newOrder);
    try { localStorage.setItem(SIDEBAR_ORDER_KEY, JSON.stringify(newOrder)); } catch { }
    setDraggedId(null);
  };

  const handleDragEnd = () => setDraggedId(null);

  // Horizontal alignment of items inside each button row
  const itemAlign = settings.sidebarTextVisible
    ? 'justify-start'
    : settings.sidebarAlignment === 'right' ? 'justify-end'
      : settings.sidebarAlignment === 'center' ? 'justify-center'
        : 'justify-start';

  // Vertical position of the nav block within the sidebar flex column
  const navVerticalAlign =
    settings.sidebarAlignment === 'center' ? 'justify-center' :
      settings.sidebarAlignment === 'right' ? 'justify-end' :
        'justify-start';

  const navItem = (endpoint: typeof ENDPOINTS[0]) => {
    const Icon = endpoint.icon;
    const isActive = activeEndpoint === endpoint.id;
    const isDisabled = !endpoint.enabled;
    const isDragging = draggedId === endpoint.id;

    return (
      <li key={endpoint.id}>
        <button
          draggable
          onDragStart={(e) => handleDragStart(e, endpoint.id)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, endpoint.id)}
          onDragEnd={handleDragEnd}
          onClick={() => endpoint.enabled && onEndpointChange(endpoint.id as string)}
          disabled={isDisabled}
          title={endpoint.name}
          className={cn(
            "w-full flex items-center gap-3 p-2.5 rounded-xl text-sm transition-all duration-300 relative group cursor-move",
            itemAlign,
            settings.sidebarTextVisible && "px-4",
            isActive
              ? "bg-foreground/5 text-foreground"
              : "text-foreground-muted hover:bg-muted/50 hover:text-foreground",
            isDisabled && "opacity-40 cursor-not-allowed hover:bg-transparent",
            isDragging && "opacity-50 bg-primary/10"
          )}
        >
          <Icon className={cn("h-5 w-5 shrink-0 transition-transform group-hover:scale-110", isActive && "text-primary")} />
          {settings.sidebarTextVisible && (
            <span className="font-medium whitespace-nowrap overflow-hidden text-ellipsis text-left">
              {endpoint.name}
            </span>
          )}
          {isActive && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
          )}
        </button>
      </li>
    );
  };

  return (
    <aside
      className="h-full bg-background-secondary border-r border-border-subtle flex flex-col shrink-0 transition-all duration-300 ease-in-out z-40 relative"
      style={{ width: settings.sidebarTextVisible ? '240px' : 'var(--sidebar-collapsed, 64px)' }}
    >
      {/* Logo */}
      <button
        onClick={() => onEndpointChange('files')}
        className={cn(
          "h-14 flex items-center border-b border-border-subtle hover:bg-primary/5 transition-all duration-300 group overflow-hidden shrink-0",
          settings.sidebarTextVisible ? "px-5 gap-3" : "justify-center"
        )}
        title="Files"
      >
        <img
          src={APP_LOGO}
          alt="AXALOTE Logo"
          className="h-9 w-9 shrink-0 animate-pulse cursor-pointer group-hover:scale-110 transition-transform"
        />
        {settings.sidebarTextVisible && (
          <span className="font-bold text-lg text-foreground tracking-tight whitespace-nowrap overflow-hidden animate-in fade-in slide-in-from-left-2 duration-300">
            axalote
          </span>
        )}
      </button>

      {/* Navigation — vertical alignment via navVerticalAlign */}
      <nav className={cn("flex-1 py-4 overflow-y-auto flex flex-col custom-scrollbar", navVerticalAlign)}>
        <div className="space-y-6 w-full">
          <div className="space-y-1">
            <ul className="space-y-1 px-2">
              {getSortedEndpoints('endpoints').map(navItem)}
            </ul>
          </div>
          <div className="space-y-1">
            <div className="px-2 pt-2 border-t border-border-subtle/30" />
            <ul className="space-y-1 px-2">
              {getSortedEndpoints('intelligence').map(navItem)}
            </ul>
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-border-subtle space-y-2 shrink-0">
        <div className={cn(
          "flex items-center gap-1",
          settings.sidebarTextVisible ? "justify-center px-2" : "flex-col"
        )}>
          <button onClick={() => navigate(-1)} title="Back" className="p-2 hover:bg-muted/50 rounded-lg text-foreground-muted hover:text-foreground transition-colors">
            <ChevronLeft size={16}/>
          </button>
          <button onClick={() => window.location.reload()} title="Reload" className="p-2 hover:bg-muted/50 rounded-lg text-foreground-muted hover:text-foreground transition-colors">
            <RotateCw size={16}/>
          </button>
          <button onClick={() => navigate(1)} title="Forward" className="p-2 hover:bg-muted/50 rounded-lg text-foreground-muted hover:text-foreground transition-colors">
            <ChevronRight size={16}/>
          </button>
        </div>

        {ENDPOINTS.filter(e => e.id === 'settings').map((endpoint) => {
          const Icon = endpoint.icon;
          const isActive = activeEndpoint === endpoint.id;
          return (
            <button
              key={endpoint.id}
              onClick={() => onEndpointChange(endpoint.id as string)}
              title={endpoint.name}
              className={cn(
                "w-full flex items-center gap-3 p-2.5 rounded-xl text-sm transition-all duration-300 relative group",
                itemAlign,
                settings.sidebarTextVisible && "px-4",
                isActive
                  ? "bg-foreground/5 text-foreground"
                  : "text-foreground-muted hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0 transition-transform group-hover:rotate-45", isActive && "text-primary")} />
              {settings.sidebarTextVisible && (
                <span className="font-medium whitespace-nowrap overflow-hidden text-ellipsis text-left">{endpoint.name}</span>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
