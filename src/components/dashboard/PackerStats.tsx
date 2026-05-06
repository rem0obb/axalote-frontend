import { ThreatFile, getPackerStats } from '@/types/threat.types';
import { Package, FileDown, Archive, FileArchive } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface PackerStatsProps {
  files: ThreatFile[];
}

export function PackerStats({ files }: PackerStatsProps) {
  const stats = getPackerStats(files);

  // Debug log


  // Only show if there are packed files (not dropped, as that's shown in Total Files)
  if (stats.packed === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {/* Packed Files - Total */}
      <Card className="p-4 bg-yellow-500/5 border-yellow-500/20">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-yellow-500/10">
            <Package className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{stats.packed}</p>
            <p className="text-xs text-foreground-muted uppercase tracking-wider">Packed</p>
          </div>
        </div>
      </Card>

      {/* ZIP Files */}
      {stats.packers.zip > 0 && (
        <Card className="p-4 bg-background-secondary/50 border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Archive className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.packers.zip}</p>
              <p className="text-xs text-foreground-muted uppercase tracking-wider">ZIP</p>
            </div>
          </div>
        </Card>
      )}

      {/* Donut Files */}
      {stats.packers.donut > 0 && (
        <Card className="p-4 bg-background-secondary/50 border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <FileArchive className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.packers.donut}</p>
              <p className="text-xs text-foreground-muted uppercase tracking-wider">Donut</p>
            </div>
          </div>
        </Card>
      )}

      {/* ISO Files */}
      {stats.packers.iso > 0 && (
        <Card className="p-4 bg-background-secondary/50 border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Archive className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.packers.iso}</p>
              <p className="text-xs text-foreground-muted uppercase tracking-wider">ISO</p>
            </div>
          </div>
        </Card>
      )}

      {/* PDF Files */}
      {stats.packers.pdf > 0 && (
        <Card className="p-4 bg-background-secondary/50 border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <FileArchive className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.packers.pdf}</p>
              <p className="text-xs text-foreground-muted uppercase tracking-wider">PDF</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
