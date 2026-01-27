
import React from 'react';
import type { SystemStats } from '../types';
import { StatCard } from './StatCard';
import { CpuIcon } from './icons/CpuIcon';
import { MemoryIcon } from './icons/MemoryIcon';
import { DiskIcon } from './icons/DiskIcon';
import { NetworkIcon } from './icons/NetworkIcon';

interface SystemMonitorProps {
  stats: SystemStats | null;
}

export const SystemMonitor: React.FC<SystemMonitorProps> = ({ stats }) => {
  const renderValue = (value?: number) => {
    return stats ? `${value?.toFixed(2) || '0.00'}` : '-';
  };

  return (
    <div className="bg-gray-800/50 rounded-lg shadow-lg p-6 backdrop-blur-sm">
      <h2 className="text-xl font-semibold text-white mb-4">System Monitor</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={<CpuIcon />}
          title="CPU Usage"
          value={`${renderValue(stats?.cpu.usage)}%`}
          progress={stats?.cpu.usage}
        />
        <StatCard
          icon={<MemoryIcon />}
          title="RAM Usage"
          value={`${renderValue(stats?.ram.used)} / ${stats?.ram.total || '-'} GB`}
          progress={stats?.ram.usage}
        />
        <StatCard
          icon={<DiskIcon />}
          title="Disk Usage"
          value={`${renderValue(stats?.disk.used)} / ${stats?.disk.total || '-'} GB`}
          progress={stats?.disk.usage}
        />
        <StatCard
          icon={<NetworkIcon />}
          title="Network"
          value={`↓${renderValue(stats?.network.download)} / ↑${renderValue(stats?.network.upload)} Mbps`}
        />
      </div>
    </div>
  );
};
