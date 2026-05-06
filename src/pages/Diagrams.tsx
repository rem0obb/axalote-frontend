import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import ReactFlow, {
    ReactFlowProvider,
    addEdge,
    useNodesState,
    useEdgesState,
    Controls,
    Background,
    MiniMap,
    Node,
    Edge,
    Connection,
    Panel,
    NodeTypes,
    Handle,
    Position,
    useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useFileRecords } from '@/hooks/useEndpointData';
import { Network, FileCode, GripVertical, Search, Zap, Shield, Fingerprint, Globe, ChevronDown, ChevronRight, Trash2, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// --- Custom Node Implementation ---
const FileNode = ({ id, data }: { id: string, data: any }) => {
    const handleRefresh = (e: React.MouseEvent) => {
        e.stopPropagation();
        // Dispatch custom event for the main component to handle
        const event = new CustomEvent('diagram-node-refresh', {
            detail: { id, filename: data.label }
        });
        window.dispatchEvent(event);
    };

    return (
        <div className="px-4 py-2 shadow-lg rounded-lg bg-card/90 backdrop-blur-md border-2 border-primary/20 hover:border-primary transition-all min-w-[200px] group relative">
            <Handle type="target" position={Position.Top} className="!bg-primary !w-3 !h-3 !border-2 !border-background" />

            <div className="flex items-center gap-3 border-b border-border-subtle pb-2 mb-2">
                <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                    <FileCode className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-foreground truncate">{data.label}</div>
                    <div className="text-[9px] font-mono text-foreground-muted">{data.type}</div>
                </div>
                <button
                    onClick={handleRefresh}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-primary/20 rounded transition-all"
                    title="Refresh Node & Expand IOCs"
                >
                    <RotateCw className="h-3 w-3 text-primary" />
                </button>
            </div>

            <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                    <span className="text-foreground-muted">Size:</span>
                    <span className="font-mono text-foreground">{data.size}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                    <span className="text-foreground-muted">Entropy:</span>
                    <span className="font-mono text-foreground">{data.entropy?.toFixed(2) || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-[10px] mt-1 pt-1 border-t border-border-subtle/50">
                    <span className="text-foreground-muted uppercase tracking-wider font-bold">SHA256</span>
                </div>
                <div className="text-[9px] font-mono text-foreground-muted break-all leading-tight opacity-70">
                    {data.sha256}
                </div>
                {/* Visual indicator for linked IOCs could go here */}
            </div>

            <Handle type="source" position={Position.Bottom} className="!bg-primary !w-3 !h-3 !border-2 !border-background" />
        </div>
    );
};

const IOCNode = ({ data }: { data: any }) => {
    const Icon = data.type === 'ip' ? Globe : data.type === 'hash' ? Fingerprint : Shield;

    return (
        <div className="px-3 py-1.5 shadow-md rounded-full bg-background-secondary/90 backdrop-blur-md border border-warning/30 hover:border-warning transition-all min-w-[150px] group relative flex items-center gap-2">
            <Handle type="target" position={Position.Top} className="!bg-warning !w-2 !h-2 !border-1 !border-background" />
            <div className="h-6 w-6 rounded-full bg-warning/10 flex items-center justify-center shrink-0">
                <Icon className="h-3 w-3 text-warning" />
            </div>
            <div className="min-w-0 flex-1">
                <div className="text-[10px] font-mono font-bold text-foreground truncate">{data.label}</div>
                <div className="text-[8px] text-foreground-muted uppercase tracking-wider">{data.type}</div>
            </div>
            <Handle type="source" position={Position.Bottom} className="!bg-warning !w-2 !h-2 !border-1 !border-background" />
        </div>
    );
};

const nodeTypes: NodeTypes = {
    fileNode: FileNode,
    iocNode: IOCNode,
};

// --- Main Diagram Component ---

export default function Diagrams() {
    return (
        <ReactFlowProvider>
            <DiagramsContent />
        </ReactFlowProvider>
    );
}

function DiagramsContent() {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
    const { data: files, isLoading, isError, refetch } = useFileRecords();
    const [searchQuery, setSearchQuery] = useState('');

    // Auto-layout helpers
    const CIRCLE_RADIUS = 150;

    // --- Persistence ---
    useEffect(() => {
        const storedNodes = localStorage.getItem('diagram-storage-nodes');
        const storedEdges = localStorage.getItem('diagram-storage-edges');
        if (storedNodes && storedEdges) {
            setNodes(JSON.parse(storedNodes));
            setEdges(JSON.parse(storedEdges));
        }
    }, []); // Run once on mount

    useEffect(() => {
        if (nodes.length > 0 || edges.length > 0) {
            localStorage.setItem('diagram-storage-nodes', JSON.stringify(nodes));
            localStorage.setItem('diagram-storage-edges', JSON.stringify(edges));
        }
    }, [nodes, edges]);

    const handleClearConfirm = () => {
        setNodes([]);
        setEdges([]);
        localStorage.removeItem('diagram-storage-nodes');
        localStorage.removeItem('diagram-storage-edges');
        toast.success('Diagram cleared');
    };

    // --- Node Refresh Logic ---
    useEffect(() => {
        const handleNodeRefresh = (e: Event) => {
            const customEvent = e as CustomEvent;
            const { id, filename } = customEvent.detail;

            if (!files) return;

            // Find fresh file data
            const freshFile = files.find(f => f.filename === filename);
            if (!freshFile) {
                toast.error(`File "${filename}" not found in current records.`);
                return;
            }

            // Update Node Data
            setNodes((nds) => nds.map((node) => {
                if (node.id === id) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            size: freshFile.metadata?.size || 0,
                            entropy: freshFile.metadata?.entropy,
                            sha256: freshFile.metadata?.sha256,
                            iocs: freshFile.iocs || [] // Update IOCs
                        }
                    };
                }
                return node;
            }));

            // Trigger Expansion if new IOCs
            if (freshFile.iocs && freshFile.iocs.length > 0) {
                expandIOCsForNode(id, freshFile.iocs, reactFlowInstance?.getNode(id)?.position || { x: 0, y: 0 });
            }
            toast.success(`Refreshed data for ${filename}`);
        };

        window.addEventListener('diagram-node-refresh', handleNodeRefresh);
        return () => window.removeEventListener('diagram-node-refresh', handleNodeRefresh);
    }, [files, reactFlowInstance, setNodes, setEdges]); // Dep: files is critical here

    const expandIOCsForNode = (sourceNodeId: string, iocs: string[], position: { x: number, y: number }) => {
        if (!reactFlowInstance) return;

        const currentNodes = reactFlowInstance.getNodes();
        const currentEdges = reactFlowInstance.getEdges();

        const angleStep = (2 * Math.PI) / iocs.length;
        const newNodes: Node[] = [];
        const newEdges: Edge[] = [];

        iocs.forEach((iocValue, index) => {
            // Check if IOC node already exists anywhere
            const existingNode = currentNodes.find((n: Node) => n.type === 'iocNode' && n.data.label === iocValue);

            let targetId;

            if (existingNode) {
                targetId = existingNode.id;
            } else {
                // Check if we are already adding this node in this batch
                const inBatch = newNodes.find(n => n.data.label === iocValue);
                if (inBatch) {
                    targetId = inBatch.id;
                } else {
                    // Create new IOC node
                    let iocType = 'unknown';
                    if (iocValue.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) iocType = 'ip';
                    else if (iocValue.match(/^http/)) iocType = 'url';
                    else if (iocValue.length === 32 || iocValue.length === 40 || iocValue.length === 64) iocType = 'hash';

                    const iocNode: Node = {
                        id: `ioc-${Date.now()}-${index}`,
                        type: 'iocNode',
                        position: {
                            x: position.x + CIRCLE_RADIUS * Math.cos(index * angleStep),
                            y: position.y + CIRCLE_RADIUS * Math.sin(index * angleStep),
                        },
                        data: {
                            label: iocValue,
                            type: iocType
                        }
                    };
                    newNodes.push(iocNode);
                    targetId = iocNode.id;
                }
            }

            // Check if edge already exists
            const edgeExists = currentEdges.some(e =>
                (e.source === sourceNodeId && e.target === targetId) ||
                (e.source === targetId && e.target === sourceNodeId)
            ) || newEdges.some(e => e.source === sourceNodeId && e.target === targetId);

            if (!edgeExists) {
                newEdges.push({
                    id: `edge-${sourceNodeId}-${targetId}`,
                    source: sourceNodeId,
                    target: targetId,
                    type: 'smoothstep',
                    animated: true,
                    style: { stroke: '#00ff7f', strokeDasharray: '5,5' },
                });
            }
        });

        if (newNodes.length > 0) setNodes((nds) => nds.concat(newNodes));
        if (newEdges.length > 0) setEdges((eds) => eds.concat(newEdges));
    };

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge({ ...params, type: 'smoothstep', animated: true, style: { stroke: '#00ff7f' } }, eds)),
        [setEdges],
    );

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect();
            const type = event.dataTransfer.getData('application/reactflow');
            const dataStr = event.dataTransfer.getData('application/data');

            if (typeof type === 'undefined' || !type || !reactFlowBounds || !reactFlowInstance) {
                return;
            }

            const position = reactFlowInstance.project({
                x: event.clientX - reactFlowBounds.left,
                y: event.clientY - reactFlowBounds.top,
            });

            const dataObj = dataStr ? JSON.parse(dataStr) : {};

            // Only handle file drops now
            if (type !== 'fileNode') return;

            const fileNode: Node = {
                id: `file-${Date.now()}`,
                type: 'fileNode',
                position,
                data: {
                    label: dataObj.filename || 'New Node',
                    type: dataObj.metadata?.mime_type || 'Unknown',
                    size: dataObj.metadata?.size || 0,
                    entropy: dataObj.metadata?.entropy,
                    sha256: dataObj.metadata?.sha256,
                    iocs: dataObj.iocs || []
                },
            };

            setNodes((nds) => nds.concat([fileNode]));

            // Trigger auto-expansion after a slight delay to ensure state and bounds
            setTimeout(() => {
                if (dataObj.iocs && dataObj.iocs.length > 0) {
                    expandIOCsForNode(fileNode.id, dataObj.iocs, position);
                }
            }, 50);

        },
        [reactFlowInstance, setNodes, setEdges], // removed expandIOCsForNode from dep to avoid loop if unstable
    );

    const filteredFiles = (files || []).filter(f =>
        f.filename.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="h-full flex flex-col overflow-hidden animate-in fade-in duration-500 bg-background text-foreground">
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between gap-4 bg-card border-b border-border-subtle p-3 z-10">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Network className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold uppercase tracking-widest text-foreground">Threat Graph</h2>
                        <p className="text-[10px] text-foreground-muted">Visual Intelligence Workspace</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="bg-background-secondary/50 px-3 py-1 rounded-full border border-border-subtle mr-2">
                        <span className="text-[10px] font-mono text-foreground-muted">
                            {nodes.length} Nodes • {edges.length} Connections
                        </span>
                    </div>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <button
                                className="h-8 w-8 flex items-center justify-center rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
                                title="Clear Diagram"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-card border-border-subtle">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-foreground">Clear Diagram?</AlertDialogTitle>
                                <AlertDialogDescription className="text-foreground-muted">
                                    This will permanently remove all nodes and connections from your local workspace. This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="bg-background-secondary text-foreground hover:bg-background-secondary/80 border-border-subtle">Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleClearConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Yes, Clear All</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>

            <div className="flex-1 flex min-h-0 overflow-hidden relative">
                {/* Sidebar */}
                <aside className="w-64 bg-card border-r border-border-subtle flex flex-col overflow-hidden shrink-0 z-10">
                    <div className="p-3 border-b border-border-subtle bg-background-secondary/30">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-foreground-muted">Available Assets</h3>
                            <button onClick={() => refetch()} className="text-[9px] text-primary hover:underline cursor-pointer">Refresh</button>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground-muted" />
                            <Input
                                placeholder="Search assets..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-8 pl-8 text-[11px] bg-background/50 border-border-subtle"
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                            <div className="text-[9px] font-bold text-foreground-muted uppercase tracking-wider px-2 py-1">Files ({filteredFiles.length})</div>

                            {isLoading && <div className="text-center text-[9px] py-2 text-foreground-muted">Loading files...</div>}
                            {!isLoading && filteredFiles.map((file, idx) => (
                                <div
                                    key={idx}
                                    draggable
                                    onDragStart={(event) => {
                                        event.dataTransfer.setData('application/reactflow', 'fileNode');
                                        event.dataTransfer.setData('application/data', JSON.stringify(file));
                                        event.dataTransfer.effectAllowed = 'move';
                                    }}
                                    className="flex items-center gap-2 p-2 rounded-lg bg-background-secondary/30 hover:bg-primary/10 border border-transparent hover:border-primary/20 cursor-grab active:cursor-grabbing transition-all group"
                                >
                                    <GripVertical className="h-3 w-3 text-foreground-muted/30 group-hover:text-foreground-muted" />
                                    <FileCode className="h-3.5 w-3.5 text-primary shrink-0" />
                                    <span className="text-xs font-medium truncate flex-1">{file.filename}</span>
                                    {file.metadata.entropy > 6.5 && (
                                        <Zap className="h-3 w-3 text-warning" />
                                    )}
                                </div>
                            ))}
                            {!isLoading && filteredFiles.length === 0 && <div className="text-center text-[9px] py-2 opacity-50">No matching files</div>}

                        </div>



                    </div>
                    <div className="p-2 border-t border-border-subtle/50 bg-background-secondary/10">
                        <div className="text-[9px] text-foreground-muted text-center">
                            Drag items to canvas to visualize
                        </div>
                    </div>
                </aside>

                {/* Canvas */}
                <div className="flex-1 overflow-hidden bg-[#111618] relative" ref={reactFlowWrapper}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onInit={setReactFlowInstance}
                        onDrop={onDrop}
                        onDragOver={onDragOver}
                        nodeTypes={nodeTypes}
                        proOptions={{ hideAttribution: true }}
                        fitView
                        className="bg-[#111618]"
                    >
                        <Background color="#2a3033" gap={20} size={1} />
                        <Controls className="bg-card border border-border-subtle text-foreground !fill-foreground" />
                        <MiniMap
                            className="!bg-card !border-border-subtle rounded-lg overflow-hidden"
                            maskColor="rgba(0, 0, 0, 0.4)"
                            nodeColor={(n) => {
                                if (n.type === 'fileNode') return '#00ff7f';
                                if (n.type === 'iocNode') return '#f59e0b';
                                return '#fff';
                            }}
                        />
                        <Panel position="top-right" className="bg-card/80 backdrop-blur border border-border-subtle p-2 rounded-lg">
                            <div className="text-[10px] text-foreground-muted font-mono">
                                Use Delete/Backspace to remove nodes
                            </div>
                        </Panel>
                    </ReactFlow>
                </div>
            </div>
        </div>
    );
}
