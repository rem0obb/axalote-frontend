import { Cpu, HardDrive, Zap, Clock, Activity } from 'lucide-react';
import { useHeartbeat } from '@/hooks/useEndpointData';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

interface SystemMonitorProps {
    collapsed?: boolean;
}

export function SystemMonitor({ collapsed }: SystemMonitorProps) {
    const { data: heartbeat, error } = useHeartbeat();

    const memoryProgress = useMemo(() => {
        if (!heartbeat) return 0;
        return (heartbeat.memory.used / heartbeat.memory.total) * 100;
    }, [heartbeat]);

    const cpuUsage = heartbeat?.cpu.usage || 0;

    const formatUptime = (seconds: number) => {
        const days = Math.floor(seconds / (24 * 3600));
        const hours = Math.floor((seconds % (24 * 3600)) / 3600);
        const mins = Math.floor((seconds % 3600) / 60);

        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${mins}m`;
        return `${mins}m`;
    };

    if (collapsed) {
        return (
            <div className="flex flex-col items-center gap-4 py-4 animate-in fade-in duration-500">
                <div className="relative group">
                    <Activity className={cn(
                        "h-4 w-4 transition-colors duration-500",
                        cpuUsage > 80 ? "text-danger animate-pulse" : cpuUsage > 50 ? "text-warning" : "text-primary"
                    )} />
                    <div className="absolute left-full ml-2 px-2 py-1 bg-background-secondary border border-border-subtle rounded text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50">
                        CPU: {cpuUsage.toFixed(1)}%
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4 animate-in slide-in-from-bottom-2 duration-700">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground-muted">System Node Status</span>
                <div className="flex gap-1">
                    <span className="h-1 w-1 rounded-full bg-primary animate-pulse" />
                    <span className="h-1 w-1 rounded-full bg-primary/40" />
                </div>
            </div>

            {/* CPU */}
            <div className="space-y-1.5">
                <div className="flex justify-between items-end text-[10px] font-mono">
                    <div className="flex items-center gap-1.5 text-foreground-muted">
                        <Cpu size={12} className="text-primary" />
                        <span>CPU UTILIZATION</span>
                    </div>
                    <span className={cn(
                        "font-bold",
                        cpuUsage > 80 ? "text-danger" : cpuUsage > 50 ? "text-warning" : "text-primary"
                    )}>
                        {cpuUsage.toFixed(1)}%
                    </span>
                </div>
                <div className="h-1 w-full bg-background-secondary rounded-full overflow-hidden border border-border-subtle/50">
                    <div
                        className={cn(
                            "h-full transition-all duration-1000 ease-out rounded-full",
                            cpuUsage > 80 ? "bg-danger" : cpuUsage > 50 ? "bg-warning" : "bg-primary"
                        )}
                        style={{ width: `${cpuUsage}%` }}
                    />
                </div>
            </div>

            {/* MEMORY */}
            <div className="space-y-1.5">
                <div className="flex justify-between items-end text-[10px] font-mono">
                    <div className="flex items-center gap-1.5 text-foreground-muted">
                        <Zap size={12} className="text-success" />
                        <span>MEMORY (RAM)</span>
                    </div>
                    <span className="text-foreground-muted">
                        {Math.round(heartbeat?.memory.used || 0)} MB / {Math.round(heartbeat?.memory.total || 0)} MB
                    </span>
                </div>
                <div className="h-1 w-full bg-background-secondary rounded-full overflow-hidden border border-border-subtle/50">
                    <div
                        className="h-full bg-success transition-all duration-1000 ease-out rounded-full"
                        style={{ width: `${memoryProgress}%` }}
                    />
                </div>
            </div>

            {/* DISK */}
            <div className="space-y-1.5">
                <div className="flex justify-between items-end text-[10px] font-mono">
                    <div className="flex items-center gap-1.5 text-foreground-muted">
                        <HardDrive size={12} className="text-warning" />
                        <span>DISK USAGE</span>
                    </div>
                    <span className="text-foreground-muted text-[9px]">
                        {Math.round((heartbeat?.disk.used || 0) / 1024)} GB / {Math.round((heartbeat?.disk.total || 0) / 1024)} GB
                    </span>
                </div>
                <div className="h-1 w-full bg-background-secondary rounded-full overflow-hidden border border-border-subtle/50">
                    <div
                        className="h-full bg-warning transition-all duration-1000 ease-out rounded-full"
                        style={{ width: `${heartbeat?.disk.total ? (heartbeat.disk.used / heartbeat.disk.total) * 100 : 0}%` }}
                    />
                </div>
            </div>

            {/* FOOTER STATS */}
            <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="bg-background-secondary/50 border border-border-subtle/30 rounded p-2 flex flex-col gap-1">
                    <div className="flex items-center gap-1 text-[8px] text-foreground-muted font-bold uppercase tracking-wider">
                        <Clock size={10} />
                        <span>Uptime</span>
                    </div>
                    <span className="text-[10px] font-mono text-foreground font-medium">
                        {heartbeat ? formatUptime(heartbeat.uptime) : '--'}
                    </span>
                </div>
                <div className="bg-background-secondary/50 border border-border-subtle/30 rounded p-2 flex flex-col gap-1">
                    <div className="flex items-center gap-1 text-[8px] text-foreground-muted font-bold uppercase tracking-wider">
                        <Activity size={10} />
                        <span>Load</span>
                    </div>
                    <span className="text-[10px] font-mono text-foreground font-medium">
                        {heartbeat?.loadavg?.[0].toFixed(2) || '--'}
                    </span>
                </div>
            </div>

            {/* SCANNER ACTIVE INDICATOR */}
        </div>
    );
}
