
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import copy from 'copy-to-clipboard';
import { cn } from '@/lib/utils';
import { IOCEditor } from '@/components/dashboard/IOCEditor';
import { useFileDetail, useRescanFile } from '@/hooks/useEndpointData';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorDisplay } from '@/components/common/ErrorDisplay';
import { ApiError, apiService } from '@/services/api.service';
import { Button } from '@/components/ui/button';
import {
    FileCode,
    FileText,
    FileIcon as LucideFileIcon,
    AlertTriangle,
    CheckCircle,
    Braces,
    Info,
    Download,
    Trash2,
    Shield,
    Terminal,
    Copy,
    Folder,
    FileEdit,
    Plus,
    RefreshCw,
    Loader2,
    ArrowLeft,
    Bug,
    ScanSearch,
    FileSearch,
    ReceiptText,
    RotateCw,
    Image as ImageIcon
} from 'lucide-react';
import { useState, useCallback, useEffect, useMemo, lazy, Suspense, useTransition } from 'react';
import { YaraScanResult } from '@/types/threat.types';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MainLayoutContextType } from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Lazy load heavy components
const StringIntelligence = lazy(() => import('@/components/dashboard/StringIntelligence').then(m => ({ default: m.StringIntelligence })));
const HexViewer = lazy(() => import('@/components/dashboard/HexViewerNew').then(m => ({ default: m.HexViewerNew })));
const CodeViewer = lazy(() => import('@/components/dashboard/CodeViewer').then(m => ({ default: m.CodeViewer })));
const DroppedFilesList = lazy(() => import('@/components/dashboard/DroppedFilesList').then(m => ({ default: m.DroppedFilesList })));
const ParserViewer = lazy(() => import('@/components/dashboard/ParserViewer').then(m => ({ default: m.ParserViewer })));
const MediaViewer = lazy(() => import('@/components/dashboard/MediaViewer').then(m => ({ default: m.MediaViewer })));
const VTSection = lazy(() => import('@/components/dashboard/VTSection').then(m => ({ default: m.VTSection })));
const YaraRuleGenerator = lazy(() => import('@/components/dashboard/YaraRuleGenerator').then(m => ({ default: m.YaraRuleGenerator })));

import { VerdictScore } from '@/components/dashboard/VerdictScore';
import { EntropyVisualizer } from '@/components/dashboard/EntropyVisualizer';

import { ConfirmDeleteDialog } from '@/components/common/ConfirmDeleteDialog';
import { Network, SearchCode, Check, ExternalLink, Key, Eye, Binary, Code2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable"


import { pdf } from '@react-pdf/renderer';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BinaryReportPDF } from '@/components/dashboard/BinaryReportPDF';
import { getParserRegions } from '@/lib/parser-regions';
import { HexRegion } from '@/types/hex.types';
import { ParserResponse } from '@/types/parser.types';
import { saveToLabInput } from '@/lib/lab-storage';
import { VirusTotalIcon } from '@/components/icons/VirusTotalIcon';
import { YaraDiagnosticsPanel } from '@/components/common/YaraDiagnosticsPanel';

