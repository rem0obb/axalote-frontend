import { ThreatFile } from '@/types/threat.types';
import { memo, useState, Fragment } from 'react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { apiService } from '@/services/api.service';
import { toast } from 'sonner';
import { ConfirmDeleteDialog } from '@/components/common/ConfirmDeleteDialog';
import { Progress } from '@/components/ui/progress';
import { ChevronRight, ChevronDown, Folder, Edit2, Bug, FileCode, Download, Trash2 } from 'lucide-react';
import { EditFamilyDialog } from './EditFamilyDialog';
import { BulkEditFamilyDialog } from './BulkEditFamilyDialog';

interface FileTableProps {
  files: ThreatFile[];
  onFileDeleted?: () => void;
  onFileUpdated?: () => void;
  className?: string;
}

import { EntropyIndicator } from './EntropyIndicator';
import { CopyableHash } from './CopyableHash';

export function FileTable({ files, onFileDeleted, onFileUpdated, className }: FileTableProps) {
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<ThreatFile | null>(null);

  // Family Edit State
  const [editFamilyDialogOpen, setEditFamilyDialogOpen] = useState(false);
  const [fileToEditFamily, setFileToEditFamily] = useState<ThreatFile | null>(null);

  // Bulk Family Edit State
  const [bulkEditFamilyDialogOpen, setBulkEditFamilyDialogOpen] = useState(false);
  const [familyToEdit, setFamilyToEdit] = useState<string>('');
  const [filesToEditFamily, setFilesToEditFamily] = useState<ThreatFile[]>([]);

  // Grouping State
  const [expandedFamilies, setExpandedFamilies] = useState<Record<string, boolean>>({});

  const toggleFamily = (family: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFamilies(prev => ({ ...prev, [family]: !prev[family] }));
  };

  const handleEditFamily = (e: React.MouseEvent, file: ThreatFile) => {
    e.stopPropagation();
    setFileToEditFamily(file);
    setEditFamilyDialogOpen(true);
  };

  const handleBulkEditFamily = (e: React.MouseEvent, family: string, files: ThreatFile[]) => {
    e.stopPropagation();
    setFamilyToEdit(family);
    setFilesToEditFamily(files);
    setBulkEditFamilyDialogOpen(true);
  };

  // Group files logic
  const groupedFiles = files.reduce((acc, file) => {
    const family = file.family || 'ungrouped';
    if (!acc[family]) acc[family] = [];
    acc[family].push(file);
    return acc;
  }, {} as Record<string, ThreatFile[]>);

  const sortedFamilies = Object.keys(groupedFiles).sort((a, b) => {
    if (a === 'ungrouped') return 1;
    if (b === 'ungrouped') return -1;
    return a.localeCompare(b);
  });

  const handleDeleteClick = (e: React.MouseEvent, file: ThreatFile) => {
    e.stopPropagation();
    setFileToDelete(file);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!fileToDelete) return;

    const response = await apiService.deleteFile(fileToDelete.metadata.sha256);
    if (response.error) {
      toast.error(`Delete failed: ${response.error.message}`);
      throw new Error(response.error.message);
    } else if (response.data && (response.data as any).success === false) {
      toast.error(`Delete failed: ${(response.data as any).message || 'Unknown error'}`);
      throw new Error((response.data as any).message);
    } else {
      toast.success('File deleted successfully');
      onFileDeleted?.();
    }
  };

  if (!files.length) {
    return (
      <div className="bg-card border border-border-subtle rounded-lg p-12 text-center">
        <FileCode className="h-10 w-10 text-foreground-muted mx-auto mb-3" />
        <p className="text-foreground-muted">No records available</p>
      </div>
    );
  }

  return (
    <div className={cn("bg-card border border-border-subtle rounded-lg overflow-hidden flex flex-col", className)}>
      <div className="overflow-auto flex-1 custom-scrollbar">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border-subtle bg-background-secondary">
              <th className="text-left py-3 px-4 text-xs font-medium text-foreground-muted uppercase tracking-wide">Filename</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-foreground-muted uppercase tracking-wide">SHA256</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-foreground-muted uppercase tracking-wide">MD5</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-foreground-muted uppercase tracking-wide">MIME Type</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-foreground-muted uppercase tracking-wide">Size</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-foreground-muted uppercase tracking-wide">Entropy</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-foreground-muted uppercase tracking-wide">Tags</th>
              <th className="text-left py-3 px-4 text-xs font-medium text-foreground-muted uppercase tracking-wide w-16">Actions</th>
            </tr>
          </thead>
          <tbody>

            {sortedFamilies.map(family => {
              if (family === 'ungrouped') {
                return groupedFiles[family].map((file, idx) => (
                  <FileRow
                    key={`${file.metadata.sha256}-${idx}`}
                    file={file}
                    navigate={navigate}
                    handleEditFamily={handleEditFamily}
                    handleDeleteClick={handleDeleteClick}
                  />
                ));
              }

              const isExpanded = expandedFamilies[family];
              const familyFiles = groupedFiles[family];

              return (
                <Fragment key={`family-group-${family}`}>
                  <tr
                    key={`family-${family}`}
                    className="border-b border-border-subtle hover:bg-background-secondary/50 cursor-pointer group transition-colors"
                    onClick={(e) => toggleFamily(family, e)}
                  >
                    <td colSpan={8} className="py-2 px-4">
                      <div className="flex items-center gap-2 justify-between">
                        <div className="flex items-center gap-2">
                          <div className="text-foreground-muted group-hover:text-primary transition-colors">
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </div>
                          <Folder className="h-4 w-4 text-primary fill-primary/20" />
                          <span className="font-bold text-foreground text-sm">{family}</span>
                          <span className="text-xs text-foreground-muted bg-background-secondary px-2 py-0.5 rounded-full border border-border-subtle">
                            {familyFiles.length} items
                          </span>
                        </div>
                        <button
                          onClick={(e) => handleBulkEditFamily(e, family, familyFiles)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-background-elevated rounded-lg transition-all text-foreground-muted hover:text-primary"
                          title="Rename all files in this family"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && familyFiles.map((file, idx) => (
                    <FileRow
                      key={`${file.metadata.sha256}-${idx}`}
                      file={file}
                      navigate={navigate}
                      handleEditFamily={handleEditFamily}
                      handleDeleteClick={handleDeleteClick}
                    />
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <EditFamilyDialog
        open={editFamilyDialogOpen}
        onOpenChange={setEditFamilyDialogOpen}
        file={fileToEditFamily}
        onSuccess={() => {
          onFileUpdated?.();
        }}
      />

      <BulkEditFamilyDialog
        open={bulkEditFamilyDialogOpen}
        onOpenChange={setBulkEditFamilyDialogOpen}
        currentFamily={familyToEdit}
        files={filesToEditFamily}
        onSuccess={() => {
          onFileUpdated?.();
        }}
      />

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Delete File"
        description="This action cannot be undone. This will permanently delete the file and all associated data from the database."
        itemName={fileToDelete?.filename}
      />
    </div>
  );
}

// Extracted FileRow component to keep the main component cleaner
const FileRow = memo(({
  file,
  navigate,
  handleEditFamily,
  handleDeleteClick,
  level = 0
}: {
  file: ThreatFile,
  navigate: any,
  handleEditFamily: (e: React.MouseEvent, file: ThreatFile) => void,
  handleDeleteClick: (e: React.MouseEvent, file: ThreatFile) => void,
  level?: number
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = file.children && file.children.length > 0;

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <>
      <tr
        onClick={() => navigate(`/files/${file.metadata.sha256}`)}
        className={cn(
          "border-b border-border-subtle last:border-0 hover:bg-primary/5 transition-colors cursor-pointer",
          level > 0 && "bg-background-secondary/10"
        )}
      >
        <td className="py-3 px-4">
          <div className="flex items-center gap-2" style={{ paddingLeft: `${level * 24}px` }}>
            {/* Indentation guides could go here */}

            {hasChildren ? (
              <button
                onClick={toggleExpand}
                className="p-0.5 rounded hover:bg-background-elevated text-foreground-muted"
              >
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            ) : (
              <div className="w-5" /> // Spacer for alignment
            )}

            <FileCode className={cn("h-4 w-4 shrink-0", file.children?.length ? "text-primary" : "text-foreground-muted")} />

            <span className="text-foreground font-medium truncate max-w-[200px]" title={file.filename}>
              {file.filename || '—'}
            </span>

            {/* Packer Badge - sem emoji */}
            {file.is_packed && file.packer && (
              <span className="text-[9px] bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 dark:text-yellow-400 px-1.5 py-0.5 rounded ml-2 uppercase tracking-tight font-bold">
                {file.packer}
              </span>
            )}

            {/* Dropped Badge - Verde sem emoji */}
            {file.is_dropped && (
              <span className="text-[9px] bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded ml-2 uppercase tracking-tight font-bold">
                Extracted
              </span>
            )}

            {/* Family Badge */}
            {file.family && level === 0 && (
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded ml-2">
                {file.family}
              </span>
            )}
          </div>
        </td>
        <td className="py-3 px-4">
          <CopyableHash hash={file.metadata.sha256} />
        </td>
        <td className="py-3 px-4">
          <CopyableHash hash={file.metadata.md5} />
        </td>
        <td className="py-3 px-4">
          <span className="text-xs font-mono text-foreground-muted">
            {file.metadata.mime_type}
          </span>
        </td>
        <td className="py-3 px-4">
          <span className="text-xs font-mono text-foreground-muted">
            {file.metadata.size
              ? (file.metadata.size < 1024
                ? `${file.metadata.size} B`
                : `${(file.metadata.size / 1024).toFixed(1)} KB`)
              : '—'}
          </span>
        </td>
        <td className="py-3 px-4">
          <EntropyIndicator value={file.metadata.entropy} />
        </td>
        <td className="py-3 px-4">
          <div className="flex gap-1 flex-wrap">
            {Array.isArray(file.tags) && file.tags.filter(Boolean).length > 0 ? (
              file.tags.filter(Boolean).slice(0, 3).map((tag, i) => (
                <span
                  key={i}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-foreground-muted"
                >
                  {tag}
                </span>
              ))
            ) : (
              <span className="text-foreground-muted">—</span>
            )}
          </div>
        </td>
        <td className="py-3 px-4">
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => handleEditFamily(e, file)}
              className="p-1.5 hover:bg-background-secondary rounded-lg transition-all text-foreground-muted/40 hover:text-primary active:scale-90"
              title="Edit Family"
            >
              <Bug className="h-4 w-4" />
            </button>
            <button
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  const toastId = toast.custom((t) => (
                    <div className="bg-background-secondary border border-border-subtle p-4 rounded-lg shadow-lg w-[320px]">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Download className="h-4 w-4 text-primary animate-bounce" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-foreground truncate">Downloading File</h4>
                          <p className="text-[10px] text-foreground-muted uppercase tracking-wider font-medium truncate" title={file.filename}>
                            {file.filename || 'Unknown Object'}
                          </p>
                        </div>
                      </div>

                      <Progress value={0} className="h-1.5 bg-background-primary/50" indicatorClassName="bg-primary" id={`progress-${file.metadata.sha256}`} />
                    </div>
                  ), { duration: Infinity });

                  const updateProgress = (progress: number) => {
                    const progressBar = document.getElementById(`progress-${file.metadata.sha256}`);
                    if (progressBar && progressBar.firstElementChild) {
                      (progressBar.firstElementChild as HTMLElement).style.transform = `translateX(-${100 - progress}%)`;
                    }
                  };

                  const response = await apiService.downloadFile(file.metadata.sha256, updateProgress);

                  if (response.error || !response.data) {
                    toast.dismiss(toastId);
                    throw new Error(response.error?.message || 'Download failed');
                  }

                  const binaryString = window.atob(response.data.buff);
                  const bytes = new Uint8Array(binaryString.length);
                  for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                  }

                  const blob = new Blob([bytes], { type: 'application/octet-stream' });
                  const url = window.URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = file.filename || `file-${file.metadata.sha256.substring(0, 8)}.bin`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  window.URL.revokeObjectURL(url);

                  toast.dismiss(toastId);
                  toast.success('Download complete');

                } catch (err) {
                  console.error(err);
                  toast.error('Download failed');
                }
              }}
              className="p-1.5 hover:bg-background-secondary rounded-lg transition-all text-foreground-muted/40 hover:text-primary active:scale-90"
              title="Download file"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => handleDeleteClick(e, file)}
              className="p-1.5 hover:bg-background-secondary rounded-lg transition-all text-foreground-muted/40 hover:text-destructive active:scale-90"
              title="Delete file"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>

      {/* Recursively render children */}
      {isExpanded && hasChildren && file.children?.map((child, idx) => (
        <FileRow
          key={`${child.metadata.sha256}-${idx}`}
          file={child}
          navigate={navigate}
          handleEditFamily={handleEditFamily}
          handleDeleteClick={handleDeleteClick}
          level={level + 1}
        />
      ))}
    </>
  );
});

