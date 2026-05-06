import { LucideIcon } from 'lucide-react';

export interface EndpointConfig {
  id: string;
  name: string;
  path: string;
  uiPath: string;
  icon: LucideIcon;
  description: string;
  enabled: boolean;
  category: 'endpoints' | 'intelligence' | 'system';
}

export interface FileMetadata {
  md5: string;
  sha1: string;
  sha256: string;
  mime_type: string;
  entropy: number;
  size?: number; // Size in bytes
}

export interface ThreatFile {
  metadata: FileMetadata;
  filename: string;
  iocs: string[];
  description: string;
  tags: string[];
  family?: string;
  // Packer fields
  is_packed?: boolean;
  packer?: string | null;
  // Dropped file fields
  is_dropped?: boolean;
  dropped_from?: string | null;
  dropped_path?: string | null;
  // UI tree structure
  children?: ThreatFile[];
}

export interface DroppedFileInfo {
  sha256: string;
  filename: string;
  type: string;
  mime_type: string;
}

export interface FileUploadResponse {
  success: boolean;
  message: string;
  sha256: string;
  filename: string;
  size: number;
  type: string;
  dropped?: DroppedFileInfo[];
}

export interface DroppedFilesResponse {
  parent_sha256: string;
  dropped_files: ThreatFile[];
}

export interface FileStats {
  totalFiles: number;
  uniqueSha256: number;
  mimeTypes: string[];
  avgEntropy: number;
  highEntropyCount: number;
  totalSize: number; // Total size in bytes
}

export interface YaraRuleString {
  identifier: string;
  flags: number;
  length: number;
}

export interface YaraRuleMeta {
  identifier: string;
  type: number;
  flags: number;
  value: string | number;
}

export interface YaraRule {
  identifier: string;
  namespace?: any; // Can be string or { name: string }
  flags: number;
  num_atoms: number;
  required_strings: number;
  tags: any; // API returns inconsistent types (Object vs Array)
  strings: Record<string, any>; // Complex objects like YaraRuleString
  metas: Record<string, any>; // Complex objects like YaraRuleMeta
}

export interface YaraSourceFile {
  id: number | string;
  content: string;
  namespace: string;
  file: string;
}

export interface YaraScanResult {
  success: boolean;
  match: boolean;
  rules: string[];
  message?: string;
  diagnostics?: YaraDiagnostic[];
  errors?: YaraDiagnostic[];
  warnings?: YaraDiagnostic[];
  logs?: string[];
  modules?: string[];
}

export interface StringScanOptions {
  min_length?: number;
  max_length?: number;
  encoding?: 'ascii' | 'utf8' | 'utf16le' | 'utf16be' | 'utf32le' | 'utf32be' | 'wide';
  char_type?: 'printable' | 'alphanumeric' | 'all';
  null_terminated?: boolean;
}

export interface StringMatch {
  offset: number;
  value: string;
  encoding: string;
  length?: number;
  type?: string; // e.g., 'url', 'ip', etc.
  confidence?: string; // 'high' | 'medium' | 'low'
}

export interface StringScanResponse {
  success: boolean;
  count: number;
  data: {
    iocs: StringMatch[];
    strings: StringMatch[];
  };
}

export interface YaraHuntMatch {
  filename: string;
  rules: string[];
  sha256: string;
}

export interface YaraDiagnostic {
  level?: 'error' | 'warning' | string;
  file_name?: string | null;
  path?: string | null;
  relative_path?: string | null;
  namespace?: string | null;
  line_number?: number | null;
  rule?: string | null;
  message: string;
  content?: string | null;
  source_line?: string | null;
}

export interface YaraLoadRuleResponse {
  success: boolean;
  message: string;
  diagnostics?: YaraDiagnostic[];
  errors?: YaraDiagnostic[];
  warnings?: YaraDiagnostic[];
  rule?: {
    namespace: string;
    name: string;
  };
}

export interface YaraHuntResponse {
  success: boolean;
  message?: string;
  files?: YaraHuntMatch[];
  diagnostics?: YaraDiagnostic[];
  errors?: YaraDiagnostic[];
  warnings?: YaraDiagnostic[];
}

export interface HeartbeatData {
  cpu: {
    usage: number;
    cores: number;
  };
  loadavg: number[];
  timestamp: number;
  uptime: number;
  disk: {
    used: number;
    total: number;
    free: number;
  };
  process: {
    cpu_time: number;
  };
  memory: {
    total: number;
    free: number;
    used: number;
  };
}

