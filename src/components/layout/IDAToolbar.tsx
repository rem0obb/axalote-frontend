import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  FileCode,
  Search,
  Braces,
  Terminal,
  Settings,
  Puzzle,
} from 'lucide-react';
import { VirusTotalIcon } from '@/components/icons/VirusTotalIcon';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getAssetPath } from '@/lib/runtime';

interface IDAToolbarProps {
  activeView?: string;
  onViewChange?: (view: string) => void;
  rightActions?: ReactNode;
}

const TOOLBAR_ITEMS = [
  { id: 'files', icon: FileCode, label: 'Files', shortcut: 'Alt+F' },
  { id: 'virustotal', icon: VirusTotalIcon, label: 'VirusTotal', shortcut: 'Alt+V' },
  { id: 'rules', icon: Braces, label: 'Rules', shortcut: 'Alt+R' },
  { id: 'hunt', icon: Search, label: 'Hunt', shortcut: 'Alt+H' },
  { id: 'plugins', icon: Puzzle, label: 'Plugins', shortcut: 'Alt+P' },
  { id: 'lab', icon: Terminal, label: 'Lab', shortcut: 'Alt+L' },
];

const APP_LOGO = getAssetPath('logo/axalote.png');

export function IDAToolbar({ activeView, onViewChange, rightActions }: IDAToolbarProps) {
  return (
    <div className="h-12 bg-background-elevated border-b border-border flex items-center justify-between px-4 gap-2">
      {/* Logo */}
      <div className="flex items-center gap-3 px-2">
        <img src={APP_LOGO} alt="AXALOTE" className="h-6 w-6" />
        <span className="text-base font-bold text-foreground tracking-tight">AXALOTE</span>
      </div>

      {/* Toolbar Items */}
      <div className="flex items-center gap-1 flex-1">
        {TOOLBAR_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;

          return (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onViewChange?.(item.id)}
                  className={cn(
                    'h-9 px-4 flex items-center gap-2 rounded-lg text-sm font-medium transition-all',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'text-foreground-muted hover:bg-muted hover:text-foreground hover:shadow-sm'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{item.label} ({item.shortcut})</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        {rightActions}

        <div className="w-px h-6 bg-border" />

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onViewChange?.('settings')}
              className={cn(
                'h-9 w-9 flex items-center justify-center rounded-lg transition-all',
                activeView === 'settings'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground-muted hover:bg-muted hover:text-foreground'
              )}
            >
              <Settings className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Settings (Alt+S)</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
