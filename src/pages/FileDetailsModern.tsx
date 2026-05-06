import { useParams, useNavigate } from 'react-router-dom';
import { useFileDetail } from '@/hooks/useEndpointData';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorDisplay } from '@/components/common/ErrorDisplay';
import { useState } from 'react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HexViewerNew as HexViewer } from '@/components/dashboard/HexViewerNew';
import { CodeViewer } from '@/components/dashboard/CodeViewer';
import { StringIntelligence } from '@/components/dashboard/StringIntelligence';
import { VTSection } from '@/components/dashboard/VTSection';
import { BehaviourViewer } from '@/components/dashboard/BehaviourViewer';
import { ParserViewer } from '@/components/dashboard/ParserViewer';
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
  Bug,
  Key,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Hash,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function FileDetailsModern() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: file, isLoading, isError, error, refetch } = useFileDetail(id);
  const [activeTab, setActiveTab] = useState('hex');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['metadata', 'hashes']));

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

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
      {/* Top Bar */}
      <div className="h-14 bg-background-elevated border-b border-border flex items-center justify-between px-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate('/')}
            className="h-8 w-8 p-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          
          <FileCode className="h-5 w-5 text-primary flex-shrink-0" />
          <span className="text-sm font-semibold truncate">{fileToDisplay.filename}</span>
          
          {fileToDisplay.family && (
            <Badge className="badge-modern">
              {fileToDisplay.family}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => refetch()} className="h-8">
            <RefreshCw className="h-4 w-4 mr-2" />
            Rescan
          </Button>
          <Button size="sm" variant="ghost" className="h-8">
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* Left Panel - File Tree & Info */}
          <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
            <div className="h-full bg-background-secondary border-r border-border flex flex-col">
              <div className="p-3 border-b border-border">
                <h3 className="text-sm font-semibold">File Information</h3>
              </div>
              
              <ScrollArea className="flex-1">
                <div className="p-3 space-y-2">
                  {/* Metadata Section */}
                  <div className="card-modern p-0 overflow-hidden">
                    <button
                      onClick={() => toggleSection('metadata')}
                      className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Info className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Metadata</span>
                      </div>
                      {expandedSections.has('metadata') ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    
                    {expandedSections.has('metadata') && (
                      <div className="px-3 pb-3 space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-foreground-muted">Size:</span>
                          <span className="font-mono font-medium">
                            {(fileToDisplay.metadata.size / 1024).toFixed(2)} KB
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-foreground-muted">Type:</span>
                          <span className="font-mono font-medium truncate ml-2">
                            {fileToDisplay.metadata.mime_type}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-foreground-muted">Entropy:</span>
                          <span className="font-mono font-medium">
                            {fileToDisplay.metadata.entropy?.toFixed(2) || 'N/A'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Hashes Section */}
                  <div className="card-modern p-0 overflow-hidden">
                    <button
                      onClick={() => toggleSection('hashes')}
                      className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Hashes</span>
                      </div>
                      {expandedSections.has('hashes') ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    
                    {expandedSections.has('hashes') && (
                      <div className="px-3 pb-3 space-y-2 text-xs">
                        <div>
                          <div className="text-foreground-muted mb-1">SHA256</div>
                          <div className="font-mono text-[10px] break-all bg-muted p-2 rounded">
                            {fileToDisplay.metadata.sha256}
                          </div>
                        </div>
                        <div>
                          <div className="text-foreground-muted mb-1">MD5</div>
                          <div className="font-mono text-[10px] bg-muted p-2 rounded">
                            {fileToDisplay.metadata.md5}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  {fileToDisplay.tags.length > 0 && (
                    <div className="card-modern p-3">
                      <div className="text-sm font-medium mb-2">Tags</div>
                      <div className="flex flex-wrap gap-1">
                        {fileToDisplay.tags.map((tag, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Dropped Files */}
                  {file.dropped_files && file.dropped_files.length > 0 && (
                    <div className="card-modern p-0 overflow-hidden">
                      <button
                        onClick={() => toggleSection('dropped')}
                        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Folder className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">Dropped Files ({file.dropped_files.length})</span>
                        </div>
                        {expandedSections.has('dropped') ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                      
                      {expandedSections.has('dropped') && (
                        <div className="px-3 pb-3">
                          <DroppedFilesList droppedFiles={file.dropped_files} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </ResizablePanel>

          <ResizableHandle className="w-1 bg-border hover:bg-primary/50 transition-colors" />

          {/* Center Panel - Main Viewer */}
          <ResizablePanel defaultSize={55} minSize={40}>
            <ResizablePanelGroup direction="vertical">
              {/* Top - Hex/Code Viewer */}
              <ResizablePanel defaultSize={65} minSize={30}>
                <div className="h-full bg-background flex flex-col">
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                    <div className="border-b border-border bg-background-elevated px-4">
                      <TabsList className="h-12 bg-transparent border-0">
                        <TabsTrigger value="hex" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                          <Binary className="h-4 w-4 mr-2" />
                          Hex View
                        </TabsTrigger>
                        <TabsTrigger value="code" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                          <Code2 className="h-4 w-4 mr-2" />
                          Code
                        </TabsTrigger>
                        <TabsTrigger value="parser" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                          <FileText className="h-4 w-4 mr-2" />
                          Parser
                        </TabsTrigger>
                      </TabsList>
                    </div>

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
                    </div>
                  </Tabs>
                </div>
              </ResizablePanel>

              <ResizableHandle className="h-1 bg-border hover:bg-primary/50 transition-colors" />

              {/* Bottom - Strings/IOCs */}
              <ResizablePanel defaultSize={35} minSize={20}>
                <div className="h-full bg-background-secondary">
                  <Tabs defaultValue="strings" className="h-full flex flex-col">
                    <div className="border-b border-border bg-background-elevated px-4">
                      <TabsList className="h-10 bg-transparent border-0">
                        <TabsTrigger value="strings" className="text-xs data-[state=active]:bg-primary/10">
                          Strings
                        </TabsTrigger>
                        <TabsTrigger value="iocs" className="text-xs data-[state=active]:bg-primary/10">
                          IOCs
                        </TabsTrigger>
                        <TabsTrigger value="behavior" className="text-xs data-[state=active]:bg-primary/10">
                          Behavior
                        </TabsTrigger>
                      </TabsList>
                    </div>

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
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          <ResizableHandle className="w-1 bg-border hover:bg-primary/50 transition-colors" />

          {/* Right Panel - Intelligence */}
          <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
            <div className="h-full bg-background-secondary border-l border-border">
              <Tabs defaultValue="vt" className="h-full flex flex-col">
                <div className="border-b border-border bg-background-elevated px-4">
                  <TabsList className="h-10 bg-transparent border-0">
                    <TabsTrigger value="vt" className="text-xs data-[state=active]:bg-primary/10">
                      <Shield className="h-3 w-3 mr-1" />
                      VirusTotal
                    </TabsTrigger>
                  </TabsList>
                </div>

                <div className="flex-1 overflow-hidden">
                  <TabsContent value="vt" className="h-full m-0">
                    <VTSection sha256={fileToDisplay.metadata.sha256} />
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