export function calculateFileStats(files: ThreatFile[]): FileStats {
  if (!files.length) {
    return {
      totalFiles: 0,
      uniqueSha256: 0,
      mimeTypes: [],
      avgEntropy: 0,
      highEntropyCount: 0,
      totalSize: 0,
    };
  }

  const sha256Set = new Set(files.map(f => f.metadata.sha256));
  const mimeSet = new Set(files.map(f => f.metadata.mime_type));
  const totalEntropy = files.reduce((sum, f) => sum + f.metadata.entropy, 0);
  const highEntropy = files.filter(f => f.metadata.entropy >= 7).length;
  const totalSizeBytes = files.reduce((sum, f) => sum + (f.metadata.size || 0), 0);

  return {
    totalFiles: files.length,
    uniqueSha256: sha256Set.size,
    mimeTypes: Array.from(mimeSet),
    avgEntropy: Number((totalEntropy / files.length).toFixed(2)),
    highEntropyCount: highEntropy,
    totalSize: totalSizeBytes,
  };
}

// Build file tree from dropped files
export function buildFileTree(files: ThreatFile[]): ThreatFile[] {
  const fileMap = new Map<string, ThreatFile>();
  const roots: ThreatFile[] = [];

  // First pass: create map of all files
  files.forEach(file => {
    fileMap.set(file.metadata.sha256, { ...file, children: [] });
  });

  // Second pass: build tree structure
  files.forEach(file => {
    const fileNode = fileMap.get(file.metadata.sha256);
    if (!fileNode) return;

    if (file.is_dropped && file.dropped_from) {
      const parent = fileMap.get(file.dropped_from);
      if (parent) {
        if (!parent.children) parent.children = [];
        parent.children.push(fileNode);
      } else {
        // Parent not in list, treat as root
        roots.push(fileNode);
      }
    } else {
      // Not a dropped file, it's a root
      roots.push(fileNode);
    }
  });

  return roots;
}

// Get packer statistics
export function getPackerStats(files: ThreatFile[]) {
  const stats = {
    total: files.length,
    packed: files.filter(f => f.is_packed).length,
    dropped: files.filter(f => f.is_dropped).length,
    packers: {
      zip: files.filter(f => f.packer?.toLowerCase().includes('zip')).length,
      donut: files.filter(f => f.packer?.toLowerCase().includes('donut')).length,
      iso: files.filter(f => f.packer?.toLowerCase().includes('iso')).length,
      pdf: files.filter(f => f.packer?.toLowerCase().includes('pdf')).length,
    }
  };
  return stats;
}

// Get packer badge color
export function getPackerBadgeColor(packer: string): string {
  const packerLower = packer.toLowerCase();
  if (packerLower.includes('zip')) return 'blue';
  if (packerLower.includes('iso')) return 'purple';
  if (packerLower.includes('donut')) return 'red';
  if (packerLower.includes('pdf')) return 'orange';
  return 'gray';
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

export interface EngineScannerConfig {
  records: {
    path: string;
    extension: string;
  };
  yara: {
    rules: string;
    rules_backup: string;
  };
  family: {
    sigs: string;
    extensions: string;
  };
}

export interface EngineServerConfig {
  host: string;
  port: number;
  timeout: number;
  headers: Record<string, string>;
}

export interface EngineVTConfig {
  api_key: string;
}

export interface EngineConfig {
  log: Record<string, any>;
  scanner: EngineScannerConfig;
  server: EngineServerConfig;
  virustotal?: EngineVTConfig;
  version: string;
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  source: string;
  message: string;
}

export interface LogsResponse {
  success: boolean;
  logs: LogEntry[];
}

export interface VTAnalysis {
  malicious: number;
  suspicious: number;
  undetected: number;
  harmless: number;
  timeout: number;
  'confirmed-timeout': number;
  failure: number;
  'type-unsupported': number;
}

export interface VTEngineResult {
  category: string;
  engine_name: string;
  engine_version: string;
  result: string | null;
  method: string;
  engine_update: string;
}

export interface VTFileReport {
  sha256: string;
  md5: string;
  sha1: string;
  size: number;
  type_description: string;
  type_tag: string;
  first_submission_date: number;
  last_submission_date: number;
  last_analysis_date: number;
  last_analysis_stats: VTAnalysis;
  last_analysis_results: Record<string, VTEngineResult>;
  reputation: number;
  times_submitted: number;
  total_votes: {
    harmless: number;
    malicious: number;
  };
  popular_threat_classification?: {
    suggested_threat_label: string;
    popular_threat_category: Array<{
      count: number;
      value: string;
    }>;
    popular_threat_name: Array<{
      count: number;
      value: string;
    }>;
  };
  names?: string[];
  tags?: string[];
}

export interface VTSearchResponse {
  success: boolean;
  data?: VTFileReport;
  error?: string;
  message?: string;
}

export interface VTDownloadResponse {
  success: boolean;
  message?: string;
  sha256?: string;
  filename?: string;
  size?: number;
  error?: string;
}
