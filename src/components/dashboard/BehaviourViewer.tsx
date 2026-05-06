import { useState } from 'react';
import { 
  Activity, FileJson, Shield, Network, HardDrive, Terminal, 
  Key, AlertTriangle, FileCode, Cpu, Database, Settings,
  ChevronDown, ChevronRight, Copy, ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import copy from 'copy-to-clipboard';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { openExternalLink } from '@/lib/runtime';

interface BehaviourViewerProps {
  data: any;
}

export function BehaviourViewer({ data }: BehaviourViewerProps) {
  // Parse do JSON - pode vir em diferentes estruturas
  let attributes: any = {};
  let sandboxName = 'Unknown Sandbox';
  let analysisDate = 'N/A';



  // Tentar diferentes estruturas de resposta
  if (!data) {
    return (
      <div className="w-full flex flex-col items-center justify-center text-foreground-muted opacity-50 py-12">
        <Activity className="h-16 w-16 mb-4" />
        <p className="text-sm">No behaviour data available</p>
      </div>
    );
  }

  // Estrutura 1: { success: true, data: { data: { attributes: {...} } } }
  if (data.success && data.data?.data?.attributes) {

    attributes = data.data.data.attributes;
  }
  // Structure 2: { success: true, data: { data: {...} } } - data.data is already the object
  else if (data.success && data.data?.data && typeof data.data.data === 'object') {

    const innerData = data.data.data;
    if (innerData.attributes) {
      attributes = innerData.attributes;
    } else {
      // data.data is already the attributes object
      attributes = innerData;
    }
  }
  // Structure 3: { success: true, data: {...} } - data is already the object
  else if (data.success && data.data && typeof data.data === 'object') {

    if (data.data.attributes) {
      attributes = data.data.attributes;
    } else {
      attributes = data.data;
    }
  }
  // Estrutura 4: { data: { data: { attributes: {...} } } }
  else if (data.data?.data?.attributes) {

    attributes = data.data.data.attributes;
  }
  // Estrutura 5: { data: { attributes: {...} } }
  else if (data.data?.attributes) {

    attributes = data.data.attributes;
  }
  // Structure 6: { data: {...} } - data is already the object
  else if (data.data && typeof data.data === 'object') {

    attributes = data.data;
  }
  // Estrutura 7: { attributes: {...} }
  else if (data.attributes) {

    attributes = data.attributes;
  }
  // Structure 8: Direct (already attributes)
  else if (data.sandbox_name || data.behash || data.analysis_date) {

    attributes = data;
  }
  else {
    console.error('BehaviourViewer - Unknown data structure:', data);
    return (
      <div className="w-full flex flex-col items-center justify-center text-foreground-muted opacity-50 py-12">
        <Activity className="h-16 w-16 mb-4" />
        <p className="text-sm">Unable to parse behaviour data</p>
        <p className="text-xs mt-2">Check console for details</p>
      </div>
    );
  }

  sandboxName = attributes.sandbox_name || 'Unknown Sandbox';
  analysisDate = attributes.analysis_date 
    ? new Date(attributes.analysis_date * 1000).toLocaleString()
    : 'N/A';

  

  // Check if we have valid data
  const hasData = Object.keys(attributes).length > 0;
  if (!hasData) {
    return (
      <div className="w-full flex flex-col items-center justify-center text-foreground-muted opacity-50 py-12">
        <Activity className="h-16 w-16 mb-4" />
        <p className="text-sm">No behaviour data available</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
         {/* MITRE ATT&CK Techniques */}
      {attributes.mitre_attack_techniques && attributes.mitre_attack_techniques.length > 0 && (
        <Section
          title="MITRE ATT&CK Techniques"
          icon={Shield}
          count={attributes.mitre_attack_techniques.length}
          defaultOpen={true}
        >
          <div className="space-y-2">
            {attributes.mitre_attack_techniques.map((technique: any, idx: number) => (
              <div key={idx} className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-xs font-bold text-red-500">{technique.id}</code>
                      {technique.severity && (
                        <Badge variant="destructive" className="text-[10px] h-5">
                          {technique.severity}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-foreground">{technique.signature_description}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => void openExternalLink(`https://attack.mitre.org/techniques/${technique.id}`)}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Sigma Analysis Results */}
      {attributes.sigma_analysis_results && attributes.sigma_analysis_results.length > 0 && (
        <Section
          title="Sigma Analysis Results"
          icon={Shield}
          count={attributes.sigma_analysis_results.length}
          defaultOpen={true}
        >
          <div className="space-y-2">
            {attributes.sigma_analysis_results.map((result: any, idx: number) => (
              <div key={idx} className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-foreground">{result.rule_title}</span>
                      {result.rule_level && (
                        <Badge 
                          variant={result.rule_level === 'critical' || result.rule_level === 'high' ? 'destructive' : 'outline'}
                          className="text-[10px] h-5"
                        >
                          {result.rule_level}
                        </Badge>
                      )}
                    </div>
                    {result.rule_description && (
                      <p className="text-xs text-foreground-muted mb-2">{result.rule_description}</p>
                    )}
                    <div className="flex items-center gap-3 text-[10px] text-foreground-muted">
                      {result.rule_author && <span>Author: {result.rule_author}</span>}
                      {result.rule_source && <span>Source: {result.rule_source}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Network Activity */}
      {(attributes.ip_traffic || attributes.http_conversations || attributes.dns_lookups || attributes.tls) && (
        <Section title="Network Activity" icon={Network} defaultOpen={true}>
          <div className="space-y-3">
            {/* IP Traffic */}
            {attributes.ip_traffic && attributes.ip_traffic.length > 0 && (
              <SubSection title="IP Traffic" count={attributes.ip_traffic.length}>
                {attributes.ip_traffic.map((traffic: any, idx: number) => (
                  <div key={idx} className="text-sm font-mono text-foreground-muted">
                    {traffic.destination_ip}:{traffic.destination_port} ({traffic.transport_layer_protocol})
                  </div>
                ))}
              </SubSection>
            )}

            {/* HTTP Conversations */}
            {attributes.http_conversations && attributes.http_conversations.length > 0 && (
              <SubSection title="HTTP Conversations" count={attributes.http_conversations.length}>
                {attributes.http_conversations.map((conv: any, idx: number) => (
                  <div key={idx} className="p-2 rounded bg-background-secondary/30 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{conv.request_method}</Badge>
                      <code className="text-xs text-primary">{conv.url}</code>
                    </div>
                    {conv.response_status_code && (
                      <div className="text-xs text-foreground-muted">
                        Status: {conv.response_status_code}
                      </div>
                    )}
                  </div>
                ))}
              </SubSection>
            )}

            {/* DNS Lookups */}
            {attributes.dns_lookups && attributes.dns_lookups.length > 0 && (
              <SubSection title="DNS Lookups" count={attributes.dns_lookups.length}>
                <ListItems items={attributes.dns_lookups} />
              </SubSection>
            )}

            {/* TLS */}
            {attributes.tls && attributes.tls.length > 0 && (
              <SubSection title="TLS Certificates" count={attributes.tls.length}>
                {attributes.tls.map((cert: any, idx: number) => (
                  <div key={idx} className="p-2 rounded bg-background-secondary/30 space-y-1 text-xs">
                    {cert.sni && <div><span className="text-foreground-muted">SNI:</span> {cert.sni}</div>}
                    {cert.ja3 && <div><span className="text-foreground-muted">JA3:</span> <code className="text-primary">{cert.ja3}</code></div>}
                    {cert.version && <div><span className="text-foreground-muted">Version:</span> {cert.version}</div>}
                  </div>
                ))}
              </SubSection>
            )}
          </div>
        </Section>
      )}

      {/* File System Activity */}
      {(attributes.files_written || attributes.files_opened || attributes.files_deleted || attributes.files_dropped) && (
        <Section title="File System Activity" icon={HardDrive} defaultOpen={true}>
          <div className="space-y-3">
            {attributes.files_dropped && attributes.files_dropped.length > 0 && (
              <SubSection title="Files Dropped" count={attributes.files_dropped.length}>
                {attributes.files_dropped.map((file: any, idx: number) => (
                  <div key={idx} className="p-2 rounded bg-red-500/5 border border-red-500/20 space-y-1">
                    <div className="text-sm font-mono text-foreground">{file.path}</div>
                    {file.sha256 && (
                      <div className="text-xs text-foreground-muted">
                        SHA256: <code className="text-primary">{file.sha256}</code>
                      </div>
                    )}
                  </div>
                ))}
              </SubSection>
            )}
            {attributes.files_written && attributes.files_written.length > 0 && (
              <SubSection title="Files Written" count={attributes.files_written.length}>
                <ListItems items={attributes.files_written} mono />
              </SubSection>
            )}
            {attributes.files_opened && attributes.files_opened.length > 0 && (
              <SubSection title="Files Opened" count={attributes.files_opened.length}>
                <ListItems items={attributes.files_opened} mono />
              </SubSection>
            )}
            {attributes.files_deleted && attributes.files_deleted.length > 0 && (
              <SubSection title="Files Deleted" count={attributes.files_deleted.length}>
                <ListItems items={attributes.files_deleted} mono />
              </SubSection>
            )}
          </div>
        </Section>
      )}

      {/* Process Activity */}
      {(attributes.processes_created || attributes.processes_tree || attributes.processes_terminated || attributes.command_executions) && (
        <Section title="Process Activity" icon={Cpu} defaultOpen={true}>
          <div className="space-y-3">
            {attributes.processes_tree && attributes.processes_tree.length > 0 && (
              <SubSection title="Process Tree" count={attributes.processes_tree.length}>
                {attributes.processes_tree.map((proc: any, idx: number) => (
                  <div key={idx} className="p-2 rounded bg-background-secondary/30 text-sm">
                    <span className="font-mono text-foreground">{proc.name}</span>
                    {proc.process_id && (
                      <span className="text-foreground-muted ml-2">(PID: {proc.process_id})</span>
                    )}
                  </div>
                ))}
              </SubSection>
            )}
            {attributes.command_executions && attributes.command_executions.length > 0 && (
              <SubSection title="Command Executions" count={attributes.command_executions.length}>
                <ListItems items={attributes.command_executions} mono />
              </SubSection>
            )}
            {attributes.processes_created && attributes.processes_created.length > 0 && (
              <SubSection title="Processes Created" count={attributes.processes_created.length}>
                <ListItems items={attributes.processes_created} />
              </SubSection>
            )}
            {attributes.processes_terminated && attributes.processes_terminated.length > 0 && (
              <SubSection title="Processes Terminated" count={attributes.processes_terminated.length}>
                <ListItems items={attributes.processes_terminated} />
              </SubSection>
            )}
          </div>
        </Section>
      )}

      {/* Registry Activity (Windows) */}
      {(attributes.registry_keys_set || attributes.registry_keys_opened || attributes.registry_keys_deleted) && (
        <Section title="Registry Activity" icon={Database} defaultOpen={false}>
          <div className="space-y-3">
            {attributes.registry_keys_set && attributes.registry_keys_set.length > 0 && (
              <SubSection title="Registry Keys Set" count={attributes.registry_keys_set.length}>
                {attributes.registry_keys_set.map((reg: any, idx: number) => (
                  <div key={idx} className="p-2 rounded bg-background-secondary/30 space-y-1">
                    <div className="text-sm font-mono text-foreground">{reg.key}</div>
                    <div className="text-xs text-foreground-muted">Value: {reg.value}</div>
                  </div>
                ))}
              </SubSection>
            )}
            {attributes.registry_keys_opened && attributes.registry_keys_opened.length > 0 && (
              <SubSection title="Registry Keys Opened" count={attributes.registry_keys_opened.length}>
                <ListItems items={attributes.registry_keys_opened} mono />
              </SubSection>
            )}
            {attributes.registry_keys_deleted && attributes.registry_keys_deleted.length > 0 && (
              <SubSection title="Registry Keys Deleted" count={attributes.registry_keys_deleted.length}>
                <ListItems items={attributes.registry_keys_deleted} mono />
              </SubSection>
            )}
          </div>
        </Section>
      )}

      {/* Modules & DLLs */}
      {attributes.modules_loaded && attributes.modules_loaded.length > 0 && (
        <Section title="Modules Loaded" icon={FileCode} count={attributes.modules_loaded.length} defaultOpen={false}>
          <ListItems items={attributes.modules_loaded} mono />
        </Section>
      )}

      {/* Mutexes */}
      {(attributes.mutexes_created || attributes.mutexes_opened) && (
        <Section title="Mutexes" icon={Key} defaultOpen={false}>
          <div className="space-y-3">
            {attributes.mutexes_created && attributes.mutexes_created.length > 0 && (
              <SubSection title="Mutexes Created" count={attributes.mutexes_created.length}>
                <ListItems items={attributes.mutexes_created} mono />
              </SubSection>
            )}
            {attributes.mutexes_opened && attributes.mutexes_opened.length > 0 && (
              <SubSection title="Mutexes Opened" count={attributes.mutexes_opened.length}>
                <ListItems items={attributes.mutexes_opened} mono />
              </SubSection>
            )}
          </div>
        </Section>
      )}

      {/* Services (Windows) */}
      {(attributes.services_created || attributes.services_started || attributes.services_opened) && (
        <Section title="Services" icon={Settings} defaultOpen={false}>
          <div className="space-y-3">
            {attributes.services_created && attributes.services_created.length > 0 && (
              <SubSection title="Services Created" count={attributes.services_created.length}>
                <ListItems items={attributes.services_created} />
              </SubSection>
            )}
            {attributes.services_started && attributes.services_started.length > 0 && (
              <SubSection title="Services Started" count={attributes.services_started.length}>
                <ListItems items={attributes.services_started} />
              </SubSection>
            )}
            {attributes.services_opened && attributes.services_opened.length > 0 && (
              <SubSection title="Services Opened" count={attributes.services_opened.length}>
                <ListItems items={attributes.services_opened} />
              </SubSection>
            )}
          </div>
        </Section>
      )}

      {/* Highlighted Information */}
      {(attributes.calls_highlighted || attributes.text_highlighted) && (
        <Section title="Highlighted Information" icon={AlertTriangle} defaultOpen={false}>
          <div className="space-y-3">
            {attributes.calls_highlighted && attributes.calls_highlighted.length > 0 && (
              <SubSection title="API Calls" count={attributes.calls_highlighted.length}>
                <ListItems items={attributes.calls_highlighted} mono />
              </SubSection>
            )}
            {attributes.text_highlighted && attributes.text_highlighted.length > 0 && (
              <SubSection title="Text Highlighted" count={attributes.text_highlighted.length}>
                <ListItems items={attributes.text_highlighted} />
              </SubSection>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}

// Section Component
interface SectionProps {
  title: string;
  icon: any;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Section({ title, icon: Icon, count, defaultOpen = false, children }: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Card className="overflow-hidden border border-border-subtle">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <button className="h-5 w-5 flex items-center justify-center rounded hover:bg-white/10 text-foreground-muted">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          <Icon className={cn("h-5 w-5", isOpen ? "text-primary" : "text-foreground-muted")} />
          <span className={cn("text-sm font-bold", isOpen ? "text-foreground" : "text-foreground-muted")}>
            {title}
          </span>
          {count !== undefined && (
            <Badge variant="outline" className="text-xs">
              {count}
            </Badge>
          )}
        </div>
      </div>
      {isOpen && (
        <div className="p-4 pt-0 border-t border-border-subtle/50">
          {children}
        </div>
      )}
    </Card>
  );
}

// SubSection Component
interface SubSectionProps {
  title: string;
  count?: number;
  children: React.ReactNode;
}

function SubSection({ title, count, children }: SubSectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h4 className="text-xs font-bold text-foreground-muted uppercase">{title}</h4>
        {count !== undefined && (
          <span className="text-xs text-foreground-muted">({count})</span>
        )}
      </div>
      <div className="space-y-1 pl-3 border-l-2 border-border-subtle">
        {children}
      </div>
    </div>
  );
}

// ListItems Component
interface ListItemsProps {
  items: any[];
  mono?: boolean;
}

function ListItems({ items, mono = false }: ListItemsProps) {
  const [showAll, setShowAll] = useState(false);
  const displayItems = showAll ? items : items.slice(0, 10);

  return (
    <div className="space-y-1">
      {displayItems.map((item: any, idx: number) => {
        // If the item is an object, render it specially
        if (typeof item === 'object' && item !== null) {
          return (
            <div
              key={idx}
              className="group/item p-2 rounded hover:bg-white/5 transition-colors"
            >
              <div className="space-y-1">
                {Object.entries(item).map(([key, value]) => (
                  <div key={key} className="flex items-start gap-2 text-xs">
                    <span className="text-foreground-muted font-medium min-w-[100px]">{key}:</span>
                    <span className={cn("text-foreground break-all flex-1", mono && "font-mono")}>
                      {Array.isArray(value) ? value.join(', ') : String(value)}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  copy(JSON.stringify(item, null, 2));
                  toast.success('Copied to clipboard');
                }}
                className="opacity-0 group-hover/item:opacity-100 p-1 hover:bg-white/10 rounded text-foreground-muted hover:text-primary transition-opacity mt-1"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
          );
        }

        // Item is string or primitive
        return (
          <div
            key={idx}
            className="group/item flex items-center justify-between p-2 rounded hover:bg-white/5 transition-colors"
          >
            <span className={cn("text-sm text-foreground-muted break-all", mono && "font-mono")}>
              {String(item)}
            </span>
            <button
              onClick={() => {
                copy(String(item));
                toast.success('Copied to clipboard');
              }}
              className="opacity-0 group-hover/item:opacity-100 p-1 hover:bg-white/10 rounded text-foreground-muted hover:text-primary transition-opacity ml-2 shrink-0"
            >
              <Copy className="h-3 w-3" />
            </button>
          </div>
        );
      })}
      {items.length > 10 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAll(!showAll)}
          className="w-full text-xs text-foreground-muted hover:text-primary"
        >
          {showAll ? 'Show Less' : `Show All (${items.length - 10} more)`}
        </Button>
      )}
    </div>
  );
}
