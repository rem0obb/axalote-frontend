import { useParams, useNavigate } from 'react-router-dom';
import { useFileDetail } from '@/hooks/useEndpointData';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorDisplay } from '@/components/common/ErrorDisplay';
import { useState } from 'react';
import { DockablePanel } from '@/components/layout/DockablePanel';
import { IDALayout } from '@/components/layout/IDALayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HexViewerNew as HexViewer } from '@/components/dashboard/HexViewerNew';
import { CodeViewer } from '@/components/dashboard/CodeViewer';
import { StringIntelligence } from '@/components/dashboard/StringIntelligence';
import { VTSection } from '@/components/dashboard/VTSection';
import { BehaviourViewer } from '@/components/dashboard/BehaviourViewer';
import { ParserViewer } from '@/components/dashboard/ParserViewer';
import { MediaViewer } from '@/components/dashboard/MediaViewer';
import { IOCEditor } from '@/components/dashboard/IOCEditor';
import { DroppedFilesList } from '@/components/dashboard/DroppedFilesList';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Download,
  Trash2,
  RefreshCw,
  FileCode,
  Binary,
  Code2,
  FileText,
  Shield,
  Image as ImageIcon,
  Bug,
  Key,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function FileDetailsIDA() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: file, isLoading, isError, error, refetch } = useFileDetail(id);
  const [activeTab, setActiveTab] = useState('hex');

  if (isLoading) {
    return <LoadingState message="Loading file details..." />;
  }

  if (isError || !file) {
    return <ErrorDisplay error={error} onRetry={refetch} />;
  }

  const fileToDisplay = {
    ...file,
    filename: file.filename || 'Unknown',
    iocs: Array.isArray(file.iocs) ? file.iocs : [],
    tags: Array.isArray(file.tags) ? file.tags : [],
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header Bar */}
      <div className="h-8 bg-background-elevated border-b border-border flex items-center justify-between px-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate('/')}
            className="h-6 w-6 p-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
          
          <FileCode className="h-3.5 w-3.5 text-ida-function flex-shrink-0" />
          <span className="text-[11px] font-medium truncate">{fileToDisplay.filename}</span>
          
          {fileToDisplay.family && (
            <Badge variant="outline" className="h-5 text-[10px] px-1.5">
              {fileToDisplay.family}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => refetch()} className="h-6 px-2 text-[11px]">
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]">
            <Download className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] text-destructive">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Main Content with IDA Layout */}
      <div className="flex-1 overflow-hidden">
        <IDALayout
          leftPanel={
            <DockablePanel id="metadata" title="Metadata">
              <div className="p-2 space-y-2 text-[11px]">
                {/* Hash Info */}
                <div className="space-y-1">
                  <div className="text-[10px] text-foreground-muted">SHA256</div>
                  <div className="font-mono text-[10px] text-ida-address break-all">
                    {fileToDisplay.metadata.sha256}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] text-foreground-muted">MD5</div>
                  <div className="font-mono text-[10px] text-ida-address">
                    {fileToDisplay.metadata.md5}
                  </div>
                </div>

                {/* File Info */}
                <div className="border-t border-border pt-2 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">Size:</span>
                    <span className="font-mono text-ida-immediate">
                      {(fileToDisplay.metadata.size / 1024).toFixed(2)} KB
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">Type:</span>
                    <span className="font-mono text-ida-string truncate ml-2">
                      {fileToDisplay.metadata.mime_type}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">Entropy:</span>
                    <span className="font-mono text-ida-immediate">
                      {fileToDisplay.metadata.entropy?.toFixed(2) || 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Tags */}
                {fileToDisplay.tags.length > 0 && (
                  <div className="border-t border-border pt-2">
                    <div className="text-[10px] text-foreground-muted mb-1">Tags</div>
                    <div className="flex flex-wrap gap-1">
                      {fileToDisplay.tags.map((tag, i) => (
                        <Badge key={i} variant="secondary" className="h-4 text-[9px] px-1">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dropped Files */}
                {file.dropped_files && file.dropped_files.length > 0 && (
                  <div className="border-t border-border pt-2">
                    <DroppedFilesList droppedFiles={file.dropped_files} />
                  </div>
                )}
              </div>
            </DockablePanel>
          }
          centerTopPanel={
            <DockablePanel id="viewer" title="Analysis">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                <TabsList className="h-7 bg-background-elevated border-b border-border rounded-none justify-start px-2 gap-1">
                  <TabsTrigger value="hex" className="h-5 text-[10px] px-2 data-[state=active]:bg-primary/20">
                    <Binary className="h-3 w-3 mr-1" />
                    Hex
                  </TabsTrigger>
                  <TabsTrigger value="code" className="h-5 text-[10px] px-2 data-[state=active]:bg-primary/20">
                    <Code2 className="h-3 w-3 mr-1" />
                    Code
                  </TabsTrigger>
                  <TabsTrigger value="parser" className="h-5 text-[10px] px-2 data-[state=active]:bg-primary/20">
                    <FileText className="h-3 w-3 mr-1" />
                    Parser
                  </TabsTrigger>
                  <TabsTrigger value="media" className="h-5 text-[10px] px-2 data-[state=active]:bg-primary/20">
                    <ImageIcon className="h-3 w-3 mr-1" />
                    Media
                  </TabsTrigger>
                </TabsList>

                <div className="flex-1 overflow-hidden">
                  <TabsContent value="hex" className="h-full m-0">
                    <HexViewer
                      sha256={fileToDisplay.metadata.sha256}
                      mimeType={fileToDisplay.metadata.mime_type}
                      filename={fileToDisplay.filename}
                    />
                  </TabsContent>

                  <TabsContent value="code" className="h-full m-0">
                    <CodeViewer
                      sha256={fileToDisplay.metadata.sha256}
                      mimeType={fileToDisplay.metadata.mime_type}
                      filename={fileToDisplay.filename}
                    />
                  </TabsContent>

                  <TabsContent value="parser" className="h-full m-0">
                    <ParserViewer sha256={fileToDisplay.metadata.sha256} />
                  </TabsContent>

                  <TabsContent value="media" className="h-full m-0">
                    <MediaViewer
                      sha256={fileToDisplay.metadata.sha256}
                      mimeType={fileToDisplay.metadata.mime_type}
                    />
                  </TabsContent>
                </div>
              </Tabs>
            </DockablePanel>
          }
          centerBottomPanel={
            <DockablePanel id="strings" title="Strings & IOCs">
              <Tabs defaultValue="strings" className="h-full flex flex-col">
                <TabsList className="h-7 bg-background-elevated border-b border-border rounded-none justify-start px-2 gap-1">
                  <TabsTrigger value="strings" className="h-5 text-[10px] px-2">
                    Strings
                  </TabsTrigger>
                  <TabsTrigger value="iocs" className="h-5 text-[10px] px-2">
                    IOCs
                  </TabsTrigger>
                  <TabsTrigger value="behavior" className="h-5 text-[10px] px-2">
                    Behavior
                  </TabsTrigger>
                </TabsList>

                <div className="flex-1 overflow-hidden">
                  <TabsContent value="strings" className="h-full m-0">
                    <StringIntelligence sha256={fileToDisplay.metadata.sha256} />
                  </TabsContent>

                  <TabsContent value="iocs" className="h-full m-0">
                    <IOCEditor
                      fileId={fileToDisplay.metadata.sha256}
                      initialIOCs={fileToDisplay.iocs}
                      onUpdate={() => refetch()}
                    />
                  </TabsContent>

                  <TabsContent value="behavior" className="h-full m-0">
                    <BehaviourViewer sha256={fileToDisplay.metadata.sha256} />
                  </TabsContent>
                </div>
              </Tabs>
            </DockablePanel>
          }
          rightPanel={
            <DockablePanel id="intelligence" title="Intelligence">
              <Tabs defaultValue="vt" className="h-full flex flex-col">
                <TabsList className="h-7 bg-background-elevated border-b border-border rounded-none justify-start px-2 gap-1">
                  <TabsTrigger value="vt" className="h-5 text-[10px] px-2">
                    <Shield className="h-3 w-3 mr-1" />
                    VT
                  </TabsTrigger>
                </TabsList>

                <div className="flex-1 overflow-hidden">
                  <TabsContent value="vt" className="h-full m-0">
                    <VTSection sha256={fileToDisplay.metadata.sha256} />
                  </TabsContent>
                </div>
              </Tabs>
            </DockablePanel>
          }
        />
      </div>
    </div>
  );
}
