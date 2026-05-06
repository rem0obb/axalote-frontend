import { useEffect, useMemo, useState } from 'react';
import { Loader2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { apiService, DeobfuscatorResult } from '@/services/api.service';

const DEOBFUSCATION_MODES: Array<{ id: 'code' | 'file'; label: string; hint: string }> = [
  { id: 'code', label: 'Snippet', hint: 'Paste obfuscated source and run the JS driver directly.' },
  { id: 'file', label: 'Stored File', hint: 'Use a SHA256 already indexed by the engine.' },
];

const INITIAL_CODE = `var _0x1a2b=['hello','world'];(function(){console.log(_0x1a2b[0]);})();`;
const DEFAULT_OPTIONS = `{
  "max_iterations": 8
}`;
const AUTO_LANGUAGE = '__auto__';

export default function DeobfuscatorView() {
  const [mode, setMode] = useState<'code' | 'file'>('code');
  const [code, setCode] = useState(INITIAL_CODE);
  const [sha256, setSha256] = useState('');
  const [language, setLanguage] = useState('js');
  const [languages, setLanguages] = useState<string[]>(['js']);
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DeobfuscatorResult['result'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    (async () => {
      const response = await apiService.getDeobfuscationLanguages();
      if (!isActive) return;

      if (response.error) {
        toast.error('Failed to load deobfuscation languages');
        return;
      }

      const langs = response.data?.languages;
      if (langs && langs.length > 0) {
        setLanguages(langs);
        setLanguage(prev => (langs.includes(prev) ? prev : langs[0]));
      }
    })();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (mode === 'code' && !language && languages.length > 0) {
      setLanguage(languages[0]);
    }
  }, [language, languages, mode]);

  const modeConfig = useMemo(
    () => DEOBFUSCATION_MODES.find(item => item.id === mode) ?? DEOBFUSCATION_MODES[0],
    [mode]
  );

  const selectableLanguages = useMemo(() => {
    if (mode === 'file') {
      return [{ value: AUTO_LANGUAGE, label: 'auto (from filename)' }, ...languages.map(lang => ({ value: lang, label: lang }))];
    }

    return languages.map(lang => ({ value: lang, label: lang }));
  }, [languages, mode]);

  const selectedLanguage = mode === 'file' ? language || AUTO_LANGUAGE : language;

  const buildOptions = () => {
    if (!options.trim()) return {};
    try {
      return JSON.parse(options);
    } catch {
      throw new Error('Options must be valid JSON.');
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setResult(null);

    const isCodeMode = mode === 'code';
    if ((isCodeMode && !code.trim()) || (!isCodeMode && !sha256.trim())) {
      setError(isCodeMode ? 'Paste some code to analyze.' : 'Enter the file SHA256 to deobfuscate.');
      return;
    }

    let payloadOptions = {};
    try {
      payloadOptions = buildOptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Options must be valid JSON.');
      return;
    }

    setLoading(true);
    try {
      const normalizedLanguage = mode === 'file' && selectedLanguage === AUTO_LANGUAGE ? undefined : selectedLanguage;
      const response = isCodeMode
        ? await apiService.deobfuscate(code, normalizedLanguage || 'js', payloadOptions)
        : await apiService.deobfuscateFile(sha256.trim(), normalizedLanguage, payloadOptions);

      if (response.error) {
        setError(response.error.message);
        toast.error('Deobfuscation failed');
        return;
      }

      if (!response.data?.success || !response.data.result) {
        const message = (response.data as any)?.message || 'Unexpected response from the engine.';
        setError(message);
        toast.error(message);
        return;
      }

      setResult(response.data.result);
      toast.success('Deobfuscation complete');
    } finally {
      setLoading(false);
    }
  };

  const metadata = result?.metadata;

  return (
    <div className="flex h-full flex-1 flex-col gap-6 overflow-auto">
      <div className="flex flex-wrap items-center gap-3">
        {DEOBFUSCATION_MODES.map(item => (
          <Button
            key={item.id}
            variant={mode === item.id ? 'default' : 'outline'}
            onClick={() => setMode(item.id)}
            size="sm"
          >
            {item.label}
          </Button>
        ))}
        <div className="ml-auto text-[10px] uppercase tracking-[0.5em] text-foreground-muted">Static Driver</div>
      </div>

      <Card className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4 rounded-xl border border-border-subtle bg-background/30 p-4">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.4em] text-foreground-muted">Mode</p>
            <h3 className="text-lg font-black text-foreground">{modeConfig.label}</h3>
            <p className="max-w-2xl text-sm text-foreground-muted">{modeConfig.hint}</p>
          </div>
          <div className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-primary">
            <Wand2 className="h-5 w-5" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Language</Label>
            <Select value={selectedLanguage} onValueChange={value => setLanguage(value === AUTO_LANGUAGE ? '' : value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {selectableLanguages.map(lang => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="hidden">Notes</Label>
            <p className="pt-7 text-xs text-foreground-muted">
              Available drivers come from the backend. File mode can auto-detect the language from the stored filename.
            </p>
          </div>
        </div>

        {mode === 'code' ? (
          <div className="space-y-2">
            <Label>Source Snippet</Label>
            <Textarea
              value={code}
              onChange={event => setCode(event.target.value)}
              rows={10}
              spellCheck={false}
              className="font-mono text-xs"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Stored File SHA256</Label>
            <Input
              value={sha256}
              onChange={event => setSha256(event.target.value)}
              placeholder="abc123..."
              className="font-mono text-xs"
            />
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label>Options (JSON)</Label>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px]" onClick={() => setOptions(DEFAULT_OPTIONS)}>
              Reset Example
            </Button>
          </div>
          <Textarea
            value={options}
            onChange={event => setOptions(event.target.value)}
            rows={5}
            spellCheck={false}
            className="font-mono text-xs"
          />
        </div>

        {error && <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>}

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-foreground-muted">
            Current JS driver supports pass toggles and `max_iterations`.
          </p>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Deobfuscating
              </span>
            ) : (
              'Run'
            )}
          </Button>
        </div>
      </Card>

      {result && (
        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-foreground-muted">Result</p>
              <h3 className="text-lg font-black text-foreground">Restored Code</h3>
            </div>
            <span className="text-[10px] uppercase tracking-[0.4em] text-foreground-muted">{result.engine}</span>
          </div>

          <Textarea value={result.code} readOnly rows={10} className="bg-background-secondary font-mono text-xs" />

          {metadata && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-[0.4em] text-foreground-muted">Iterations</p>
                  <p className="text-sm font-semibold">{metadata.iterations}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-[0.4em] text-foreground-muted">Changes</p>
                  <p className="text-sm font-semibold">{metadata.changes}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-[0.4em] text-foreground-muted">Signatures</p>
                  <p className="text-sm font-semibold">
                    {metadata.detected_signatures.length > 0 ? metadata.detected_signatures.join(', ') : 'None detected'}
                  </p>
                </div>
              </div>

              {metadata.warnings && metadata.warnings.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.4em] text-foreground-muted">Warnings</p>
                  <div className="grid gap-2">
                    {metadata.warnings.map((warning, index) => (
                      <div key={`${warning}-${index}`} className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2 text-sm text-amber-200">
                        {warning}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-[0.4em] text-foreground-muted">Passes</p>
                <div className="grid gap-2">
                  {metadata.passes.length > 0 ? (
                    metadata.passes.map(pass => (
                      <div key={pass.pass} className="flex items-center justify-between rounded-xl border border-border-subtle bg-background/40 px-4 py-2 text-sm font-medium">
                        <span>{pass.pass}</span>
                        <span className="text-xs text-foreground-muted">{pass.changes} changes</span>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-border-subtle bg-background/40 px-4 py-3 text-sm text-foreground-muted">
                      No transforms fired for this sample.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
