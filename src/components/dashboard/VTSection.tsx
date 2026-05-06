import { useState, useEffect } from 'react';
import { Shield, Download, ExternalLink, AlertTriangle, Clock, Loader2, Activity } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiService } from '@/services/api.service';
import { toast } from 'sonner';
import { VTFileReport } from '@/types/threat.types';
import { Progress } from '@/components/ui/progress';
import { BehaviourViewer } from './BehaviourViewer';
import VirusTotalIcon from '../icons/VirusTotalIcon';
import { openExternalLink } from '@/lib/runtime';

interface VTSectionProps {
  sha256: string;
  onDownloadComplete?: () => void;
  hideDownload?: boolean;
}

export function VTSection({ sha256, onDownloadComplete, hideDownload = false }: VTSectionProps) {
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [vtData, setVtData] = useState<VTFileReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showBehaviour, setShowBehaviour] = useState(false);
  const [behaviourData, setBehaviourData] = useState<any>(null);
  const [loadingBehaviour, setLoadingBehaviour] = useState(false);

  useEffect(() => {
    loadVTData();
  }, [sha256]);

  const loadVTData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiService.vtGetFileInfo(sha256);



      if (response.error || !response.data) {
        setError(response.error?.message || 'Failed to fetch VirusTotal data');
        setVtData(null);
      } else if (response.data.success && response.data.data?.data?.attributes) {
        // Estrutura: { success: true, data: { data: { attributes: {...} } } }
        const attributes = response.data.data.data.attributes;

        setVtData(attributes);
      } else if (response.data.data?.attributes) {
        // Estrutura: { data: { attributes: {...} } }
        const attributes = response.data.data.attributes;

        setVtData(attributes);
      } else if (response.data.attributes) {
        // Estrutura: { attributes: {...} }

        setVtData(response.data.attributes);
      } else {

        setError('File not found on VirusTotal');
        setVtData(null);
      }
    } catch (err: any) {
      console.error('VT Error:', err);
      setError(err.message || 'Error loading VirusTotal data');
      setVtData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    const toastId = toast.custom((t) => (
      <div className="bg-background-secondary border border-border-subtle p-4 rounded-xl shadow-2xl min-w-[320px] space-y-3 animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Download className="h-5 w-5 text-primary animate-bounce" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-foreground">Downloading from VT</p>
            <p className="text-[10px] text-foreground-muted truncate">Requesting file from VirusTotal to Engine...</p>
          </div>
        </div>
        <Progress value={0} className="h-1.5 bg-background-primary/50" indicatorClassName="bg-primary" id={`vt-progress-section-${sha256}`} />
      </div>
    ), { duration: Infinity });

    const updateProgress = (progress: number) => {
      const progressBar = document.getElementById(`vt-progress-section-${sha256}`);
      if (progressBar && progressBar.firstElementChild) {
        (progressBar.firstElementChild as HTMLElement).style.transform = `translateX(-${100 - progress}%)`;
      }
    };

    try {
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 90) progress = 90;
        updateProgress(progress);
      }, 600);

      const response = await apiService.vtDownloadFile(sha256);

      clearInterval(interval);
      updateProgress(100);

      // Short delay to show 100% before closing
      await new Promise(resolve => setTimeout(resolve, 500));
      toast.dismiss(toastId);

      if (response.error || !response.data) {
        toast.error(response.error?.message || 'Failed to download from VirusTotal');
      } else if (response.data.success) {
        toast.success(`File downloaded successfully: ${response.data.filename || 'file'}`);
        if (onDownloadComplete) {
          onDownloadComplete();
        }
      } else {
        toast.error(response.data.message || response.data.error || 'Download failed');
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err.message || 'Error downloading file');
    } finally {
      setDownloading(false);
    }
  };

  const loadBehaviour = async () => {
    setLoadingBehaviour(true);

    try {
      const response = await apiService.vtGetBehaviour(sha256);

      if (response.error || !response.data) {
        toast.error('Failed to load behaviour data');
        setBehaviourData(null);
      } else {
        setBehaviourData(response.data);
        setShowBehaviour(true);
      }
    } catch (err: any) {
      toast.error('Error loading behaviour data');
      setBehaviourData(null);
    } finally {
      setLoadingBehaviour(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6 bg-card border border-border-subtle">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <VirusTotalIcon className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">VirusTotal Analysis</h3>
            <p className="text-xs text-foreground-muted">Checking VirusTotal database...</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      </Card>
    );
  }

  if (error || !vtData) {
    return (
      <Card className="p-6 bg-card border border-border-subtle">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <VirusTotalIcon className="h-5 w-5 text-blue-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-foreground">VirusTotal Analysis</h3>
            <p className="text-xs text-foreground-muted">{error || 'Not found on VirusTotal'}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadVTData}
            className="gap-2"
          >
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  // Safety checks for VT data
  const stats = vtData.last_analysis_stats || {};
  const results = vtData.last_analysis_results || {};

  if (!vtData.last_analysis_stats || !vtData.last_analysis_results) {
    return (
      <Card className="p-6 bg-card border border-border-subtle">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <VirusTotalIcon className="h-5 w-5 text-blue-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-foreground">VirusTotal Analysis</h3>
            <p className="text-xs text-foreground-muted">Incomplete data from VirusTotal</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadVTData}
            className="gap-2"
          >
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  const detectionRate = (stats.malicious || 0) + (stats.suspicious || 0);
  const totalEngines = Object.keys(results).length;
  const detectionPercentage = totalEngines > 0 ? (detectionRate / totalEngines) * 100 : 0;

  return (
    <Card className="p-6 bg-card border border-border-subtle">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <VirusTotalIcon className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">VirusTotal Analysis</h3>
            <p className="text-xs text-foreground-muted">
              Last analyzed: {new Date(vtData.last_analysis_date * 1000).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadBehaviour}
            disabled={loadingBehaviour}
            className="gap-2"
          >
            {loadingBehaviour ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Activity className="h-3 w-3" />
                Behaviour
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void openExternalLink(`https://www.virustotal.com/gui/file/${sha256}`)}
            className="gap-2"
          >
            <ExternalLink className="h-3 w-3" />
            View on VT
          </Button>

        </div>
      </div>

      {/* Detection Stats — compact 4-col row */}
      <div className="grid grid-cols-4 gap-2 mb-5">
        {[
          { label: 'Malicious', value: stats.malicious || 0, color: 'text-red-500', bg: 'bg-red-500/5 border-red-500/20' },
          { label: 'Suspicious', value: stats.suspicious || 0, color: 'text-yellow-500', bg: 'bg-yellow-500/5 border-yellow-500/20' },
          { label: 'Harmless', value: stats.harmless || 0, color: 'text-emerald-500', bg: 'bg-emerald-500/5 border-emerald-500/20' },
          { label: 'Undetected', value: stats.undetected || 0, color: 'text-foreground-muted', bg: 'bg-background/30 border-border-subtle/50' },
        ].map(s => (
          <div key={s.label} className={`p-2.5 rounded-lg border text-center ${s.bg}`}>
            <p className={`text-base font-black leading-none mb-1 ${s.color}`}>{s.value}</p>
            <p className="text-[8px] uppercase tracking-wider text-foreground-muted/70 font-bold">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Detection Rate */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9px] font-black uppercase tracking-wider text-foreground-muted">Detection Rate</span>
          <span className="text-xs font-bold text-foreground">
            {detectionRate}/{totalEngines} <span className="text-foreground-muted font-normal">({detectionPercentage.toFixed(1)}%)</span>
          </span>
        </div>
        <Progress
          value={detectionPercentage}
          className="h-1.5"
        />
      </div>

      {/* Threat Classification */}
      {vtData.popular_threat_classification && (
        <div className="mb-5 p-3 rounded-lg bg-background/30 border border-border-subtle/40 space-y-2">
          <h4 className="text-[9px] font-black uppercase tracking-wider text-foreground-muted">Threat Classification</h4>
          {vtData.popular_threat_classification.suggested_threat_label && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-500 uppercase tracking-wide">
              {vtData.popular_threat_classification.suggested_threat_label}
            </span>
          )}
          {vtData.popular_threat_classification.popular_threat_name &&
            vtData.popular_threat_classification.popular_threat_name.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {vtData.popular_threat_classification.popular_threat_name.slice(0, 6).map((threat, idx) => (
                  <span
                    key={idx}
                    className="px-1.5 py-0.5 rounded bg-background-secondary border border-border-subtle/50 text-[9px] font-medium text-foreground-muted"
                  >
                    {threat.value} <span className="opacity-40">×{threat.count}</span>
                  </span>
                ))}
              </div>
            )}
        </div>
      )}

      {/* File Info */}
      <div className="grid grid-cols-2 gap-4 mb-6 p-4 rounded-lg bg-background-secondary/30">
        <div>
          <p className="text-xs text-foreground-muted mb-1">First Submission</p>
          <p className="text-xs font-medium text-foreground">
            {vtData.first_submission_date
              ? new Date(vtData.first_submission_date * 1000).toLocaleDateString()
              : 'N/A'}
          </p>
        </div>
        <div>
          <p className="text-xs text-foreground-muted mb-1">Times Submitted</p>
          <p className="text-xs font-medium text-foreground">{vtData.times_submitted || 0}</p>
        </div>
        <div>
          <p className="text-xs text-foreground-muted mb-1">Reputation</p>
          <p className="text-xs font-medium text-foreground">{vtData.reputation || 0}</p>
        </div>
        <div>
          <p className="text-xs text-foreground-muted mb-1">Community Votes</p>
          <p className="text-xs font-medium text-foreground">
            👍 {vtData.total_votes?.harmless || 0} / 👎 {vtData.total_votes?.malicious || 0}
          </p>
        </div>
      </div>

      {/* Engine Results - Collapsible */}
      <details className="group">
        <summary className="cursor-pointer text-xs font-bold text-foreground-muted uppercase mb-3 hover:text-primary transition-colors">
          Engine Results ({totalEngines} engines)
        </summary>
        <div className="mt-3 max-h-96 overflow-y-auto custom-scrollbar space-y-1">
          {Object.entries(results).map(([engine, result]) => (
            <div
              key={engine}
              className="flex items-center justify-between p-2 rounded-md hover:bg-background-secondary/50 transition-colors"
            >
              <span className="text-xs font-medium text-foreground">{result.engine_name}</span>
              <span className={`text-xs font-bold ${result.category === 'malicious' ? 'text-red-500' :
                result.category === 'suspicious' ? 'text-yellow-500' :
                  result.category === 'undetected' ? 'text-green-500' :
                    'text-foreground-muted'
                }`}>
                {result.result || result.category}
              </span>
            </div>
          ))}
        </div>
      </details>

      {/* Behaviour Data - Collapsible */}
      {showBehaviour && behaviourData && (
        <div className="mt-6">
          <BehaviourViewer data={behaviourData} />
        </div>
      )}
    </Card>
  );
}
