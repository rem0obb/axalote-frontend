import { FileCode, Layers, Braces, Search, HardDrive, LayoutGrid, List, Home, Folder } from 'lucide-react';
import { StatCard } from './StatCard';
import { FileTable } from './FileTable';
import { ErrorDisplay } from '@/components/common/ErrorDisplay';
import { LoadingState } from '@/components/common/LoadingState';
import { useFileRecords } from '@/hooks/useEndpointData';
import { calculateFileStats, ThreatFile, getPackerStats } from '@/types/threat.types';
import { ApiError, apiService } from '@/services/api.service';
import { useState, useMemo, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { FileUploadDialog } from './FileUploadDialog';
import { Button } from '@/components/ui/button';
import { FileCard } from './FileCard';
import { FileFolderCard } from './FileFolderCard';
import { useNavigate } from 'react-router-dom';
import { EditFamilyDialog } from './EditFamilyDialog';
import { BulkEditFamilyDialog } from './BulkEditFamilyDialog';
import { ConfirmDeleteDialog } from '@/components/common/ConfirmDeleteDialog';
import { toast } from 'sonner';
import { PackerStats } from './PackerStats';

interface FilesViewProps {
  onDataUpdate?: (hasData: boolean) => void;
}

export function FilesView({ onDataUpdate }: FilesViewProps) {
  const navigate = useNavigate();
  const { data: files, isLoading, isError, error, refetch } = useFileRecords();
  const [searchQuery, setSearchQuery] = useState('');

  // Load view mode from localStorage, default to 'grid'
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    const saved = localStorage.getItem('axalote_files_view_mode');
    return (saved === 'list' || saved === 'grid') ? saved : 'grid';
  });

  // Load current folder from sessionStorage (session-based, not persistent)
  const [currentFolder, setCurrentFolder] = useState<string | null>(() => {
    const saved = sessionStorage.getItem('axalote_current_folder');
    return saved || null;
  });

  // Dialog States
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<ThreatFile | null>(null);
  const [editFamilyDialogOpen, setEditFamilyDialogOpen] = useState(false);
  const [fileToEditFamily, setFileToEditFamily] = useState<ThreatFile | null>(null);

  // Bulk Edit Family State
  const [bulkEditFamilyDialogOpen, setBulkEditFamilyDialogOpen] = useState(false);
  const [familyToEdit, setFamilyToEdit] = useState<string>('');
  const [filesToEditFamily, setFilesToEditFamily] = useState<ThreatFile[]>([]);

  // Tree Construction Logic
  const processedFiles = useMemo(() => {
    if (!files) return [];

    // 1. Create Map of all files
    const fileMap = new Map<string, ThreatFile>();
    // Deep clone to avoid mutating the original query data
    const nodes: ThreatFile[] = files.map(f => ({ ...f, children: [] }));

    nodes.forEach(node => {
      fileMap.set(node.metadata.sha256, node);
    });

    const roots: ThreatFile[] = [];

    // 2. Build Tree
    nodes.forEach(node => {
      if (node.is_dropped && node.dropped_from) {
        const parent = fileMap.get(node.dropped_from);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(node);
        } else {
          // Orphaned child (parent not in current set), treat as root
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    return roots;
  }, [files]);

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return processedFiles;
    
    const query = searchQuery.toLowerCase().trim();

    // Helper to check if a node or its children match
    const matchNode = (node: ThreatFile): boolean => {
      const selfMatch = (
        node.filename.toLowerCase().includes(query) ||
        node.metadata.sha256.toLowerCase().includes(query) ||
        node.metadata.md5.toLowerCase().includes(query) ||
        node.metadata.mime_type.toLowerCase().includes(query) ||
        (node.family && node.family.toLowerCase().includes(query))
      );

      if (selfMatch) return true;

      // If children match, we should keep the parent to show the child
      if (node.children?.some(matchNode)) return true;

      return false;
    };

    return processedFiles.filter(matchNode);
  }, [processedFiles, searchQuery]);

  const contextualFiles = useMemo(() => {
    if (!currentFolder) return filteredFiles;
    
    // When in a folder, filter the already filtered files by family
    return filteredFiles.filter(f => (f.family || 'ungrouped') === currentFolder);
  }, [filteredFiles, currentFolder]);

  const stats = useMemo(() => {
    // Use contextualFiles for stats when in a folder, otherwise use filteredFiles for search context
    const statsFiles = currentFolder ? contextualFiles : (searchQuery.trim() ? filteredFiles : files || []);
    return calculateFileStats(statsFiles);
  }, [files, filteredFiles, contextualFiles, currentFolder, searchQuery]);

  // Grouping Logic for Grid View (keeping it simple for now, distinct from Table)
  const groupedFiles = useMemo(() => {
    // Use contextualFiles if we're in a folder, otherwise use filteredFiles
    const filesToGroup = currentFolder ? contextualFiles : filteredFiles;
    
    return filesToGroup.reduce((acc, file) => {
      const family = file.family || 'ungrouped';
      if (!acc[family]) acc[family] = [];
      acc[family].push(file);
      return acc;
    }, {} as Record<string, ThreatFile[]>);
  }, [filteredFiles, contextualFiles, currentFolder]);

  const families = Object.keys(groupedFiles).filter(f => f !== 'ungrouped').sort();
  const ungroupedFiles = groupedFiles['ungrouped'] || [];

  // Save view mode preference to localStorage
  useEffect(() => {
    localStorage.setItem('axalote_files_view_mode', viewMode);
  }, [viewMode]);

  // Save current folder to sessionStorage
  useEffect(() => {
    if (currentFolder) {
      sessionStorage.setItem('axalote_current_folder', currentFolder);
    } else {
      sessionStorage.removeItem('axalote_current_folder');
    }
  }, [currentFolder]);

  if (isLoading) {
    return <LoadingState message="Fetching file records..." />;
  }

  if (isError) {
    return (
      <ErrorDisplay
        error={error as ApiError}
        endpoint="/axalote/records/files"
        onRetry={() => refetch()}
      />
    );
  }

  // Handlers
  const handleEditFamily = (e: React.MouseEvent, file: ThreatFile) => {
    e.stopPropagation();
    setFileToEditFamily(file);
    setEditFamilyDialogOpen(true);
  };

  const handleBulkEditFamily = (e: React.MouseEvent, family: string) => {
    e.stopPropagation();
    setFamilyToEdit(family);
    setFilesToEditFamily(groupedFiles[family] || []);
    setBulkEditFamilyDialogOpen(true);
  };

  const handleDeleteClick = (e: React.MouseEvent, file: ThreatFile) => {
    e.stopPropagation();
    setFileToDelete(file);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!fileToDelete) return;
    const response = await apiService.deleteFile(fileToDelete.metadata.sha256);
    if (response.error || (response.data && (response.data as any).success === false)) {
      toast.error('Delete failed');
    } else {
      toast.success('File deleted successfully');
      refetch();
    }
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Search Bar & Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted" />
          <Input
            placeholder="Search by filename, SHA256, classification..."
            className="pl-9 bg-background-secondary border-border-subtle focus-visible:ring-0 focus-visible:ring-offset-0 focus:border-foreground/20 focus:bg-background-elevated transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="bg-background-secondary p-1 rounded-lg border border-border-subtle flex items-center">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-background shadow-sm text-primary' : 'text-foreground-muted hover:text-foreground'}`}
              title="List View"
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-background shadow-sm text-primary' : 'text-foreground-muted hover:text-foreground'}`}
              title="Grid View"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
          <FileUploadDialog onUploadSuccess={() => refetch()} />
        </div>
      </div>

      {/* Breadcrumbs (Fixed Header) */}
      {viewMode === 'grid' && (
        <div className="flex items-center gap-2 text-sm text-foreground-muted">
          <button
            onClick={() => setCurrentFolder(null)}
            className={`flex items-center gap-1 hover:text-primary transition-colors ${!currentFolder ? 'font-bold text-foreground' : ''}`}
          >
            <Home size={14} />
            Home
          </button>
          {currentFolder && (
            <>
              <span>/</span>
              <div className="flex items-center gap-1 font-bold text-foreground">
                <Folder size={14} className="text-primary" />
                {currentFolder}
              </div>
            </>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={currentFolder ? "Folder Files" : "Total Files"}
          value={stats.totalFiles}
          icon={FileCode}
          sublabel={
            currentFolder
              ? `In ${currentFolder}`
              : (() => {
                const packerStats = getPackerStats(files || []);
                return packerStats.dropped > 0
                  ? `${packerStats.dropped} dropped`
                  : "Analyzed samples";
              })()
          }
        />
        <StatCard
          label={currentFolder ? "Folder Storage" : "Total Storage"}
          value={`${(stats.totalSize / (1024 * 1024 * 1024)).toFixed(2)} GB`}
          icon={HardDrive}
          sublabel={currentFolder ? `Size of ${currentFolder}` : "Total file size"}
        />
        <StatCard
          label={currentFolder ? "Folder MIME" : "MIME Types"}
          value={stats.mimeTypes.length}
          icon={Layers}
          sublabel={stats.mimeTypes.slice(0, 2).join(', ') || 'None'}
        />
        <StatCard
          label={currentFolder ? "Folder Entropy" : "Avg Entropy"}
          value={stats.avgEntropy}
          icon={Braces}
          sublabel={`${stats.highEntropyCount} high entropy`}
          variant={stats.avgEntropy >= 6 ? 'warning' : 'default'}
        />
      </div>

      {/* Packer Stats - Only show if there are packed/dropped files */}
      <PackerStats files={files || []} />

      {/* Content Area */}
      {viewMode === 'list' ? (
        <FileTable
          files={filteredFiles}
          onFileDeleted={() => refetch()}
          onFileUpdated={() => refetch()}
          className="flex-1 min-h-0"
        />
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-1">
          {currentFolder ? (
            // Folder View
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pb-10">
              {(groupedFiles[currentFolder] || []).map((file, idx) => (
                <FileCard
                  key={`${file.metadata.sha256}-${idx}`}
                  file={file}
                  onClick={() => navigate(`/files/${file.metadata.sha256}`)}
                  onEditFamily={(e) => handleEditFamily(e, file)}
                  onDelete={(e) => handleDeleteClick(e, file)}
                />
              ))}
              {(groupedFiles[currentFolder] || []).length === 0 && (
                <div className="col-span-full py-10 text-center text-foreground-muted">
                  Empty folder
                </div>
              )}
            </div>
          ) : (
            // Root View
            <div className="space-y-6 pb-10">
              {/* Folders Section */}
              {families.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-foreground-muted uppercase tracking-widest pl-1">Folders</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {families.map(family => (
                      <FileFolderCard
                        key={family}
                        name={family}
                        itemCount={groupedFiles[family].length}
                        onClick={() => setCurrentFolder(family)}
                        onEditFamily={(e) => handleBulkEditFamily(e, family)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Files Section */}
              {ungroupedFiles.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-foreground-muted uppercase tracking-widest pl-1">Files</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {ungroupedFiles.map((file, idx) => (
                      <FileCard
                        key={`${file.metadata.sha256}-${idx}`}
                        file={file}
                        onClick={() => navigate(`/files/${file.metadata.sha256}`)}
                        onEditFamily={(e) => handleEditFamily(e, file)}
                        onDelete={(e) => handleDeleteClick(e, file)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {families.length === 0 && ungroupedFiles.length === 0 && (
                <div className="py-20 text-center text-foreground-muted opacity-50">
                  <FileCode className="h-12 w-12 mx-auto mb-3" />
                  <p>No files found</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Dialogs */}
      <EditFamilyDialog
        open={editFamilyDialogOpen}
        onOpenChange={setEditFamilyDialogOpen}
        file={fileToEditFamily}
        onSuccess={() => {
          refetch();
        }}
      />

      <BulkEditFamilyDialog
        open={bulkEditFamilyDialogOpen}
        onOpenChange={setBulkEditFamilyDialogOpen}
        currentFamily={familyToEdit}
        files={filesToEditFamily}
        onSuccess={() => {
          refetch();
        }}
      />

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Delete File"
        description="This action cannot be undone."
        itemName={fileToDelete?.filename}
      />
    </div>
  );
}
