import { Settings, Terminal, ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ENDPOINTS } from '@/config/endpoints.config';
import { useState, useEffect } from 'react';
import { useUISettings } from '@/hooks/useUISettings';
import { getAssetPath } from '@/lib/runtime';

interface TopNavbarProps {
  activeEndpoint: string;
  onEndpointChange: (id: string) => void;
}

const SIDEBAR_ORDER_KEY = 'sidebar_icon_order';
const APP_LOGO = getAssetPath('logo/axalote.png');

export function TopNavbar({ activeEndpoint, onEndpointChange }: TopNavbarProps) {
  const [endpointOrder, setEndpointOrder] = useState<string[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const { settings } = useUISettings();
  const navigate = useNavigate();

  // Load saved order from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_ORDER_KEY);
      if (saved) {
        setEndpointOrder(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load navbar order:', error);
    }
  }, []);

  // Get sorted endpoints
  const getSortedEndpoints = (category: string) => {
    const endpoints = ENDPOINTS.filter(e => e.category === category);
    if (endpointOrder.length === 0) return endpoints;

    const sorted = endpoints.sort((a, b) => {
      const aIndex = endpointOrder.indexOf(a.id);
      const bIndex = endpointOrder.indexOf(b.id);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
    return sorted;
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
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }

    const newOrder = endpointOrder.length > 0 ? [...endpointOrder] : ENDPOINTS.map(e => e.id);
    const draggedIndex = newOrder.indexOf(draggedId);
    const targetIndex = newOrder.indexOf(targetId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedId(null);
      return;
    }

    // Swap positions
    [newOrder[draggedIndex], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[draggedIndex]];

    setEndpointOrder(newOrder);

    // Save to localStorage
    try {
      localStorage.setItem(SIDEBAR_ORDER_KEY, JSON.stringify(newOrder));
    } catch (error) {
      console.error('Failed to save navbar order:', error);
    }

    setDraggedId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  // Determine alignment classes
  const getAlignmentClass = () => {
    switch (settings.topbarAlignment) {
      case 'left': return 'justify-start';
      case 'right': return 'justify-end';
      case 'center':
      default: return 'justify-center';
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 h-14 bg-background-secondary border-b border-border-subtle flex items-center px-4 z-50">

      {/* Left side: Logo */}
      <div className="flex-none flex items-center pr-4">
        <button
          onClick={() => onEndpointChange('files')}
          className="flex items-center gap-3 group"
          title="Files"
        >
          <img
            src={APP_LOGO}
            alt="AXALOTE Logo"
            className="h-7 w-7 animate-pulse cursor-pointer group-hover:scale-110 transition-transform"
          />
        </button>
      </div>

      {/* Center/Main Navigation */}
      <div className={cn("flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar", getAlignmentClass())}>
        {/* Endpoints */}
        {getSortedEndpoints('endpoints').map((endpoint) => {
          const Icon = endpoint.icon;
          const isActive = activeEndpoint === endpoint.id;
          const isDisabled = !endpoint.enabled;
          const isDragging = draggedId === endpoint.id;

          return (
            <button
              key={endpoint.id}
              draggable
              onDragStart={(e) => handleDragStart(e, endpoint.id)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, endpoint.id)}
              onDragEnd={handleDragEnd}
              onClick={() => endpoint.enabled && onEndpointChange(endpoint.id as string)}
              disabled={isDisabled}
              title={endpoint.name}
              className={cn(
                "flex justify-center items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-move shrink-0 relative",
                isActive
                  ? "bg-foreground/5 text-foreground"
                  : "text-foreground-muted hover:bg-muted/50 hover:text-foreground",
                isDisabled && "opacity-40 cursor-not-allowed hover:bg-transparent",
                isDragging && "opacity-50 bg-primary/10"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {settings.topbarTextVisible && <span>{endpoint.name}</span>}
            </button>
          );
        })}

        <div className="w-px h-6 bg-border-subtle mx-2 shrink-0" />

        {/* Intelligence */}
        {getSortedEndpoints('intelligence').map((endpoint) => {
          const Icon = endpoint.icon;
          const isActive = activeEndpoint === endpoint.id;
          const isDisabled = !endpoint.enabled;
          const isDragging = draggedId === endpoint.id;

          return (
            <button
              key={endpoint.id}
              draggable
              onDragStart={(e) => handleDragStart(e, endpoint.id)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, endpoint.id)}
              onDragEnd={handleDragEnd}
              onClick={() => endpoint.enabled && onEndpointChange(endpoint.id as string)}
              disabled={isDisabled}
              title={endpoint.name}
              className={cn(
                "flex justify-center items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-move shrink-0 relative",
                isActive
                  ? "bg-foreground/5 text-foreground"
                  : "text-foreground-muted hover:bg-muted/50 hover:text-foreground",
                isDisabled && "opacity-40 cursor-not-allowed hover:bg-transparent",
                isDragging && "opacity-50 bg-primary/10"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {settings.topbarTextVisible && <span>{endpoint.name}</span>}
            </button>
          );
        })}
      </div>

      {/* Right side: Actions */}
      <div className="flex-none flex items-center justify-end gap-2 pl-4 ml-auto border-l border-border-subtle">
        <div className="flex items-center gap-1 border-r border-border-subtle pr-2 mr-2">
          <button onClick={() => navigate(-1)} title="Back" className="p-1.5 hover:bg-muted/50 rounded-lg text-foreground-muted hover:text-foreground transition-colors">
            <ChevronLeft size={16}/>
          </button>
          <button onClick={() => window.location.reload()} title="Reload" className="p-1.5 hover:bg-muted/50 rounded-lg text-foreground-muted hover:text-foreground transition-colors">
            <RotateCw size={16}/>
          </button>
          <button onClick={() => navigate(1)} title="Forward" className="p-1.5 hover:bg-muted/50 rounded-lg text-foreground-muted hover:text-foreground transition-colors">
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
                "flex items-center justify-center p-2 rounded-lg text-sm transition-all duration-200",
                isActive
                  ? "bg-foreground/5 text-foreground"
                  : "text-foreground-muted hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
