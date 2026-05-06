/**
 * AXALOTE API Service
 * Centralized service for consuming Threat Intelligence endpoints
 */
import { YaraRule, YaraHuntMatch, YaraHuntResponse, YaraLoadRuleResponse, YaraScanResult, HeartbeatData, EngineConfig, LogsResponse, MCPTool } from '@/types/threat.types';
import { getEngineBaseUrl, normalizeEngineBaseUrl } from '@/lib/engine-config';

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  data?: any;
}

export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
}

export interface DeobfuscatorMetadata {
  changes: number;
  iterations: number;
  detected_signatures: string[];
  warnings?: string[];
  passes: Array<{
    pass: string;
    changes: number;
  }>;
}

export interface DeobfuscatorResult {
  success: boolean;
  result: {
    code: string;
    engine: string;
    metadata: DeobfuscatorMetadata;
  };
}

export interface PluginPayload {
  name: string;
  code: string;
}

import { ParserResponse } from '@/types/parser.types';

class ApiService {
  private baseUrlOverride?: string;

  constructor(baseUrl?: string) {
    this.baseUrlOverride = baseUrl ? normalizeEngineBaseUrl(baseUrl) : undefined;
  }

  private resolveBaseUrl() {
    return this.baseUrlOverride ?? getEngineBaseUrl();
  }

