import { memo, useEffect, useMemo, useState } from 'react';
import copy from 'copy-to-clipboard';
import {
  AlertTriangle,
  Binary,
  ChevronDown,
  ChevronRight,
  Clock,
  Cpu,
  Crosshair,
  FileJson,
  Hash,
  Info,
  Layout,
  List,
  Loader2,
  Maximize2,
  Minimize2,
  Monitor,
  Plus,
  Search,
  ShieldCheck,
  Tag,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { apiService } from '@/services/api.service';
import { EnumField, ParsedData } from '@/types/parser.types';

interface ParserViewerProps {
  data?: ParsedData | null;
  sha256?: string;
  loading?: boolean;
  error?: string | null;
  onSelectField?: (offset: number, size: number) => void;
}

type SummaryItem = {
  icon: any;
  label: string;
  value: string | number;
  color?: string;
};

const DEFAULT_OPEN_KEYS = new Set([
  'header',
  'mz',
  'coff_hdr',
  'optional_hdr',
  'sections',
  'load_commands',
  'program_headers',
  'section_headers',
  'string_ids',
  'type_ids',
  'proto_ids',
  'field_ids',
  'method_ids',
  'class_defs',
]);

const FRIENDLY_LABELS: Record<string, string> = {
  mz: 'DOS Header',
  coff_hdr: 'COFF Header',
  optional_hdr: 'Optional Header',
  sections: 'Sections',
  header: 'Header',
  load_commands: 'Load Commands',
  string_ids: 'String IDs',
  type_ids: 'Type IDs',
  proto_ids: 'Proto IDs',
  field_ids: 'Field IDs',
  method_ids: 'Method IDs',
  class_defs: 'Class Definitions',
  certificate_table: 'Certificate Table',
  map: 'DEX Map',
  link: 'DEX Link Data',
};

const SummaryCard = ({ icon: Icon, label, value, color = 'text-primary' }: SummaryItem) => (
  <div className="rounded-xl border border-border-subtle bg-background-secondary/30 p-3">
    <div className="mb-1.5 flex items-center gap-2">
      <Icon className="h-3 w-3 text-foreground-muted" />
      <span className="text-[10px] font-black uppercase tracking-widest text-foreground-muted">{label}</span>
    </div>
    <span className={cn('block truncate font-mono text-sm font-bold', color)}>{value}</span>
  </div>
);

const InsightCard = ({ title, items }: { title: string; items: string[] }) => {
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-border-subtle bg-background-secondary/20 p-3">
      <div className="mb-2 flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-black uppercase tracking-widest text-foreground-muted">{title}</span>
      </div>
      <div className="space-y-2 text-xs text-foreground-muted">
        {items.map((item, index) => (
          <div key={`${item}-${index}`} className="rounded-lg border border-border-subtle/50 bg-background/40 px-3 py-2">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
};

const SectionMap = ({ sections, totalSize }: { sections: any[]; totalSize: number }) => {
  if (!sections || sections.length === 0 || !totalSize) return null;

  return (
    <div className="border-b border-border-subtle/30 bg-background-secondary/10 px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <Layout className="h-3 w-3 text-foreground-muted" />
        <span className="text-[10px] font-black uppercase tracking-widest text-foreground-muted">Physical Layout</span>
      </div>
      <div className="flex h-6 w-full overflow-hidden rounded-md border border-border-subtle bg-background">
        {sections.map((section, index) => {
          const offset = section.offset ?? section.pointer_to_raw_data ?? section.start ?? 0;
          const size = section.size ?? section.size_of_raw_data ?? ((section.end ?? 0) - (section.start ?? 0)) ?? 0;
          if (!size) return null;

          const width = Math.max((size / totalSize) * 100, 1);
          const sectionName = String(section.name || `Section ${index}`).toLowerCase();

          let color = 'bg-primary/40 hover:bg-primary/60';
          if (sectionName.includes('text') || sectionName.includes('code')) color = 'bg-cyan-500/40 hover:bg-cyan-500/60';
          if (sectionName.includes('data')) color = 'bg-orange-500/40 hover:bg-orange-500/60';
          if (sectionName.includes('rsrc') || sectionName.includes('resource')) color = 'bg-fuchsia-500/40 hover:bg-fuchsia-500/60';

          return (
            <div
              key={`${section.name || 'section'}-${index}`}
              className={cn('group/sec relative h-full cursor-help border-r border-border-subtle/30 transition-colors', color)}
              style={{ width: `${width}%` }}
            >
              <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded border border-border bg-popover px-2 py-1 text-[10px] text-popover-foreground opacity-0 shadow-xl group-hover/sec:opacity-100">
                <p className="font-bold">{section.name || `Section ${index}`}</p>
                <p className="font-mono text-[9px] opacity-70">Offset: {formatHex(offset)}</p>
                <p className="font-mono text-[9px] opacity-70">Size: {Number(size).toLocaleString()} bytes</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

function formatLabel(value: EnumField | string | number | undefined | null) {
  if (value === undefined || value === null) return 'Unknown';
  if (typeof value === 'object' && value !== null && 'label' in value) return String(value.label);
  return String(value);
}

function formatHex(value?: number | null) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return 'N/A';
  return `0x${Number(value).toString(16).toUpperCase()}`;
}

function formatDateFromUnix(value?: number | null) {
  if (!value) return 'Unknown';
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function shortenSha(sha256?: string) {
  if (!sha256) return '';
  return sha256.length > 16 ? `${sha256.slice(0, 8)}...${sha256.slice(-8)}` : sha256;
}

function buildSummary(data: ParsedData | null): SummaryItem[] {
  if (!data) return [];

  if (data.format === 'PE') {
    const entry = data.optional_hdr?.std?.address_of_entry_point || data.optional_hdr?.entry_point || data.optional_hdr?.address_of_entry_point;
    return [
      { icon: Cpu, label: 'Architecture', value: formatLabel(data.coff_hdr?.machine) },
      { icon: Zap, label: 'Entry Point', value: formatHex(entry) },
      { icon: Layout, label: 'Sections', value: data.coff_hdr?.number_of_sections || data.sections?.length || 0 },
      { icon: Clock, label: 'Compiled', value: formatDateFromUnix(data.coff_hdr?.time_date_stamp) },
      { icon: ShieldCheck, label: 'Subsystem', value: formatLabel(data.optional_hdr?.subsystem) },
    ];
  }

  if (data.format === 'ELF') {
    return [
      { icon: Cpu, label: 'Machine', value: formatLabel(data.header?.machine) },
      { icon: Zap, label: 'Entry Point', value: formatHex(data.header?.entry_point) },
      { icon: Info, label: 'Type', value: formatLabel(data.header?.e_type) },
      { icon: Layout, label: 'Sections', value: data.header?.num_section_headers || data.header?.section_headers?.length || 0 },
      { icon: List, label: 'Program Headers', value: data.header?.num_program_headers || data.header?.program_headers?.length || 0 },
    ];
  }

  if (data.format === 'MACH_O') {
    return [
      { icon: Cpu, label: 'CPU Type', value: formatLabel(data.header?.cputype) },
      { icon: Info, label: 'File Type', value: formatLabel(data.header?.filetype) },
      { icon: Layout, label: 'Load Commands', value: data.header?.ncmds || data.load_commands?.length || 0 },
      { icon: Hash, label: 'Command Bytes', value: data.header?.sizeofcmds || 0 },
    ];
  }

  if (data.format === 'DEX') {
    const magic = Array.isArray(data.header?.magic) ? data.header.magic : [];
    const version = magic.length >= 7 ? String.fromCharCode(...magic.slice(4, 7)) : 'Unknown';
    return [
      { icon: Info, label: 'Version', value: version },
      { icon: Layout, label: 'Classes', value: data.header?.class_defs_size || 0 },
      { icon: Zap, label: 'Methods', value: data.header?.method_ids_size || 0 },
      { icon: List, label: 'Strings', value: data.header?.string_ids_size || 0 },
      { icon: Hash, label: 'File Size', value: `${Number(data.header?.file_size || 0).toLocaleString()} bytes` },
    ];
  }

  if (data.format === 'PDF') {
    return [
      { icon: FileJson, label: 'Format', value: 'PDF' },
      { icon: Layout, label: 'Objects', value: data.object_count || data.objects?.length || 0 },
      { icon: Info, label: 'Version', value: data.version || 'Unknown' },
    ];
  }

  return [{ icon: FileJson, label: 'Format', value: data.format || 'Unknown' }];
}

function buildInsights(data: ParsedData | null): string[] {
  if (!data) return [];

  if (data.format === 'PE') {
    const insights: string[] = [];
    const sections = Array.isArray(data.sections) ? data.sections : [];
    const sectionNames = sections.map(section => String(section.name || '').toLowerCase());

    if (data.certificate_table) insights.push('Embedded certificate table present; good candidate for signature inspection.');
    if (sectionNames.some(name => name.includes('rsrc'))) insights.push('Resource section detected; check for icons, manifests or embedded payloads.');
    if ((data.coff_hdr?.number_of_sections || sections.length || 0) > 6) insights.push('Section count is above the minimal baseline; worth checking for staging or packing artefacts.');
    if (data.coff_hdr?.time_date_stamp) insights.push(`Compile timestamp reported as ${formatDateFromUnix(data.coff_hdr.time_date_stamp)}.`);

    return insights;
  }

  if (data.format === 'ELF') {
    return [
      `Program headers: ${data.header?.num_program_headers || data.header?.program_headers?.length || 0}.`,
      `Section headers: ${data.header?.num_section_headers || data.header?.section_headers?.length || 0}.`,
      data.header?.entry_point ? `Execution starts at ${formatHex(data.header.entry_point)}.` : 'Entry point was not resolved by the parser.',
    ];
  }

  if (data.format === 'MACH_O') {
    return [
      `Load commands discovered: ${data.header?.ncmds || data.load_commands?.length || 0}.`,
      'Inspect load commands for dylib references, segments and entitlements-related metadata.',
    ];
  }

  if (data.format === 'DEX') {
    return [
      `Classes: ${data.header?.class_defs_size || 0}, methods: ${data.header?.method_ids_size || 0}, strings: ${data.header?.string_ids_size || 0}.`,
      'DEX metadata is useful for triaging package footprint before jumping into strings or bytecode.',
    ];
  }

  if (data.format === 'PDF') {
    return ['PDF parsing is available; check objects, trailers and embedded streams for document-based delivery chains.'];
  }

  return [];
}

function getSectionsForMap(data: ParsedData | null) {
  if (!data) return [];
  if (data.format === 'PE') return data.sections || [];
  if (data.format === 'ELF') return data.header?.section_headers || [];
  return [];
}

function computeTotalFileSize(data: ParsedData | null, sections: any[]) {
  if (!data) return 0;
  if (data.header?.file_size) return Number(data.header.file_size);

  let max = 0;
  sections.forEach(section => {
    const offset = Number(section.offset ?? section.pointer_to_raw_data ?? section.start ?? 0);
    const size = Number(section.size ?? section.size_of_raw_data ?? ((section.end ?? 0) - (section.start ?? 0)) ?? 0);
    max = Math.max(max, offset + size);
  });
  return max;
}

function getQuickAccessItems(data: ParsedData | null) {
  if (!data) return [];

  return Object.keys(data)
    .filter(key => key !== 'format' && typeof data[key] === 'object' && data[key] !== null)
    .map(key => {
      let icon = Info;
      if (key.includes('header') || key.includes('hdr')) icon = Info;
      if (key.includes('section')) icon = Layout;
      if (key.includes('command')) icon = Zap;
      if (key.includes('id') || key.includes('def')) icon = List;

      const value = data[key];
      const count = Array.isArray(value) ? value.length : Object.keys(value || {}).length;

      return {
        key,
        icon,
        count,
        label: FRIENDLY_LABELS[key] || key.replace(/_/g, ' '),
      };
    });
}

function hasMatchingNode(label: string, value: any, filter: string): boolean {
  if (!filter) return true;

  const query = filter.toLowerCase();
  if (label.toLowerCase().includes(query)) return true;

  if (value === null || value === undefined) {
    return String(value).toLowerCase().includes(query);
  }

  if (typeof value !== 'object') {
    return String(value).toLowerCase().includes(query);
  }

  if ('label' in value && 'value' in value && Object.keys(value).length === 2) {
    return String(value.label).toLowerCase().includes(query) || String(value.value).toLowerCase().includes(query);
  }

  return Object.keys(value).some(key => hasMatchingNode(key, value[key], filter));
}

export function ParserViewer({ data: initialData, sha256, loading: loadingProp, error: errorProp, onSelectField }: ParserViewerProps) {
  const [fetchedData, setFetchedData] = useState<ParsedData | null>(null);
  const [internalLoading, setInternalLoading] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [globalExpand, setGlobalExpand] = useState<boolean | null>(null);
  const [renderKey, setRenderKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const shouldFetchInternally = initialData === undefined && loadingProp === undefined && errorProp === undefined && !!sha256;

  useEffect(() => {
    if (!shouldFetchInternally || !sha256) return;

    let active = true;
    setFetchedData(null);
    setInternalError(null);
    setInternalLoading(true);

    apiService.getParserFile(sha256)
      .then(response => {
        if (!active) return;

        if (response.error) {
          setInternalError(response.error.message);
          return;
        }

        setFetchedData(response.data?.parsed || null);
      })
      .finally(() => {
        if (active) {
          setInternalLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [sha256, shouldFetchInternally]);

  useEffect(() => {
    if (initialData !== undefined) {
      setFetchedData(null);
    }
  }, [initialData]);

  const data = initialData !== undefined ? initialData : fetchedData;
  const loading = loadingProp ?? internalLoading;
  const error = errorProp ?? internalError;

  const summary = useMemo(() => buildSummary(data), [data]);
  const insights = useMemo(() => buildInsights(data), [data]);
  const sectionsForMap = useMemo(() => getSectionsForMap(data), [data]);
  const totalFileSize = useMemo(() => computeTotalFileSize(data, sectionsForMap), [data, sectionsForMap]);
  const quickAccessItems = useMemo(() => getQuickAccessItems(data), [data]);
  const hasMatches = useMemo(() => (data ? hasMatchingNode('Root', data, searchQuery) : false), [data, searchQuery]);

  const handleExpandAll = () => {
    setGlobalExpand(true);
    setRenderKey(prev => prev + 1);
  };

  const handleCollapseAll = () => {
    setGlobalExpand(false);
    setRenderKey(prev => prev + 1);
  };

  if (loading) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center text-foreground-muted">
        <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
        <p className="text-xs font-bold uppercase tracking-widest">Parsing Binary Structure...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <div className="max-w-xl rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 text-center">
          <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-amber-300" />
          <h3 className="mb-2 text-lg font-black text-foreground">Static analysis unavailable</h3>
          <p className="text-sm text-foreground-muted">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center text-foreground-muted opacity-60">
        <FileJson className="mb-4 h-12 w-12" />
        <p className="text-sm font-semibold">No parser data available</p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex min-h-14 items-center justify-between border-b border-border-subtle bg-background-secondary/10 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-foreground-muted">
            <Monitor className="h-4 w-4" />
            <span className="font-bold uppercase tracking-wider">Structure View</span>
            <Badge variant="outline" className="border-primary/20 bg-primary/10 font-mono text-primary">
              {data.format || 'UNKNOWN'}
            </Badge>
            {sha256 && (
              <Badge variant="outline" className="hidden font-mono text-[10px] lg:inline-flex">
                {shortenSha(sha256)}
              </Badge>
            )}
          </div>
          <div className="mx-2 hidden h-8 w-px bg-border-subtle lg:block" />
          <div className="relative hidden w-56 lg:block">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-muted" />
            <Input
              placeholder="Filter fields..."
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              className="h-8 border-border-subtle bg-background/50 pl-8 text-xs"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExpandAll}
            className="h-8 gap-1.5 px-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted hover:text-primary"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Expand
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCollapseAll}
            className="h-8 gap-1.5 px-3 text-[10px] font-bold uppercase tracking-widest text-foreground-muted hover:text-primary"
          >
            <Minimize2 className="h-3.5 w-3.5" />
            Collapse
          </Button>
        </div>
      </div>

      <div className="grid gap-3 border-b border-border-subtle/50 bg-background-secondary/20 p-4 md:grid-cols-2 xl:grid-cols-5">
        {summary.map((item, index) => (
          <SummaryCard key={`${item.label}-${index}`} {...item} />
        ))}
      </div>

      <SectionMap sections={sectionsForMap} totalSize={totalFileSize} />

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-72 shrink-0 border-r border-border-subtle bg-background-secondary/20 lg:flex lg:flex-col">
          <div className="border-b border-border-subtle/50 p-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-foreground-muted">Quick Access</span>
          </div>
          <div className="space-y-4 overflow-y-auto p-3">
            <div className="space-y-1">
              {quickAccessItems.map(item => (
                <button
                  key={item.key}
                  onClick={() => scrollToNode(item.key)}
                  className="group/item flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[11px] font-bold text-foreground-muted transition-all hover:bg-white/[0.05] hover:text-foreground"
                >
                  <item.icon className="h-3.5 w-3.5 text-foreground-muted/50 transition-colors group-hover/item:text-primary" />
                  <span className="truncate">{item.label}</span>
                  <span className="ml-auto text-[9px] font-mono text-foreground-muted/50">{item.count}</span>
                </button>
              ))}
            </div>

            <InsightCard title="Analyst Notes" items={insights} />

            {onSelectField && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Crosshair className="h-3.5 w-3.5 text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-foreground-muted">Hex Sync</span>
                </div>
                <p className="text-xs text-foreground-muted">
                  Click nodes with file offsets to jump the current region in Hex View.
                </p>
              </div>
            )}
          </div>
        </aside>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="border-b border-border-subtle/50 bg-background-secondary/10 px-4 py-3 lg:hidden">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-muted" />
              <Input
                placeholder="Filter fields..."
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                className="h-8 border-border-subtle bg-background/50 pl-8 text-xs"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-card/30 p-6">
            {!hasMatches ? (
              <div className="flex h-full min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-border-subtle bg-background/20 text-center text-foreground-muted">
                <Search className="mb-3 h-8 w-8" />
                <p className="text-sm font-semibold">No fields matched your filter</p>
                <p className="mt-1 text-xs">Try searching for a header name, offset, section, or symbol label.</p>
              </div>
            ) : (
              <NodeRenderer
                key={renderKey}
                label="Root"
                value={data}
                depth={0}
                defaultOpen
                globalExpand={globalExpand}
                onSelectField={onSelectField}
                filter={searchQuery}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const scrollToNode = (label: string, ...fallbacks: string[]) => {
  const tryScroll = (target: string) => {
    const element = document.querySelector(`[data-node-label="${target}"]`);
    if (!element) return false;

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.classList.add('bg-primary/20', 'ring-2', 'ring-primary/50');
    setTimeout(() => element.classList.remove('bg-primary/20', 'ring-2', 'ring-primary/50'), 1500);
    return true;
  };

  if (tryScroll(label)) return;

  for (const fallback of fallbacks) {
    if (tryScroll(fallback)) return;
  }

  toast.info(`Section "${label}" not found in this file format`);
};

interface NodeRendererProps {
  label: string;
  value: any;
  depth: number;
  defaultOpen?: boolean;
  globalExpand: boolean | null;
  onSelectField?: (offset: number, size: number) => void;
  filter?: string;
}

const NodeRenderer = memo(({ label, value, depth, defaultOpen = false, globalExpand, onSelectField, filter }: NodeRendererProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [visibleCount, setVisibleCount] = useState(100);

  useEffect(() => {
    if (globalExpand !== null) {
      setIsOpen(globalExpand);
    }
  }, [globalExpand]);

  useEffect(() => {
    if (filter && hasMatchingNode(label, value, filter) && typeof value === 'object' && value !== null) {
      setIsOpen(true);
    }
  }, [filter, label, value]);

  const isObject = value !== null && typeof value === 'object';
  const isArray = Array.isArray(value);
  const isEnum = isObject && 'value' in value && 'label' in value && Object.keys(value).length === 2;

  const keys = isObject && !isEnum ? Object.keys(value) : [];
  const isEmpty = keys.length === 0;
  const matchesFilter = hasMatchingNode(label, value, filter || '');
  const indent = depth * 16;

  if (!matchesFilter) {
    return null;
  }

  if (!isObject || isEnum) {
    let displayValue: any = String(value);
    let valueColor = 'text-foreground-muted';
    let Icon = Hash;

    if (value === null) {
      displayValue = 'null';
      valueColor = 'text-destructive/50 italic';
    } else if (value === undefined) {
      displayValue = 'undefined';
      valueColor = 'text-destructive/50 italic';
    } else if (typeof value === 'boolean') {
      displayValue = value ? 'true' : 'false';
      valueColor = value ? 'text-emerald-400' : 'text-destructive';
      Icon = Tag;
    } else if (isEnum) {
      displayValue = (
        <span className="flex items-center gap-2">
          <Badge variant="outline" className="h-5 border-primary/20 bg-primary/5 px-1.5 py-0 text-[10px] font-bold text-primary">
            {value.label}
          </Badge>
          <span className="font-mono text-[10px] text-foreground-muted/40">({value.value})</span>
        </span>
      );
      valueColor = 'text-foreground';
      Icon = Tag;
    } else if (typeof value === 'number' || (!Number.isNaN(Number(value)) && typeof value === 'string' && value.length > 8)) {
      const numValue = Number(value);
      const isTimestamp = /time.*stamp/i.test(label) || /date.*stamp/i.test(label);

      if (isTimestamp && numValue > 100000000) {
        const date = new Date(numValue * 1000);
        displayValue = (
          <span className="flex items-center gap-2">
            <span className="whitespace-nowrap font-bold text-cyan-400">{date.toUTCString()}</span>
            <span className="shrink-0 font-mono text-[9px] opacity-40">({formatHex(numValue)})</span>
          </span>
        );
        Icon = Clock;
      } else if (
        numValue > 1000 ||
        label.toLowerCase().includes('addr') ||
        label.toLowerCase().includes('offset') ||
        label.toLowerCase().includes('ptr') ||
        label.toLowerCase().includes('flags')
      ) {
        displayValue = (
          <span className="flex items-center gap-2">
            <span className="font-bold text-cyan-400">{formatHex(numValue)}</span>
            <span className="opacity-40">({numValue})</span>
          </span>
        );
      } else {
        displayValue = String(numValue);
      }

      valueColor = 'text-cyan-400';
    } else if (typeof value === 'string') {
      displayValue = `"${value}"`;
      valueColor = 'text-orange-300';
      Icon = Tag;
    }

    return (
      <div className="select-text rounded-md px-2 py-0.5 transition-colors hover:bg-white/[0.03]" style={{ marginLeft: indent }}>
        <div className="flex items-start gap-2 border-l border-white/[0.03] pl-2">
          <div className="flex min-w-[180px] shrink-0 items-center gap-2 overflow-hidden">
            <Icon className="h-3 w-3 shrink-0 text-foreground-muted/20" />
            <span className="truncate text-[11px] font-semibold text-foreground-muted/70">{label}</span>
            <span className="ml-auto text-foreground-muted/10">:</span>
          </div>
          <div className={cn('flex-1 break-all font-mono text-[11px]', valueColor)}>{displayValue}</div>
        </div>
      </div>
    );
  }

  const Icon = isArray ? List : label === 'Root' ? Binary : Info;
  const hasOffset =
    'offset' in value ||
    'file_offset' in value ||
    'sh_offset' in value ||
    'p_offset' in value ||
    'start' in value ||
    'data_off' in value ||
    'string_ids_off' in value ||
    'pointer_to_raw_data' in value;

  const handleSelect = (event: any) => {
    event.stopPropagation();

    if (onSelectField && hasOffset) {
      const offset = Number(
        value.offset ??
        value.file_offset ??
        value.sh_offset ??
        value.p_offset ??
        value.start ??
        value.data_off ??
        value.string_ids_off ??
        value.pointer_to_raw_data ??
        0
      );
      let size = Number(
        value.size ??
        value.file_size ??
        value.sh_size ??
        value.filesz ??
        value.p_filesz ??
        value.data_size ??
        value.string_ids_size ??
        value.size_of_raw_data ??
        0
      );

      if (!size && 'end' in value && 'start' in value) {
        size = Number(value.end) - Number(value.start);
      }

      onSelectField(offset, Number(size || 1));
    }

    setIsOpen(prev => !prev);
  };

  const handleCopyJson = (event: any) => {
    event.stopPropagation();
    copy(JSON.stringify(value, null, 2));
    toast.success(`Copied ${label} to clipboard`);
  };

  return (
    <div className="select-text">
      <div
        data-node-label={label}
        className={cn(
          'group/header mb-0.5 flex cursor-pointer items-center rounded-md px-2 py-1.5 transition-colors hover:bg-white/[0.05]',
          isOpen && 'bg-white/[0.02]',
          hasOffset && 'border-l-2 border-transparent hover:border-primary/50 hover:bg-primary/10'
        )}
        style={{ marginLeft: indent }}
        onClick={handleSelect}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <div className="flex h-4 w-4 items-center justify-center rounded text-foreground-muted hover:bg-white/10">
            {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </div>
          <Icon className={cn('h-3.5 w-3.5', isOpen ? 'text-primary' : 'text-foreground-muted/60')} />
          <span className={cn('truncate text-xs font-bold', isOpen ? 'text-foreground' : 'text-foreground-muted')}>
            {FRIENDLY_LABELS[label] || label}
          </span>
          <span className="ml-2 font-mono text-[10px] text-foreground-muted/40">
            {isArray ? `[${keys.length}]` : `{${keys.length}}`}
          </span>
          {hasOffset && (
            <Badge variant="outline" className="ml-auto h-4 gap-1 border-primary/20 bg-primary/5 px-1.5 text-[9px] text-primary opacity-0 group-hover/header:opacity-100">
              <Binary className="h-2.5 w-2.5" />
              JUMP
            </Badge>
          )}
        </div>
        <div className="ml-2 flex items-center gap-2 opacity-0 transition-opacity group-hover/header:opacity-100">
          <button onClick={handleCopyJson} className="rounded p-1 text-foreground-muted hover:bg-white/10 hover:text-primary">
            <FileJson className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {isOpen && !isEmpty && (
        <div className="my-0.5 ml-[calc(16px+10px)] border-l border-primary/10 pl-2">
          {keys.slice(0, isArray ? visibleCount : keys.length).map(key => (
            <NodeRenderer
              key={key}
              label={key}
              value={value[key]}
              depth={depth + 1}
              defaultOpen={DEFAULT_OPEN_KEYS.has(key)}
              globalExpand={globalExpand}
              onSelectField={onSelectField}
              filter={filter}
            />
          ))}
          {isArray && keys.length > visibleCount && (
            <button
              onClick={event => {
                event.stopPropagation();
                setVisibleCount(prev => prev + 100);
              }}
              className="mt-2 ml-4 flex items-center gap-2 rounded px-2 py-1 text-[10px] font-black uppercase tracking-widest text-primary transition-all hover:bg-primary/5 hover:text-primary"
            >
              <Plus className="h-3 w-3" />
              Show 100 more items ({keys.length - visibleCount} remaining)
            </button>
          )}
        </div>
      )}

      {isOpen && isEmpty && (
        <div className="ml-[calc(16px+24px)] py-1.5 text-[10px] italic text-foreground-muted/30">
          (empty)
        </div>
      )}
    </div>
  );
}, (prev, next) => (
  prev.label === next.label &&
  prev.value === next.value &&
  prev.depth === next.depth &&
  prev.filter === next.filter &&
  prev.globalExpand === next.globalExpand
));
