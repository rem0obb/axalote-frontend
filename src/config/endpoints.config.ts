import { FileCode, Search, Braces, Terminal, Settings, Zap, Puzzle, FlaskConical } from 'lucide-react';
import { EndpointConfig } from '@/types/threat.types';
import { VirusTotalIcon } from '@/components/icons/VirusTotalIcon';

const ENDPOINTS_RAW: EndpointConfig[] = [
  {
    id: 'virustotal',
    name: 'VirusTotal',
    path: '/axalote/vt/files/:hash',
    uiPath: '/vt',
    icon: VirusTotalIcon,
    description: 'Search by hash and ingest from VT to records',
    enabled: true,
    category: 'endpoints',
  },
  {
    id: 'files',
    name: 'Files',
    path: '/axalote/records/files',
    uiPath: '/',
    icon: FileCode,
    description: 'Analyzed threat samples',
    enabled: true,
    category: 'hidden', // Hidden from navigation, only accessible via logo
  },
  {
    id: 'rules',
    name: 'Rules',
    path: '/axalote/yara/rules',
    uiPath: '/rules',
    icon: Braces,
    description: 'Yara Rules',
    enabled: true,
    category: 'endpoints',
  },
  {
    id: 'hunt',
    name: 'Hunt',
    path: '/axalote/hunt/yara',
    uiPath: '/hunt',
    icon: Search,
    description: 'Hunt files with Yara',
    enabled: true,
    category: 'endpoints',
  },
  {
    id: 'plugins',
    name: 'Plugins',
    path: '/axalote/plugins',
    uiPath: '/plugins',
    icon: Puzzle,
    description: 'Manage Lua plugins at runtime',
    enabled: true,
    category: 'endpoints',
  },
  {
    id: 'lab',
    name: 'Lab',
    path: '/axalote/lab',
    uiPath: '/lab',
    icon: FlaskConical,
    description: 'CyberChef-style transformation suite',
    enabled: true,
    category: 'intelligence',
  },
  {
    id: 'terminal',
    name: 'Terminal',
    path: '/axalote/terminal',
    uiPath: '/terminal',
    icon: Terminal,
    description: 'Interactive Lua Environment',
    enabled: true,
    category: 'intelligence',
  },
  {
    id: 'settings',
    name: 'Settings',
    path: '/axalote/config/view',
    uiPath: '/settings',
    icon: Settings,
    description: 'Engine Configuration',
    enabled: true,
    category: 'system',
  },
];

export const ENDPOINTS = ENDPOINTS_RAW;

export function getEndpointById(id: string): EndpointConfig | undefined {
  return ENDPOINTS.find(e => e.id === id);
}
