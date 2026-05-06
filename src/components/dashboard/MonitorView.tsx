import { SystemMonitor } from './SystemMonitor';

export function MonitorView() {
    return (
        <div className="h-full flex flex-col">
            <SystemMonitor collapsed={false} />
        </div>
    );
}
