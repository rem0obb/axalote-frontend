import { FileCode, Search, Upload, RefreshCw, LayoutGrid, List, Folder, FolderOpen } from 'lucide-react';
import { ErrorDisplay } from '@/components/common/ErrorDisplay';
import { LoadingState } from '@/components/common/LoadingState';
import { useFileRecords } from '@/hooks/useEndpointData';
import { calculateFileStats, ThreatFile } from '@/types/threat.types';
import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { FileUploadDialog } from './FileUploadDialog';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { DockablePanel } from '@/components/layout/DockablePanel';
import { IDATreeView } from '@/components/layout/IDATreeView';
import { cn } from '@/lib/utils';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

interface FilesViewIDAProps {
  onDataUpdate?: (hasData: boolean) => void;
}

export function FilesViewIDA({ onDataUpdate }: FilesViewIDAProps) {
  const navigate = useNavigate();
  const { data: files, isLoading, isError, error, refetch } = useFileRecords();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  // Build tree structure
  const treeNodes = useMemo(() => {
    if (!files) return [];

    // Group by family
    const grouped = files.reduce((acc, file) => {
      const family = file.family || 'Ungrouped';
      if (!acc[family]) acc[family] = [];
      acc[family].push(file);
      return acc;
    }, {} as Record<string, ThreatFile[]>);

    // Convert to tree nodes
    return Object.entries(grouped).map(([family, familyFiles]) => ({
      id: `folder-${family}`,
      label: `${family} (${familyFiles.length})`,
      type: 'folder' as const,
      children: familyFiles.map(file => ({
        id: file.metadata.sha256,
        label: file.filename,
        type: 'file' as const,
        metadata: file,
      })),
    }));
  }, [files]);

  // Filter tree nodes
  const filteredNodes = useMemo(() => {
    if (!searchQuery) return treeNodes;
    
    const query = searchQuery.toLowerCase();
    return treeNodes
      .map(folder => ({
        ...folder,
        children: folder.children?.filter(file =>
          file.label.toLowerCase().includes(query) ||
          file.id.toLowerCase().includes(query)
        ),
      }))
      .filter(folder => folder.children && folder.children.length > 0);
  }, [treeNodes, searchQuery]);

  const stats = calculateFileStats(files || []);
  const selectedFile = files?.find(f => f.metadata.sha256 === selectedFileId);

  if (isLoading) {
    return <LoadingState message="Loading files..." />;
  }

  if (isError) {
    return <ErrorDisplay error={error} onRetry={refetch} />;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="h-8 bg-background-elevated border-b border-border flex items-center justify-between px-2 gap-2">
        <div className="flex items-center gap-2 flex-1">
          <Search className="h-3.5 w-3.5 text-foreground-muted" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-6 text-[11px] bg-background border-border"
          />
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => refetch()}
            className="h-6 px-2 text-[11px]"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setUploadDialogOpen(true)}
            className="h-6 px-2 text-[11px]"
          >
            <Upload className="h-3 w-3 mr-1" />
            Upload
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* Left Panel - File Tree */}
          <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
            <DockablePanel id="file-tree" title="Files">
              <div className="h-full overflow-auto custom-scrollbar">
                <IDATreeView
                  nodes={filteredNodes}
                  selectedId={selectedFileId}
                  onSelect={(node) => {
                    if (node.type === 'file') {
                      setSelectedFileId(node.id);
                    }
                  }}
                />
              </div>
            </DockablePanel>
          </ResizablePanel>

          <ResizableHandle className="w-[1px] bg-border hover:bg-primary/50 transition-colors" />

          {/* Right Panel - File Details */}
          <ResizablePanel defaultSize={70}>
            <DockablePanel
              id="file-details"
              title={selectedFile ? selectedFile.filename : 'File Details'}
            >
              {selectedFile ? (
                <div className="p-2 space-y-2">
                  {/* Quick Info */}
                  <div className="ida-panel p-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-foreground-muted">SHA256:</span>
                      <span className="text-[10px] font-mono text-ida-address">
                        {selectedFile.metadata.sha256.substring(0, 16)}...
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-foreground-muted">Size:</span>
                      <span className="text-[10px] font-mono text-ida-immediate">
                        {(selectedFile.metadata.size / 1024).toFixed(2)} KB
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-foreground-muted">Type:</span>
                      <span className="text-[10px] font-mono text-ida-string">
                        {selectedFile.metadata.mime_type}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-foreground-muted">Family:</span>
                      <span className="text-[10px] font-mono text-ida-function">
                        {selectedFile.family || 'None'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      onClick={() => navigate(`/files/${selectedFile.metadata.sha256}`)}
                      className="h-6 text-[11px] flex-1"
                    >
                      <FileCode className="h-3 w-3 mr-1" />
                      Analyze
                    </Button>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="ida-panel p-2">
                      <div className="text-[10px] text-foreground-muted mb-1">Entropy</div>
                      <div className="text-[14px] font-mono text-ida-immediate">
                        {selectedFile.metadata.entropy?.toFixed(2) || 'N/A'}
                      </div>
                    </div>
                    <div className="ida-panel p-2">
                      <div className="text-[10px] text-foreground-muted mb-1">Verdict</div>
                      <div className="text-[14px] font-mono text-destructive">
                        {selectedFile.verdict_score || 0}%
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-foreground-muted">
                    <FileCode className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    <p className="text-[11px]">Select a file to view details</p>
                  </div>
                </div>
              )}
            </DockablePanel>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Stats Bar */}
      <div className="h-6 bg-background-elevated border-t border-border flex items-center px-2 gap-4 text-[10px]">
        <div className="flex items-center gap-1">
          <FileCode className="h-3 w-3 text-ida-function" />
          <span className="text-foreground-muted">Total:</span>
          <span className="text-foreground font-medium">{stats.totalFiles}</span>
        </div>
        <div className="flex items-center gap-1">
          <Folder className="h-3 w-3 text-ida-label" />
          <span className="text-foreground-muted">Families:</span>
          <span className="text-foreground font-medium">{stats.uniqueFamilies}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-foreground-muted">Storage:</span>
          <span className="text-foreground font-medium">{stats.totalStorage}</span>
        </div>
      </div>

      <FileUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onUploadComplete={() => {
          refetch();
          setUploadDialogOpen(false);
        }}
      />
    </div>
  );
}
