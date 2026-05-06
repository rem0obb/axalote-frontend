import { lazy, Suspense } from 'react';
import { LoadingState } from '@/components/common/LoadingState';

const FilesView = lazy(() => import('@/components/dashboard/FilesView').then(m => ({ default: m.FilesView })));
const YaraRulesView = lazy(() => import('@/components/dashboard/YaraRulesView'));
const HuntView = lazy(() => import('@/components/dashboard/HuntView'));
const SettingsView = lazy(() => import('@/components/dashboard/SettingsView').then(m => ({ default: m.SettingsView })));
const VirusTotalView = lazy(() => import('@/components/dashboard/VirusTotalView').then(m => ({ default: m.VirusTotalView })));
const DeobfuscatorView = lazy(() => import('@/components/dashboard/DeobfuscatorView'));
const PluginManagerView = lazy(() => import('@/components/dashboard/PluginManagerView'));
import { getEndpointById, ENDPOINTS } from '@/config/endpoints.config';
import { useFileRecords, useYaraRules, useYaraSourceFiles } from '@/hooks/useEndpointData';
import { Inbox } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { MainLayoutContextType } from '@/components/layout/MainLayout';

const Index = () => {
  const { activeEndpoint, navbarPosition } = useOutletContext<MainLayoutContextType>();
  const endpoint = getEndpointById(activeEndpoint) || ENDPOINTS[0];

  const filesQuery = useFileRecords();
  const rulesQuery = useYaraRules();
  const sourcesQuery = useYaraSourceFiles();

  const isFiles = activeEndpoint === 'files';
  const isRules = activeEndpoint === 'rules';
  const isHunt = activeEndpoint === 'hunt';
  const isSettings = activeEndpoint === 'settings';
  const isVirusTotal = activeEndpoint === 'virustotal';
  const isDeobfuscator = activeEndpoint === 'deobfuscator';
  const isPlugins = activeEndpoint === 'plugins';

  const currentQuery = isFiles ? filesQuery : (isRules ? rulesQuery : null);

  return (
    <Suspense fallback={<LoadingState message="Loading view..." />}>
      {isHunt ? (
        <div className="h-full overflow-hidden">
          <HuntView />
        </div>
      ) : (
        <div className="h-full overflow-hidden p-6 flex flex-col">
          {isFiles && <FilesView />}
          {isVirusTotal && <VirusTotalView />}
          {isRules && <YaraRulesView />}
          {isSettings && <SettingsView />}
          {isDeobfuscator && <DeobfuscatorView />}
          {isPlugins && <PluginManagerView />}

          {!isFiles && !isVirusTotal && !isRules && !isSettings && !isDeobfuscator && !isPlugins && (
            <div className="flex items-center justify-center min-h-[400px] p-12">
              <div className="text-center">
                <Inbox className="h-12 w-12 text-foreground-muted mx-auto mb-3 opacity-20" />
                <p className="text-foreground-muted font-medium">Endpoint not implemented yet</p>
              </div>
            </div>
          )}
        </div>
      )}
    </Suspense>
  );
};

export default Index;