export default function FileDetails() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { } = useOutletContext<MainLayoutContextType>();
    const { data: file, isLoading, isError, error, refetch } = useFileDetail(id);
    const rescanMutation = useRescanFile();

    const [selectedChildFile, setSelectedChildFile] = useState<any | null>(null);

    // Determines which file to show in the Inspector
    const selectedChildHasMetadata = !!selectedChildFile?.metadata;
    const rawFileToDisplay = selectedChildHasMetadata ? selectedChildFile : file;
    const fileToDisplay = {
        ...(rawFileToDisplay || {}),
        filename: rawFileToDisplay?.filename || file?.filename || 'Unknown Object',
        iocs: Array.isArray(rawFileToDisplay?.iocs) ? rawFileToDisplay.iocs : [],
        tags: Array.isArray(rawFileToDisplay?.tags) ? rawFileToDisplay.tags : [],
        metadata: rawFileToDisplay?.metadata || file?.metadata || {
            md5: '',
            sha1: '',
            sha256: id || '',
            mime_type: 'application/octet-stream',
            entropy: 0,
            size: 0
        }
    };
    const isPreviewing = selectedChildHasMetadata;



    const [isScanning, setIsScanning] = useState(false);
    const [scanResult, setScanResult] = useState<YaraScanResult | null>(null);
    const [scanMessage, setScanMessage] = useState<string | null>(null);
    const [isIocDialogOpen, setIsIocDialogOpen] = useState(false);

    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editField, setEditField] = useState<'filename' | 'description' | 'tags' | 'iocs' | 'family' | null>(null);
    const [editValue, setEditValue] = useState<string>('');
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("static");
    const [showInfoPanel, setShowInfoPanel] = useState(true);
    const [isCheckingVT, setIsCheckingVT] = useState(false);
    const [vtAvailable, setVtAvailable] = useState<boolean>(false);
    const [isLoadingVTReport, setIsLoadingVTReport] = useState(false);
    const [isLoadingVTBehaviour, setIsLoadingVTBehaviour] = useState(false);
    const [vtReportData, setVtReportData] = useState<any | null>(null);
    const [vtBehaviourData, setVtBehaviourData] = useState<any | null>(null);

    // Reset selection when tab changes or main file id changes
    useEffect(() => {
        setSelectedChildFile(null);
    }, [id, activeTab]);

    // Parser Data State for Hex View overlay
    const [parserData, setParserData] = useState<ParserResponse | null>(null);
    const [hexRegions, setHexRegions] = useState<HexRegion[]>([]);
    const [isParserLoading, setIsParserLoading] = useState(false);
    const [parserError, setParserError] = useState<string | null>(null);

    const parserTargetSha = fileToDisplay?.metadata?.sha256 || id || '';

    // Clear static analysis when changing files
    useEffect(() => {
        setParserData(null);
        setHexRegions([]);
        setParserError(null);
    }, [parserTargetSha]);

    // Logic to determine if "Code" tab should be visible
    const isCodeViewable = (() => {
        if (!fileToDisplay?.metadata?.mime_type) return false;
        const mime = fileToDisplay.metadata.mime_type.toLowerCase();
        const fname = (fileToDisplay.filename || '').toLowerCase();

        // Allowed by MIME type
        if (mime.startsWith('text/') ||
            mime.includes('javascript') ||
            mime.includes('json') ||
            mime.includes('xml')) {
            return true;
        }

        // Allowed by extension or specific filenames
        const allowedExtensions = ['.js', '.html', '.htm', '.css', '.txt', '.md', '.py', '.ps1', '.sh', '.bat', '.json', '.xml', '.yaml', '.yml', '.ts', '.tsx', '.jsx', '.asm', '.vbs', '.vbe'];
        const allowedNames = ['androidmanifest.xml', 'androidmanifest'];
        if (allowedExtensions.some(ext => fname.endsWith(ext)) || allowedNames.some(name => fname === name)) {
            return true;
        }

        return false;
    })();

    const isMediaViewable = (() => {
        if (!fileToDisplay?.metadata?.mime_type) return false;
        const mime = fileToDisplay.metadata.mime_type.toLowerCase();
        const fname = (fileToDisplay.filename || '').toLowerCase();

        if (mime.startsWith('image/') || mime === 'application/pdf') return true;

        const allowedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.pdf'];
        if (allowedExtensions.some(ext => fname.endsWith(ext))) return true;

        return false;
    })();



    // Interaction State
    const [highlightStart, setHighlightStart] = useState<number | null>(null);
    const [highlightEnd, setHighlightEnd] = useState<number | null>(null);

    const handleParserSelect = (offset: number, size: number) => {
        setHighlightStart(offset);
        setHighlightEnd(offset + size); // Highlight full range
        setActiveTab("hex"); // Switch to hex view when a structure field is selected
    };

    const handleScan = useCallback(async () => {
        if (!fileToDisplay?.metadata?.sha256) return;
        setIsScanning(true);
        try {
            const result = await apiService.scanFileWithYara(fileToDisplay.metadata.sha256);
            if (result.error) {
                setScanMessage(result.error.message);
                toast.error(`Scan failed: ${result.error.message} `);
            } else if (result.data) {
                setScanMessage(result.data.success === false ? result.data.message || 'scan failed' : null);
                setScanResult(result.data);
            }
        } catch (err) {
            setScanMessage('Scan error');
            toast.error('Scan error');
            console.error(err);
        } finally {
            setIsScanning(false);
        }
    }, [fileToDisplay]);

    const handleRescan = async () => {
        if (!file?.metadata?.sha256) return;

        toast.promise(rescanMutation.mutateAsync(file.metadata.sha256), {
            loading: 'Rescanning file...',
            success: (data) => {
                refetch(); // Ensure main file data is fresh
                return `Rescan complete: ${data.filename} `;
            },
            error: (err) => `Rescan failed: ${err.message} `
        });
    };

    useEffect(() => {
        if (fileToDisplay?.metadata?.sha256) {
            setScanResult(null);
            setScanMessage(null);
            // Auto-trigger scan on file load
            handleScan();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fileToDisplay?.metadata?.sha256]);

    useEffect(() => {
        const checkVTAvailability = async () => {
            const hash = fileToDisplay?.metadata?.sha256;
            if (!hash) return;
            setIsCheckingVT(true);
            setVtAvailable(false);
            setVtReportData(null);
            setVtBehaviourData(null);
            try {
                const response = await apiService.vtCheckFile(hash);
                if (!response.error && response.data?.exists) {
                    setVtAvailable(true);
                }
            } finally {
                setIsCheckingVT(false);
            }
        };
        checkVTAvailability();
    }, [fileToDisplay?.metadata?.sha256]);

    // Fetch parser data for the file currently displayed in the inspector/viewer.
    useEffect(() => {
        if (!parserTargetSha) return;

        const fetchParserData = async () => {
            setIsParserLoading(true);
            setParserError(null);
            try {
                const response = await apiService.getParserFile(parserTargetSha);
                if (response.error) {
                    setParserData(null);
                    setHexRegions([]);
                    setParserError(response.error.message);
                    return;
                }

                if (response.data) {
                    setParserData(response.data);
                    if (response.data.parsed) {
                        setHexRegions(getParserRegions(response.data.parsed));
                    } else {
                        setHexRegions([]);
                    }
                }
            } catch (err) {
                console.error("Failed to background fetch parser data", err);
                setParserData(null);
                setHexRegions([]);
                setParserError('Failed to load parser data.');
            } finally {
                setIsParserLoading(false);
            }
        };

        fetchParserData();
    }, [parserTargetSha]);



    const handleUpdateMetadata = async (directValue?: any) => {
        if (!fileToDisplay?.metadata?.sha256 || !editField) return;

        // Prevent editing preview files for now, or ensure we update the correct ID
        if (isPreviewing) {
            toast.info("Open full details to edit metadata.");
            return;
        }

        setIsUpdating(true);
        try {
            let updatedMetadata: any = {};

            if (directValue !== undefined) {
                // Ensure no empty strings in arrays (IOCs, tags)
                if (Array.isArray(directValue)) {
                    updatedMetadata[editField] = directValue
                        .map((s: string) => typeof s === 'string' ? s.trim() : String(s).trim())
                        .filter(Boolean);
                } else {
                    updatedMetadata[editField] = directValue;
                }
            } else if (editField === 'tags' || editField === 'iocs') {
                updatedMetadata[editField] = editValue.split(',').map(s => s.trim()).filter(Boolean);
            } else if (editField === 'family') {
                updatedMetadata[editField] = editValue.trim().toLowerCase();
            } else {
                updatedMetadata[editField] = editValue.trim();
            }

            const result = await apiService.updateFileMetadata(id, updatedMetadata);
            if (result.error) {
                toast.error(`Update failed: ${result.error.message} `);
            } else {
                toast.success('Metadata updated');
                setIsEditOpen(false);
                setEditField(null);
                refetch();
            }
        } catch (err) {
            toast.error('Update failed');
            console.error(err);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDownloadFile = async () => {
        if (!fileToDisplay?.metadata?.sha256 || !fileToDisplay) return;
        try {
            const toastId = toast.custom((t) => (
                <div className="bg-background-secondary border border-border-subtle p-4 rounded-lg shadow-lg w-[320px]">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Download className="h-4 w-4 text-primary animate-bounce" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-foreground truncate">Downloading File</h4>
                        </div>
                    </div>
                    <Progress value={0} className="h-1.5 bg-background-primary/50" indicatorClassName="bg-primary" id={`progress - ${fileToDisplay.metadata.sha256} `} />
                </div>
            ), { duration: Infinity });

            const updateProgress = (progress: number) => {
                const progressBar = document.getElementById(`progress - ${fileToDisplay.metadata.sha256} `);
                if (progressBar && progressBar.firstElementChild) {
                    (progressBar.firstElementChild as HTMLElement).style.transform = `translateX(-${100 - progress} %)`;
                }
            };

            const response = await apiService.downloadFile(fileToDisplay.metadata.sha256, updateProgress);

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
            link.download = fileToDisplay.filename || `file - ${fileToDisplay.metadata.sha256}.bin`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            toast.dismiss(toastId);
            toast.success('Download complete');

        } catch (error) {
            console.error('Download error:', error);
            toast.error('Download failed');
        }
    };

    const handleDownloadReport = async () => {
        if (!fileToDisplay) return;

        const toastId = toast.loading("Generating PDF Report...");
        try {
            const blob = await pdf(
                <BinaryReportPDF 
                    file={fileToDisplay} 
                    scanResult={scanResult} 
                    vtData={vtReportData}
                    vtBehaviour={vtBehaviourData}
                    parserData={parserData?.parsed}
                />
            ).toBlob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Axalote_Report_${fileToDisplay.filename || fileToDisplay.metadata.sha256}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast.dismiss(toastId);
            toast.success("Report exported successfully");
        } catch (error) {
            console.error('PDF generation error:', error);
            toast.dismiss(toastId);
            toast.error("Failed to generate report");
        }
    };



    const openEdit = (field: 'filename' | 'description' | 'tags' | 'iocs' | 'family', value: any) => {
        setEditField(field);
        if (Array.isArray(value)) {
            setEditValue(value.join(', '));
        } else {
            setEditValue(value || '');
        }
        setIsEditOpen(true);
    };

    const renderTags = () => {
        const rawTags = fileToDisplay?.tags;
        if (!rawTags) return null;

        let tagList: string[] = [];
        if (Array.isArray(rawTags)) {
            tagList = rawTags.map(t => typeof t === 'string' ? t : String(t));
        } else if (typeof rawTags === 'object') {
            tagList = Object.keys(rawTags);
        }

        if (tagList.length === 0) return null;

        return (
            <div className="flex flex-wrap gap-1.5 mt-2">
                {tagList.map((tag, i) => (
                    <Badge key={i} variant="secondary" className="px-2 py-0 h-5 text-[10px] font-bold uppercase tracking-wider border-primary/20 bg-primary/5 text-primary">
                        {tag}
                    </Badge>
                ))}
            </div>
        );
    };

    const renderIOCs = () => {
        const iocList = Array.isArray(fileToDisplay?.iocs) ? fileToDisplay.iocs : [];
        if (iocList.length === 0) return (
            <div className="flex flex-col items-center justify-center py-8 opacity-40">
                <FileSearch className="h-6 w-6 mb-2 text-foreground-muted" />
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground-muted">No IOCs Found</p>
            </div>
        );

        return (
            <div className="space-y-1.5">
                {iocList.slice(0, 5).map((ioc, idx) => (
                    <div
                        key={idx}
                        onClick={() => copyToClipboard(ioc)}
                        className="flex items-center justify-between gap-3 p-2 bg-background/50 border border-border-subtle/30 rounded-lg group/ioc cursor-pointer hover:border-primary/20 hover:bg-primary/5 transition-all"
                    >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <span className="text-[8px] font-black text-foreground-muted/40 w-3 shrink-0">{(idx + 1).toString().padStart(2, '0')}</span>
                            <code className="text-[10px] font-mono text-foreground/70 truncate tracking-tight">{ioc}</code>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover/ioc:opacity-100 transition-opacity">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    sendToLab(ioc);
                                }}
                                className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[8px] font-black uppercase tracking-tighter border border-primary/20 hover:bg-primary/20"
                            >
                                Lab
                            </button>
                        </div>
                    </div>
                ))}
                {iocList.length > 5 && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsIocDialogOpen(true);
                        }}
                        className="w-full py-2 text-[9px] font-black uppercase tracking-[0.2em] text-foreground-muted/50 hover:text-primary hover:bg-primary/5 rounded-lg border border-dashed border-border-subtle/50 transition-all mt-2"
                    >
                        View all {iocList.length} indicators
                    </button>
                )}
            </div>
        );
    };

    const handleDelete = async () => {
        if (!id) return;

        const response = await apiService.deleteFile(id);
        if (response.error) {
            toast.error(`Delete failed: ${response.error.message} `);
            throw new Error(response.error.message);
        } else if (response.data && response.data.success === false) {
            toast.error(`Delete failed: ${response.data.message || 'Unknown error'} `);
            throw new Error(response.data.message);
        } else {
            toast.success('File deleted successfully');
            navigate('/');
        }
    };

    const sendToLab = (text: string) => {
        saveToLabInput(text);
        toast.info("Sending data to Cyber Lab...");
        navigate('/lab');
    };

    const copyToClipboard = (text: string) => {
        if (copy(text)) {
            toast.success("Copied to clipboard");
        } else {
            toast.error("Failed to copy");
        }
    };

    const handleLoadVTReport = async () => {
        const hash = fileToDisplay?.metadata?.sha256;
        if (!hash) return;
        setIsLoadingVTReport(true);
        try {
            const response = await apiService.vtGetFileReport(hash);
            if (response.error) {
                toast.error(`VT report failed: ${response.error.message}`);
                return;
            }
            setVtReportData(response.data);
        } finally {
            setIsLoadingVTReport(false);
        }
    };

    const handleLoadVTBehaviour = async () => {
        const hash = fileToDisplay?.metadata?.sha256;
        if (!hash) return;
        setIsLoadingVTBehaviour(true);
        try {
            const response = await apiService.vtGetFileBehaviour(hash);
            if (response.error) {
                toast.error(`VT behaviour failed: ${response.error.message}`);
                return;
            }
            setVtBehaviourData(response.data);
        } finally {
            setIsLoadingVTBehaviour(false);
        }
    };

    if (isLoading) {
        return <LoadingState message="Fetching artifact intelligence..." />;
    }

    if (isError || !file) {
        return (
            <div className="p-6">
                <ErrorDisplay
                    error={error as ApiError || { message: 'Artifact not found' }}
                    endpoint={`/axalote/records/files/${id}`}
                    onRetry={() => refetch()}
                />
            </div>
        );
    }

    const formattedSize = fileToDisplay.metadata.size
        ? (fileToDisplay.metadata.size < 1024
            ? `${fileToDisplay.metadata.size} B`
            : (fileToDisplay.metadata.size / 1024).toFixed(2) + ' KB')
        : 'Unknown Size';
    // Helper to get Extension Icon (reusing similar logic if needed, or just Generic FileCode)
    const ArtifactIcon = FileCode; // Placeholder


    return (
        <div className="h-full w-full flex flex-col bg-background overflow-hidden animate-in fade-in duration-300">
            {/* 1. Header Bar (Drive Style) */}
            <div className="h-14 border-b border-border-subtle bg-background-secondary/50 backdrop-blur-md flex items-center justify-between px-4 shrink-0 z-20">
                <div className="flex items-center gap-4 overflow-hidden">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate('/')}
                        className="h-8 w-8 hover:bg-background-secondary rounded-full text-foreground-muted hover:text-foreground"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>

                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <ArtifactIcon className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                                <h1 className="text-sm font-bold text-foreground truncate cursor-text hover:text-primary transition-colors"
                                    onClick={() => openEdit('filename', fileToDisplay.filename)}
                                    title="Edit filename">
                                    {fileToDisplay.filename || "Unknown Object"}
                                </h1>
                                <FileEdit className="h-3 w-3 text-foreground-muted/30 hover:text-primary cursor-pointer"
                                    onClick={() => openEdit('filename', fileToDisplay.filename)} />
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-foreground-muted">
                                {fileToDisplay.family && (
                                    <span className="flex items-center gap-1 bg-primary/5 text-primary px-1.5 rounded-sm">
                                        <Folder className="h-2.5 w-2.5" />
                                        <span className="font-bold">{fileToDisplay.family}</span>
                                    </span>
                                )}
                                <span>{formattedSize}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleRescan}
                        disabled={rescanMutation.isPending}
                        className={cn(
                            "h-8 flex items-center gap-2 px-3 rounded-lg bg-background-secondary border border-border-subtle hover:bg-background-secondary/80 hover:border-primary/30 transition-all",
                            rescanMutation.isPending ? "opacity-70 cursor-not-allowed" : "cursor-pointer"
                        )}
                        title="Rescan File"
                    >
                        <RotateCw className={cn("h-3.5 w-3.5 text-foreground-muted", rescanMutation.isPending && "animate-spin text-primary")} />
                        <span className="text-xs font-bold text-foreground-muted">Rescan</span>
                    </button>

                    <div className="h-4 w-px bg-border-subtle/50 mx-1" />

                    <button
                        onClick={handleDownloadFile}
                        className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-background-secondary text-foreground-muted hover:text-primary transition-all"
                        title="Download"
                    >
                        <Download className="h-4 w-4" />
                    </button>

                    <button
                        onClick={() => setIsDeleteDialogOpen(true)}
                        className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-destructive/10 text-foreground-muted hover:text-destructive transition-all"
                        title="Delete"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>

                    <div className="h-4 w-px bg-border-subtle/50 mx-1" />

                    <button
                        onClick={handleDownloadReport}
                        className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-background-secondary text-foreground-muted hover:text-primary transition-all"
                        title="Export Report (PDF)"
                    >
                        <FileText className="h-4 w-4" />
                    </button>

                    <div className="h-4 w-px bg-border-subtle/50 mx-1" />

                    <button
                        onClick={() => setShowInfoPanel(!showInfoPanel)}
                        className={`h-8 w-8 flex items-center justify-center rounded-lg transition-all ${showInfoPanel ? 'bg-primary/10 text-primary' : 'hover:bg-background-secondary text-foreground-muted'}`}
                        title="File Info"
                    >
                        <Info className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* 2. Main Layout Split */}
            <div className="flex-1 flex overflow-hidden">
                {/* Main Viewer Area */}
                <div className="flex-1 flex flex-col min-w-0 bg-background/30 relative">
                    {/* Viewer Toolbar / Tabs */}
                    <div className="h-10 border-b border-border-subtle flex items-center px-4 gap-1 shrink-0 bg-background-secondary/20">

                        {isCodeViewable && (
                            <button onClick={() => setActiveTab("code")} className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", activeTab === "code" ? "bg-primary/10 text-primary font-bold" : "text-foreground-muted hover:text-foreground hover:bg-background-secondary")}>
                                Source Code
                            </button>
                        )}

                        <button onClick={() => setActiveTab("static")} className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", activeTab === "static" ? "bg-primary/10 text-primary font-bold" : "text-foreground-muted hover:text-foreground hover:bg-background-secondary")}>
                            Static Analysis
                        </button>
                        <button onClick={() => setActiveTab("strings")} className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", activeTab === "strings" ? "bg-primary/10 text-primary font-bold" : "text-foreground-muted hover:text-foreground hover:bg-background-secondary")}>
                            Strings
                        </button>
                        <button onClick={() => setActiveTab("hex")} className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", activeTab === "hex" ? "bg-primary/10 text-primary font-bold" : "text-foreground-muted hover:text-foreground hover:bg-background-secondary")}>
                            Hex View
                        </button>
                        <button onClick={() => setActiveTab("yara-rule")} className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5", activeTab === "yara-rule" ? "bg-primary/10 text-primary font-bold" : "text-foreground-muted hover:text-foreground hover:bg-background-secondary")}>
                            <Braces className="h-3.5 w-3.5" />
                            YARA Rule
                        </button>

                        <button onClick={() => setActiveTab("dropped")} className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", activeTab === "dropped" ? "bg-primary/10 text-primary font-bold" : "text-foreground-muted hover:text-foreground hover:bg-background-secondary")}>
                            Dropped Files
                        </button>
                        <button onClick={() => setActiveTab("vt")} className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5", activeTab === "vt" ? "bg-primary/10 text-primary font-bold" : "text-foreground-muted hover:text-foreground hover:bg-background-secondary")}>
                            <VirusTotalIcon className="h-3 w-3" />
                            VirusTotal
                        </button>
                        {isMediaViewable && (
                            <button onClick={() => setActiveTab("media")} className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5", activeTab === "media" ? "bg-primary/10 text-primary font-bold" : "text-foreground-muted hover:text-foreground hover:bg-background-secondary")}>
                                <ImageIcon className="h-3.5 w-3.5" />
                                Preview
                            </button>
                        )}

                    </div>

                    {/* Content Viewport */}
                    <div className="flex-1 overflow-hidden relative bg-card/10">
                        <Suspense fallback={<LoadingState message="Loading component..." />}>
                            {isCodeViewable && activeTab === 'code' && (
                                <div className="absolute inset-0 block">
                                    {id && <CodeViewer sha256={fileToDisplay.metadata.sha256} mimeType={fileToDisplay.metadata.mime_type} filename={fileToDisplay.filename} />}
                                </div>
                            )}

                            {isMediaViewable && activeTab === 'media' && (
                                <div className="absolute inset-0 block">
                                    {id && <MediaViewer sha256={fileToDisplay.metadata.sha256} mimeType={fileToDisplay.metadata.mime_type} filename={fileToDisplay.filename} />}
                                </div>
                            )}

                            {activeTab === 'strings' && (
                                <div className="absolute inset-0 block">
                                    {id && <StringIntelligence sha256={fileToDisplay.metadata.sha256} fullHeight />}
                                </div>
                            )}

                            {activeTab === 'dropped' && (
                                <div className="absolute inset-0 block">
                                    {id && (
                                        <DroppedFilesList
                                            sha256={id}
                                            onSelect={(child) => setSelectedChildFile(child)}
                                            selectedSha256={selectedChildFile?.metadata?.sha256}
                                        />
                                    )}
                                </div>
                            )}

                            {/* VirusTotal Tab Content */}
                            {activeTab === 'vt' && (
                                <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-6">
                                    {id && (
                                        <VTSection
                                            sha256={fileToDisplay.metadata.sha256}
                                            onDownloadComplete={() => {
                                                toast.success('File downloaded from VirusTotal');
                                                refetch();
                                            }}
                                        />
                                    )}
                                </div>
                            )}

                            {activeTab === 'static' && (
                                <div className="absolute inset-0 block overflow-hidden bg-background-secondary/10">
                                    {parserTargetSha && (
                                        <Suspense fallback={<LoadingState message="Loading Structure..." />}>
                                            <ParserViewer
                                                data={parserData ? parserData.parsed : null}
                                                sha256={parserTargetSha}
                                                loading={isParserLoading}
                                                error={parserError}
                                                onSelectField={handleParserSelect}
                                            />
                                        </Suspense>
                                    )}
                                </div>
                            )}

                            {activeTab === 'hex' && (
                                <div className="absolute inset-0 block">
                                    {id && <HexViewer
                                        sha256={fileToDisplay.metadata.sha256}
                                        mimeType={fileToDisplay.metadata.mime_type}
                                        filename={fileToDisplay.filename}
                                        regions={hexRegions}
                                        highlightStart={highlightStart}
                                        highlightEnd={highlightEnd}
                                    />}
                                </div>
                            )}

                            {activeTab === 'yara-rule' && (
                                <div className="absolute inset-0 block">
                                    {fileToDisplay.metadata.sha256 && (
                                        <YaraRuleGenerator
                                            sha256={fileToDisplay.metadata.sha256}
                                            filename={fileToDisplay.filename}
                                            family={fileToDisplay.family}
                                        />
                                    )}
                                </div>
                            )}
                        </Suspense>
                    </div>
                </div>

                {/* 3. Info Sidebar (Inspector) */}
                {showInfoPanel && (
                    <div className="w-[300px] bg-background-secondary/30 border-l border-border-subtle">
                        <div className="h-full flex flex-col animate-in slide-in-from-right-10 duration-300">
                            <div className="border-b border-border-subtle px-4 py-3 bg-background-secondary/50 flex items-center justify-between">
                                <h2 className="text-xs font-black uppercase tracking-widest text-foreground-muted flex items-center gap-2">
                                    <Info className="h-4 w-4 text-primary" />
                                    {isPreviewing ? 'Preview' : 'Inspector'}
                                </h2>
                                {isPreviewing && (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        className="h-6 text-[10px] px-2"
                                        onClick={() => navigate(`/files/${fileToDisplay.metadata.sha256}`)}
                                    >
                                        Open Full <ExternalLink className="ml-1 h-3 w-3" />
                                    </Button>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                                {isPreviewing && (
                                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <FileCode className="h-4 w-4 text-primary" />
                                            <span className="font-bold text-xs truncate" title={fileToDisplay.filename}>{fileToDisplay.filename}</span>
                                        </div>
                                        <p className="text-[10px] text-foreground-muted font-mono">{fileToDisplay.metadata?.sha256?.substring(0, 16)}...</p>
                                    </div>
                                )}

                                <section>
                                    <VerdictScore
                                        yaraMatch={scanResult?.match || false}
                                        yaraRuleCount={scanResult?.rules?.length || 0}
                                        entropy={fileToDisplay.metadata?.entropy || 0}
                                        iocCount={fileToDisplay.iocs?.length || 0}
                                        family={fileToDisplay.family}
                                    />
                                </section>

                                <div className="h-px bg-border-subtle/50" />

                                <section>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">Yara Analysis</h3>
                                        {scanResult && (
                                            <Button variant="ghost" size="icon" onClick={handleScan} disabled={isScanning} className="h-4 w-4 text-foreground-muted hover:text-primary">
                                                <RefreshCw className={cn("h-3 w-3", isScanning && "animate-spin")} />
                                            </Button>
                                        )}
                                    </div>
                                    <div className="bg-background/30 rounded-lg border border-border-subtle/50 p-3">
                                        {isScanning ? (
                                            <div className="flex items-center gap-3 py-2">
                                                <Loader2 className="h-4 w-4 text-primary animate-spin" />
                                                <span className="text-xs font-mono text-foreground-muted animate-pulse">Scanning artifact...</span>
                                            </div>
                                        ) : scanResult ? (
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn("p-1.5 rounded-md", scanResult.success === false || scanResult.match ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success")}>
                                                        {scanResult.success === false || scanResult.match ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className={cn("text-xs font-bold leading-none mb-1", scanResult.success === false || scanResult.match ? "text-destructive" : "text-success")}>
                                                            {scanResult.success === false ? 'Scan Failed' : scanResult.match ? "Threat Detected" : "Clean"}
                                                        </div>
                                                        <div className="text-[9px] text-foreground-muted uppercase tracking-wider">
                                                            {scanResult.success === false ? (scanMessage || 'Compilation or scan error') : scanResult.match ? `${scanResult.rules.length} Rules Matched` : "No Matches"}
                                                        </div>
                                                    </div>
                                                </div>

                                                {scanResult.success === false && (
                                                    <YaraDiagnosticsPanel
                                                        compact
                                                        message={scanMessage || scanResult.message}
                                                        diagnostics={scanResult.diagnostics}
                                                        errors={scanResult.errors}
                                                        warnings={scanResult.warnings}
                                                        title="Scan Diagnostics"
                                                    />
                                                )}

                                                {scanResult.match && (
                                                    <div className="space-y-1.5 pt-2 border-t border-border-subtle/30">
                                                        {scanResult.rules.map((ruleItem, idx) => {
                                                            const ruleId = typeof ruleItem === 'string' ? ruleItem : (ruleItem as any).identifier || (ruleItem as any).name || 'Unknown';
                                                            return (
                                                                <div key={idx}
                                                                    onClick={() => navigate(`/rules/${ruleId}`)}
                                                                    className="group flex items-center justify-between py-1 px-2 hover:bg-background-secondary/50 rounded cursor-pointer transition-colors"
                                                                >
                                                                    <code className="text-[10px] font-mono font-bold text-destructive truncate flex-1">{ruleId}</code>
                                                                    <ArrowLeft className="h-3 w-3 text-destructive/50 opacity-0 group-hover:opacity-100 rotate-180 transition-opacity" />
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="text-center py-2">
                                                <Button size="sm" onClick={handleScan} className="w-full text-xs font-bold uppercase tracking-wider h-8 gap-2 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 shadow-none">
                                                    <Braces className="h-3 w-3" />
                                                    Run Scan
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                <div className="h-px bg-border-subtle/50" />

                                <section>
                                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted mb-3">Identity</h3>
                                    <div className="space-y-4">
                                        <div className="group">
                                            <label className="text-[9px] text-foreground-muted/50 font-bold uppercase tracking-widest mb-1 block">Description</label>
                                            <div
                                                onClick={() => openEdit('description', fileToDisplay.description)}
                                                className="text-sm text-foreground/80 italic p-2 rounded-md hover:bg-background-secondary cursor-pointer border border-transparent hover:border-border-subtle transition-all min-h-[40px]"
                                            >
                                                {fileToDisplay.description || "Add description..."}
                                            </div>
                                        </div>

                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-[9px] text-foreground-muted/50 font-bold uppercase tracking-widest">Classification</label>
                                                <Bug className="h-3 w-3 text-foreground-muted/30 cursor-pointer hover:text-primary transition-colors" onClick={() => openEdit('family', fileToDisplay.family)} />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {fileToDisplay.family ? (
                                                    <div className="px-2 py-1 bg-primary/10 border border-primary/20 rounded-md text-primary text-xs font-bold font-mono flex items-center gap-2">
                                                        <Folder className="h-3 w-3" />
                                                        {fileToDisplay.family}
                                                    </div>
                                                ) : <span className="text-xs text-foreground-muted italic">Unclassified</span>}
                                            </div>
                                        </div>

                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-[9px] text-foreground-muted/50 font-bold uppercase tracking-widest">Tags</label>
                                                <Plus className="h-3 w-3 text-foreground-muted/30 cursor-pointer hover:text-primary" onClick={() => openEdit('tags', fileToDisplay.tags)} />
                                            </div>
                                            {renderTags()}
                                        </div>
                                    </div>
                                </section>

                                <div className="h-px bg-border-subtle/50" />

                                <section>
                                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted mb-3">Fingerprint</h3>
                                    <div className="space-y-3">
                                        {[
                                            { label: 'MD5', value: fileToDisplay.metadata.md5 },
                                            { label: 'SHA1', value: fileToDisplay.metadata.sha1 },
                                            { label: 'SHA256', value: fileToDisplay.metadata.sha256 }
                                        ].map(hash => (
                                            <div key={hash.label} className="group relative">
                                                <label className="text-[8px] font-bold text-foreground-muted/50 uppercase tracking-widest mb-0.5 block">{hash.label}</label>
                                                <div className="flex items-center gap-2 bg-background/50 border border-border-subtle p-2 rounded-md group-hover:border-primary/30 transition-colors cursor-pointer" onClick={() => copyToClipboard(hash.value)}>
                                                    <code className="text-[10px] font-mono text-foreground truncate flex-1">{hash.value}</code>
                                                    <Copy className="h-3 w-3 text-foreground-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <div className="h-px bg-border-subtle/50" />

                                <section>
                                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted mb-3">Properties</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-2 bg-background/30 rounded-lg border border-border-subtle/30">
                                            <div className="text-[8px] uppercase tracking-wider text-foreground-muted mb-1">Size</div>
                                            <div className="text-xs font-mono font-bold text-foreground">{formattedSize}</div>
                                        </div>
                                        <div className="p-2 bg-background/30 rounded-lg border border-border-subtle/30">
                                            <div className="text-[8px] uppercase tracking-wider text-foreground-muted mb-1">MIME Type</div>
                                            <div className="text-[10px] font-mono text-foreground break-all">{fileToDisplay.metadata.mime_type}</div>
                                        </div>
                                        <div className="col-span-2 p-3 bg-background/30 rounded-lg border border-border-subtle/30">
                                            <EntropyVisualizer entropy={fileToDisplay.metadata.entropy} />
                                        </div>
                                    </div>
                                </section>

                                <div className="h-px bg-border-subtle/50" />

                                <section>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted">Indicators</h3>
                                        <FileEdit className="h-3 w-3 text-foreground-muted/30 cursor-pointer hover:text-primary" onClick={() => openEdit('iocs', fileToDisplay.iocs)} />
                                    </div>
                                    {renderIOCs()}
                                </section>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Dialogs */}
            < Dialog open={isIocDialogOpen} onOpenChange={setIsIocDialogOpen} >
                <DialogContent className="sm:max-w-[600px] bg-card border-border-subtle backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
                    <DialogHeader className="border-b border-border-subtle/50 pb-4">
                        <DialogTitle className="flex items-center gap-2 text-lg font-bold">
                            <ScanSearch className="h-5 w-5 text-primary" />
                            Indicators Analysis
                        </DialogTitle>
                        <DialogDescription className="text-xs text-foreground-muted uppercase tracking-widest font-bold">
                            Total of {Array.isArray(fileToDisplay?.iocs) ? fileToDisplay.iocs.length : 0} potential artifacts identified
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                        {Array.isArray(fileToDisplay?.iocs) && fileToDisplay.iocs.length > 0 ? (
                            <div className="grid grid-cols-1 gap-3 px-1">
                                {fileToDisplay.iocs.map((ioc, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between p-4 bg-background-secondary/30 border border-border-subtle rounded-xl group hover:border-primary/30 hover:bg-primary/5 transition-all"
                                    >
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                                <AlertTriangle className="h-4 w-4 text-primary" />
                                            </div>
                                            <div className="min-w-0">
                                                <code className="text-sm font-mono font-bold text-foreground break-all block">
                                                    {ioc}
                                                </code>
                                                <span className="text-[10px] text-foreground-muted uppercase font-black opacity-30">
                                                    Threat Indicator #{idx + 1}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => sendToLab(ioc)}
                                                className="h-8 gap-2 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 border border-primary/20"
                                            >
                                                <Terminal className="h-3 w-3" />
                                                Lab
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => copyToClipboard(ioc)}
                                                className="h-8 w-8 hover:bg-background border border-border-subtle"
                                            >
                                                <Copy className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 opacity-30">
                                <ReceiptText className="h-12 w-12 mb-4" />
                                <p className="text-sm font-bold uppercase tracking-widest">No Indicators Found</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog >

            < Dialog open={isEditOpen} onOpenChange={setIsEditOpen} >
                <DialogContent className={cn(
                    "bg-card border-border-subtle backdrop-blur-xl animate-in zoom-in-95 duration-200 flex flex-col",
                    editField === 'iocs' ? "sm:max-w-[600px] h-[85vh]" : "sm:max-w-[500px] max-h-[85vh]"
                )}>
                    <DialogHeader>
                        <DialogTitle className="capitalize flex items-center gap-2">
                            <FileEdit className="h-5 w-5 text-primary" /> Edit {editField}
                        </DialogTitle>
                        <DialogDescription>
                            {editField === 'iocs' || editField === 'tags'
                                ? "Separate multiple values with commas."
                                : editField === 'family' ? "Assign a malware family classification." : "Update the file metadata."}
                        </DialogDescription>
                    </DialogHeader>

                    {editField === 'iocs' ? (
                        <div className="flex-1 min-h-0">
                            <IOCEditor
                                initialIocs={editValue}
                                onSave={(newIocs) => handleUpdateMetadata(newIocs)}
                                onCancel={() => setIsEditOpen(false)}
                                isSaving={isUpdating}
                            />
                        </div>
                    ) : (
                        <div className="grid gap-4 py-4">
                            <textarea
                                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                placeholder={`Enter ${editField}...`}
                            />
                        </div>
                    )}

                    <div className="flex justify-end gap-3 mt-4">
                        <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                        <Button 
                            variant="outline" 
                            onClick={() => handleUpdateMetadata()} 
                            disabled={isUpdating}
                            className="font-bold uppercase tracking-widest text-xs"
                        >
                            {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <ConfirmDeleteDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                onConfirm={handleDelete}
                title="Delete Artifact"
                description="This action cannot be undone. The artifact and all derived intelligence will be purged."
                itemName={file.filename}
            />
        </div >
    );
}
