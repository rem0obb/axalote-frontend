import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Search, Loader2, CheckCircle2, XCircle, Hash } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '@/services/api.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { VirusTotalIcon } from '@/components/icons/VirusTotalIcon';
import { MainLayoutContextType } from '@/components/layout/MainLayout';
import { cn } from '@/lib/utils';
import { VTResultPanel } from '@/components/dashboard/VTResultPanel';

const HASH_PATTERN = /^(?:[a-fA-F0-9]{32}|[a-fA-F0-9]{40}|[a-fA-F0-9]{64})$/;

const HASH_TYPE = (h: string) => {
  if (h.length === 32) return 'MD5';
  if (h.length === 40) return 'SHA1';
  if (h.length === 64) return 'SHA256';
  return null;
};

export function VirusTotalView() {
  const { navbarPosition } = useOutletContext<MainLayoutContextType>();
  const navigate = useNavigate();
  const [hash, setHash] = useState('');
  const [searchedHash, setSearchedHash] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [existsOnVT, setExistsOnVT] = useState<boolean | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const normalizedHash = hash.trim().toLowerCase();

  const handleSearch = async () => {
    if (!normalizedHash || !HASH_PATTERN.test(normalizedHash)) {
      toast.error('Enter a valid hash (MD5, SHA1 or SHA256)');
      return;
    }

    setIsSearching(true);
    setSearchedHash(normalizedHash);
    setExistsOnVT(null);
    setPanelOpen(false);

    try {
      const check = await apiService.vtCheckFile(normalizedHash);
      if (check.error) {
        toast.error(`Error querying VT: ${check.error.message}`);
        setExistsOnVT(false);
        return;
      }

      const exists = !!check.data?.exists;
      setExistsOnVT(exists);

      if (exists) {
        setPanelOpen(true);
        toast.success('File found on VirusTotal');
      } else {
        toast.error('File not found on VirusTotal');
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleDownloadComplete = (sha256: string) => {
    setPanelOpen(false);
    navigate(`/files/${sha256}`);
  };

  return (
    <>
      <div className={cn(
        'overflow-hidden p-6 flex items-center justify-center',
        navbarPosition === 'top' ? 'h-[calc(100vh-56px)]' : 'h-full'
      )}>
        <div className="w-full max-w-2xl space-y-8">

          {/* Hero */}
          <div className="text-center space-y-4">
            <div className="mx-auto h-16 w-16 rounded-2xl bg-blue-500/10 flex items-center justify-center ring-1 ring-blue-500/20">
              <VirusTotalIcon className="h-8 w-8 text-blue-500" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight">VirusTotal Search</h2>
              <p className="text-sm text-foreground-muted mt-1">
                Search any MD5, SHA1 or SHA256 hash on the VirusTotal database
              </p>
            </div>
          </div>

          {/* Search Card */}
          <Card className="border-border-subtle shadow-sm">
            <CardContent className="pt-6 space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-muted/40" />
                  <Input
                    value={hash}
                    onChange={(e) => setHash(e.target.value)}
                    placeholder="Paste MD5 / SHA1 / SHA256 here..."
                    className="h-11 pl-9 font-mono text-sm"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                  />
                </div>
                <Button
                  variant="outline"
                  className="h-11 px-6 gap-2"
                  onClick={handleSearch}
                  disabled={isSearching}
                >
                  {isSearching
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Search className="h-4 w-4" />
                  }
                  Search
                </Button>
              </div>

              {/* Hash type hint */}
              {normalizedHash && HASH_PATTERN.test(normalizedHash) && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-bold border-primary/30 text-primary bg-primary/5">
                    {HASH_TYPE(normalizedHash)}
                  </Badge>
                  <span className="text-[10px] text-foreground-muted">Valid hash detected</span>
                </div>
              )}

              {/* Result feedback */}
              {searchedHash && existsOnVT !== null && !isSearching && (
                <div className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border text-sm font-medium',
                  existsOnVT
                    ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-500'
                    : 'bg-destructive/5 border-destructive/20 text-destructive'
                )}>
                  {existsOnVT
                    ? <><CheckCircle2 className="h-4 w-4 shrink-0" /> File found on VirusTotal — panel opened →</>
                    : <><XCircle className="h-4 w-4 shrink-0" /> Hash not found on the VirusTotal database</>
                  }
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tips */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'MD5', desc: '32 hex characters', example: 'd41d8cd98f00b204...' },
              { label: 'SHA1', desc: '40 hex characters', example: 'da39a3ee5e6b4b0d...' },
              { label: 'SHA256', desc: '64 hex characters', example: 'e3b0c44298fc1c14...' },
            ].map(tip => (
              <div key={tip.label} className="p-3 rounded-lg bg-background-secondary/30 border border-border-subtle/50 text-center">
                <p className="text-xs font-bold text-foreground mb-0.5">{tip.label}</p>
                <p className="text-[9px] text-foreground-muted">{tip.desc}</p>
                <p className="text-[9px] font-mono text-foreground-muted/40 mt-1 truncate">{tip.example}</p>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* VT Result Panel (Drawer) */}
      <VTResultPanel
        hash={searchedHash}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onDownloadComplete={handleDownloadComplete}
      />
    </>
  );
}

export default VirusTotalView;
