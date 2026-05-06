import { YaraDiagnostic } from '@/types/threat.types';
import { AlertTriangle, FileCode } from 'lucide-react';
import { cn } from '@/lib/utils';

type YaraDiagnosticsPanelProps = {
  message?: string;
  diagnostics?: YaraDiagnostic[];
  errors?: YaraDiagnostic[];
  warnings?: YaraDiagnostic[];
  title?: string;
  compact?: boolean;
};

function DiagnosticRow({ item }: { item: YaraDiagnostic }) {
  const displayPath = item.path || item.relative_path;

  return (
    <div className="rounded-md border border-border-subtle bg-background px-3 py-2">
      <div className="flex items-center gap-2 text-[11px] font-semibold">
        <span
          className={cn(
            'rounded px-1.5 py-0.5 uppercase tracking-wide',
            item.level === 'warning' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'
          )}
        >
          {item.level || 'error'}
        </span>
        {item.file_name && <span className="text-foreground">{item.file_name}</span>}
        {typeof item.line_number === 'number' && (
          <span className="text-foreground-muted">line {item.line_number}</span>
        )}
      </div>
      <div className="mt-1 text-sm text-foreground">{item.message}</div>
      {(item.rule || displayPath || item.namespace || item.source_line || item.content) && (
        <div className="mt-2 space-y-1 text-[11px] text-foreground-muted">
          {item.rule && <div>Rule: <code>{item.rule}</code></div>}
          {displayPath && <div>Path: <code>{displayPath}</code></div>}
          {item.namespace && <div>Namespace: <code>{item.namespace}</code></div>}
          {item.source_line && <div>Source: <code>{item.source_line}</code></div>}
          {item.content && (
            <div className="space-y-1">
              <div>Rule Content:</div>
              <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-border-subtle bg-background-secondary px-3 py-2 text-[11px] text-foreground">
                <code>{item.content}</code>
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function YaraDiagnosticsPanel({
  message,
  diagnostics = [],
  errors = [],
  warnings = [],
  title = 'Technical Details',
  compact = false,
}: YaraDiagnosticsPanelProps) {
  const primaryItems = errors.length > 0 ? errors : diagnostics;

  if (!message && primaryItems.length === 0 && warnings.length === 0) {
    return null;
  }

  return (
    <details className="rounded-lg border border-border-subtle bg-background/40" open={!compact}>
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-semibold text-foreground">
        <FileCode className="h-4 w-4 text-primary" />
        {title}
      </summary>
      <div className="space-y-3 border-t border-border-subtle px-3 py-3">
        {message && (
          <div className="flex items-start gap-2 rounded-md border border-border-subtle bg-background px-3 py-2 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-400" />
            <span>{message}</span>
          </div>
        )}
        {primaryItems.length > 0 && (
          <div className="space-y-2">
            {primaryItems.map((item, index) => (
              <DiagnosticRow key={`${item.message}-${index}`} item={item} />
            ))}
          </div>
        )}
        {warnings.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Warnings</div>
            {warnings.map((item, index) => (
              <DiagnosticRow key={`${item.message}-warning-${index}`} item={{ ...item, level: item.level || 'warning' }} />
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
