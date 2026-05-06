import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService, ApiError } from '@/services/api.service';
import { ThreatFile, HeartbeatData } from '@/types/threat.types';

export function useEndpointData<T>(endpoint: string, enabled: boolean = true, refreshInterval?: number) {
  return useQuery<T, ApiError>({
    queryKey: ['endpoint', endpoint],
    queryFn: async () => {
      const result = await apiService.request<T>(endpoint);
      if (result.error) {
        throw result.error;
      }
      return result.data as T;
    },
    enabled,
    staleTime: refreshInterval ? 0 : 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchInterval: refreshInterval,
  });
}

export function useFileRecords() {
  return useQuery<ThreatFile[], ApiError>({
    queryKey: ['endpoint', '/axalote/records/files'],
    queryFn: async () => {
      const result = await apiService.request<ThreatFile[] | { data?: ThreatFile[] }>('/axalote/records/files');
      if (result.error) {
        throw result.error;
      }
      // Handle both array response and object with data property
      const data = result.data;
      if (Array.isArray(data)) {
        return data;
      }
      if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
        return data.data;
      }
      // Return empty array if no valid data
      return [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useFileDetail(sha256?: string) {
  return useEndpointData<ThreatFile>(sha256 ? `/axalote/records/files/${sha256}` : '', !!sha256);
}

export function useFileChildren(sha256?: string) {
  return useQuery<ThreatFile[], ApiError>({
    queryKey: ['endpoint', `/axalote/records/files/${sha256}/children`],
    queryFn: async () => {
      if (!sha256) return [];
      const result = await apiService.request<any[]>(`/axalote/records/files/${sha256}/children`);
      if (result.error) throw result.error;

      const rawData = result.data;
      let items: any[] = [];

      if (Array.isArray(rawData)) {
        items = rawData;
      } else if (rawData && typeof rawData === 'object' && 'data' in rawData && Array.isArray((rawData as any).data)) {
        items = (rawData as any).data;
      }

      // API now returns the correct structure, no need to map manually
      return items as ThreatFile[];
    },
    enabled: !!sha256,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRescanFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (sha256: string) => {
      const result = await apiService.rescanFile(sha256);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (data) => {
      // Invalidate file details and children to refresh UI
      if (data?.metadata?.sha256) {
        queryClient.invalidateQueries({ queryKey: ['endpoint', `/axalote/records/files/${data.metadata.sha256}`] });
        queryClient.invalidateQueries({ queryKey: ['endpoint', `/axalote/records/files/${data.metadata.sha256}/children`] });
      }
      queryClient.invalidateQueries({ queryKey: ['endpoint', '/axalote/records/files'] });
    }
  });
}

export function useYaraRules() {
  return useQuery<import('@/types/threat.types').YaraRule[], ApiError>({
    queryKey: ['endpoint', '/axalote/yara/rules'],
    queryFn: async () => {
      const result = await apiService.request<any>('/axalote/yara/rules');
      if (result.error) {
        throw result.error;
      }
      const data = result.data;
      if (Array.isArray(data)) {
        return data;
      }
      if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
        return data.data;
      }
      return [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useYaraRule(identifier: string) {
  return useEndpointData<import('@/types/threat.types').YaraRule>(`/axalote/yara/rules/${identifier}`, !!identifier);
}

export function useYaraSourceFiles() {
  return useQuery<import('@/types/threat.types').YaraSourceFile[], ApiError>({
    queryKey: ['endpoint', '/axalote/yara/rules/files'],
    queryFn: async () => {
      const result = await apiService.request<any>('/axalote/yara/rules/files');
      if (result.error) {
        throw result.error;
      }
      const data = result.data;
      if (Array.isArray(data)) {
        return data;
      }
      if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
        return data.data;
      }
      return [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
export function useHeartbeat() {
  return useEndpointData<HeartbeatData>('/axalote/heartbeat/collect', true, 5000);
}