  async request<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    const url = `${this.resolveBaseUrl()}${endpoint}`;

    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          ...options?.headers,
        },
        ...options,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        return {
          data: null,
          error: {
            message: data?.message || data?.error || `HTTP ${response.status}: ${response.statusText}`,
            status: response.status,
            code: data?.code,
            data: data,
          },
        };
      }

      return { data, error: null };
    } catch (error) {
      return {
        data: null,
        error: {
          message: error instanceof Error
            ? `${error.message} (${this.resolveBaseUrl()})`
            : `Network error: Unable to connect to ${this.resolveBaseUrl()}`,
          status: 0,
          code: 'NETWORK_ERROR',
        },
      };
    }
  }

  async scanFileWithYara(sha256: string): Promise<ApiResponse<YaraScanResult>> {
    return this.request('/axalote/yara/scan', {
      method: 'POST',
      body: JSON.stringify({ sha256 }),
    });
  }

  async uploadFile(base64Content: string, originalFilename: string = 'uploaded_file.bin'): Promise<ApiResponse<{ success: boolean; message: string; sha256: string; filename: string; type: string; dropped: any[] }>> {
    return this.request('/axalote/records/files/upload', {
      method: 'POST',
      body: JSON.stringify({
        file: base64Content,
        is_encoded: true,
        filename: originalFilename
      }),
    });
  }

  async rescanFile(sha256: string): Promise<ApiResponse<any>> {
    return this.request('/axalote/records/files/rescan', {
      method: 'POST',
      body: JSON.stringify({ sha256 }),
    });
  }

  async getFileChildren(sha256: string): Promise<ApiResponse<any[]>> {
    return this.request<any[]>(`/axalote/records/files/${sha256}/children`);
  }

  async getDroppedFiles(sha256: string): Promise<ApiResponse<{ parent_sha256: string; dropped_files: any[] }>> {
    return this.request<{ parent_sha256: string; dropped_files: any[] }>(`/axalote/records/files/${sha256}/dropped`);
  }

  async getFileMetadata(sha256: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/axalote/records/files/${sha256}`);
  }

  async getFiles(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/axalote/records/files');
  }

  async loadYaraRules(
    rules: string,
    newRule: { namespace: string; name: string },
    oldRule?: { namespace: string; name: string }
  ): Promise<ApiResponse<YaraLoadRuleResponse>> {
    return this.request('/axalote/yara/load/rules', {
      method: 'POST',
      body: JSON.stringify({
        rules,
        new_rule: newRule,
        old_rule: oldRule
      }),
    });
  }

  async deleteYaraRuleFile(ruleFilename: string, namespace: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request('/axalote/yara/rules/files/delete', {
      method: 'POST',
      body: JSON.stringify({
        rule: ruleFilename,
        namespace
      }),
    });
  }

  async getYaraRules(): Promise<ApiResponse<YaraRule[]>> {
    return this.request<YaraRule[]>('/axalote/yara/rules');
  }

  async getYaraRule(identifier: string): Promise<ApiResponse<YaraRule>> {
    return this.request<YaraRule>(`/axalote/yara/rules/${identifier}`);
  }

  async huntYara(rule: string): Promise<ApiResponse<YaraHuntResponse>> {
    return this.request('/axalote/hunt/yara', {
      method: 'POST',
      body: JSON.stringify({ rule }),
    });
  }

  async extractStrings(sha256: string, options?: any): Promise<ApiResponse<{ success: boolean; count: number; data: { iocs: any[]; strings: any[] } }>> {
    return this.request('/axalote/strings/scan', {
      method: 'POST',
      body: JSON.stringify({ sha256, options }),
    });
  }

  /**
   * Deobfuscator endpoints - JS driver executes multiple passes in loop:
   * - hex_numbers: converts hex literals (0x41 → 65)
   * - string_array: inlines string arrays (_0x1a2b[0] → 'hello')
   * - eval_globals: resolves calls like atob, String.fromCharCode, unescape
   * - dead_code: removes obvious dead branches (if("a" === "a"){T}else{F} → T)
   * - control_flow_switch: undoes switch/while based flattening
   */
  async deobfuscate(code: string, language: string, options: Record<string, any> = {}): Promise<ApiResponse<DeobfuscatorResult>> {
    return this.request<DeobfuscatorResult>('/axalote/deobfuscate', {
      method: 'POST',
      body: JSON.stringify({ code, language, options }),
    });
  }

  async deobfuscateFile(sha256: string, language?: string, options: Record<string, any> = {}): Promise<ApiResponse<DeobfuscatorResult>> {
    return this.request<DeobfuscatorResult>('/axalote/deobfuscate', {
      method: 'POST',
      body: JSON.stringify({ sha256, language, options }),
    });
  }

  async getDeobfuscationLanguages(): Promise<ApiResponse<{ success: boolean; languages: string[] }>> {
    return this.request<{ success: boolean; languages: string[] }>('/axalote/deobfuscate/languages');
  }

  async loadPlugin(payload: PluginPayload): Promise<ApiResponse<{ success: boolean }>> {
    return this.request('/axalote/plugins/load', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getPlugin(name: string): Promise<ApiResponse<{ success: boolean; plugin: any; code: string }>> {
    return this.request<{ success: boolean; plugin: any; code: string }>(`/axalote/plugins/${encodeURIComponent(name)}`);
  }

  async pausePlugin(name: string): Promise<ApiResponse<{ success: boolean; name: string; paused: boolean }>> {
    return this.request<{ success: boolean; name: string; paused: boolean }>(`/axalote/plugins/${encodeURIComponent(name)}/pause`, {
      method: 'POST',
    });
  }

  async resumePlugin(name: string): Promise<ApiResponse<{ success: boolean; name: string; paused: boolean }>> {
    return this.request<{ success: boolean; name: string; paused: boolean }>(`/axalote/plugins/${encodeURIComponent(name)}/resume`, {
      method: 'POST',
    });
  }

  async updatePlugin(name: string, code: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request(`/axalote/plugins/${encodeURIComponent(name)}`, {
      method: 'PUT',
      body: JSON.stringify({ code }),
    });
  }

  async execPluginCode(code: string): Promise<ApiResponse<{ success: boolean; result: any; output: string[] }>> {
    return this.request<{ success: boolean; result: any; output: string[] }>('/axalote/plugins/exec', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async getPluginAutocomplete(): Promise<ApiResponse<{ success: boolean; data: any }>> {
    return this.request<{ success: boolean; data: any }>('/axalote/plugins/autocomplete');
  }

  async listPlugins(): Promise<ApiResponse<{ success: boolean; plugins: string[] }>> {
    return this.request<{ success: boolean; plugins: string[] }>('/axalote/plugins/list');
  }

  async deletePlugin(name: string): Promise<ApiResponse<{ success: boolean }>> {
    return this.request(`/axalote/plugins/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
  }

  async updateFileMetadata(sha256: string, metadata: any): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request('/axalote/records/files/update', {
      method: 'POST',
      body: JSON.stringify({ sha256, metadata }),
    });
  }

  async deleteFile(sha256: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request('/axalote/records/files/delete', {
      method: 'POST',
      body: JSON.stringify({ sha256 }),
    });
  }

  async downloadFile(sha256: string, onProgress?: (progress: number) => void): Promise<ApiResponse<{ buff: string }>> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${this.resolveBaseUrl()}/axalote/records/files/download`);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('ngrok-skip-browser-warning', 'true');

      xhr.upload.onprogress = (event) => {
        // Upload progress (sending the request) - usually fast for small payloads
      };

      xhr.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percentComplete = (event.loaded / event.total) * 100;
          onProgress(percentComplete);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve({ data: data, error: null });
          } catch (e) {
            resolve({
              data: null,
              error: { message: 'Invalid JSON response', status: xhr.status, code: 'PARSE_ERROR' }
            });
          }
        } else {
          let errorMessage = `HTTP ${xhr.status}: ${xhr.statusText}`;
          try {
            const errorData = JSON.parse(xhr.responseText);
            if (errorData?.message) errorMessage = errorData.message;
          } catch { }

          resolve({
            data: null,
            error: { message: errorMessage, status: xhr.status, code: 'HTTP_ERROR' }
          });
        }
      };

      xhr.onerror = () => {
        resolve({
          data: null,
          error: { message: 'Network error', status: 0, code: 'NETWORK_ERROR' }
        });
      };

      xhr.send(JSON.stringify({ sha256 }));
    });
  }

  async getHeartbeat(): Promise<ApiResponse<HeartbeatData>> {
    return this.request<HeartbeatData>('/axalote/heartbeat/collect');
  }

  async getTools(): Promise<ApiResponse<{ success: boolean; count: number; tools: MCPTool[] }>> {
    return this.request<{ success: boolean; count: number; tools: MCPTool[] }>('/axalote/tools');
  }

  async callMcp<T = any>(payload: Record<string, any>): Promise<ApiResponse<T>> {
    return this.request<T>('/axalote/mcp', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async callTool(name: string, args: Record<string, any>): Promise<ApiResponse<{ success: boolean; result: any }>> {
    return this.request('/axalote/tools/call', {
      method: 'POST',
      body: JSON.stringify({ name, args }),
    });
  }

  async getEngineConfig(): Promise<ApiResponse<EngineConfig>> {
    return this.request<EngineConfig>('/axalote/config/view');
  }

  async updateEngineConfig(payload: any): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request('/axalote/config/edit', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
  async restartEngine(): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request('/axalote/engine/restart', {
      method: 'POST',
    });
  }

  getBaseUrl() {
    return this.resolveBaseUrl();
  }

  async getLogs(): Promise<ApiResponse<LogsResponse>> {
    return this.request<LogsResponse>('/axalote/logs/trace');
  }

  async getParserFile(sha256: string): Promise<ApiResponse<ParserResponse>> {
    return this.request('/axalote/parser/file', {
      method: 'POST',
      body: JSON.stringify({ sha256 }),
    });
  }

  async vtGetFileReport(hash: string): Promise<ApiResponse<any>> {
    return this.request(`/axalote/vt/files/${hash}`);
  }

  async vtGetFileInfo(hash: string): Promise<ApiResponse<any>> {
    return this.vtGetFileReport(hash);
  }

  async vtCheckFile(hash: string): Promise<ApiResponse<{ exists: boolean }>> {
    const response = await this.vtGetFileReport(hash);
    if (response.error) {
      // If it's a 404, the file just doesn't exist on VT, which is a valid "negative" result
      if (response.error.status === 404) {
        return { data: { exists: false }, error: null };
      }
      // For other errors (network, 500, etc.), propagate the error
      return { data: null, error: response.error };
    }
    return { data: { exists: true }, error: null };
  }

  async vtGetFileBehaviour(hash: string): Promise<ApiResponse<any>> {
    return this.request(`/axalote/vt/files/${hash}/behaviour`);
  }

  async vtGetBehaviour(hash: string): Promise<ApiResponse<any>> {
    return this.vtGetFileBehaviour(hash);
  }

  async vtDownloadFile(hash: string): Promise<ApiResponse<any>> {
    return this.request('/axalote/vt/files/download', {
      method: 'POST',
      body: JSON.stringify({ hash }),
    });
  }
}

export const apiService = new ApiService();
export default apiService;
