import { readFile } from 'fs/promises';
import { execCommand } from '../utils/exec.js';
import { NETWORK_INTERFACE } from '../config.js';
import type { SystemStats } from '../types.js';

// Store previous network stats for calculating rate
let prevNetworkStats: { rx: number; tx: number; timestamp: number } | null = null;

/**
 * Get CPU usage from /proc/stat
 */
async function getCpuUsage(): Promise<number> {
    try {
        const { stdout } = await execCommand('top', ['-bn1', '-p', '0']);
        // Parse the %Cpu(s) line: %Cpu(s):  5.9 us,  1.2 sy,  0.0 ni, 92.7 id, ...
        const cpuLine = stdout.split('\n').find(line => line.includes('Cpu(s)'));
        if (cpuLine) {
            const idleMatch = cpuLine.match(/(\d+\.?\d*)\s*id/);
            if (idleMatch) {
                const idle = parseFloat(idleMatch[1]);
                return parseFloat((100 - idle).toFixed(2));
            }
        }
        return 0;
    } catch (error) {
        console.error('Failed to get CPU usage:', error);
        return 0;
    }
}

/**
 * Get RAM usage from /proc/meminfo or free command
 */
async function getRamStats(): Promise<{ used: number; total: number; usage: number }> {
    try {
        const { stdout } = await execCommand('free', ['-b']);
        // Parse: Mem:     total       used       free     shared    buff/cache   available
        const memLine = stdout.split('\n').find(line => line.startsWith('Mem:'));
        if (memLine) {
            const parts = memLine.split(/\s+/);
            const total = parseInt(parts[1], 10);
            const used = parseInt(parts[2], 10);
            const totalGB = total / (1024 ** 3);
            const usedGB = used / (1024 ** 3);
            return {
                total: parseFloat(totalGB.toFixed(2)),
                used: parseFloat(usedGB.toFixed(2)),
                usage: parseFloat(((usedGB / totalGB) * 100).toFixed(2)),
            };
        }
        return { used: 0, total: 0, usage: 0 };
    } catch (error) {
        console.error('Failed to get RAM stats:', error);
        return { used: 0, total: 0, usage: 0 };
    }
}

/**
 * Get disk usage for root partition
 */
async function getDiskStats(): Promise<{ used: number; total: number; usage: number }> {
    try {
        const { stdout } = await execCommand('df', ['-B1', '/']);
        // Parse: Filesystem     1B-blocks         Used    Available Use% Mounted on
        const lines = stdout.trim().split('\n');
        if (lines.length >= 2) {
            const parts = lines[1].split(/\s+/);
            const total = parseInt(parts[1], 10);
            const used = parseInt(parts[2], 10);
            const totalGB = total / (1024 ** 3);
            const usedGB = used / (1024 ** 3);
            return {
                total: parseFloat(totalGB.toFixed(2)),
                used: parseFloat(usedGB.toFixed(2)),
                usage: parseFloat(((usedGB / totalGB) * 100).toFixed(2)),
            };
        }
        return { used: 0, total: 0, usage: 0 };
    } catch (error) {
        console.error('Failed to get disk stats:', error);
        return { used: 0, total: 0, usage: 0 };
    }
}

/**
 * Get network throughput from /proc/net/dev
 */
async function getNetworkStats(): Promise<{ upload: number; download: number }> {
    try {
        const content = await readFile('/proc/net/dev', 'utf-8');
        // Find the interface line
        const interfaceLine = content.split('\n').find(line =>
            line.trim().startsWith(NETWORK_INTERFACE) ||
            line.trim().startsWith('ens') ||
            line.trim().startsWith('enp')
        );

        if (interfaceLine) {
            // Format: interface: rx_bytes rx_packets ... tx_bytes tx_packets ...
            const parts = interfaceLine.split(/\s+/).filter(Boolean);
            const rx = parseInt(parts[1], 10); // bytes received
            const tx = parseInt(parts[9], 10); // bytes transmitted
            const now = Date.now();

            if (prevNetworkStats) {
                const timeDelta = (now - prevNetworkStats.timestamp) / 1000; // seconds
                const rxDelta = rx - prevNetworkStats.rx;
                const txDelta = tx - prevNetworkStats.tx;

                // Convert bytes/sec to Mbps
                const downloadMbps = (rxDelta * 8) / (timeDelta * 1000000);
                const uploadMbps = (txDelta * 8) / (timeDelta * 1000000);

                prevNetworkStats = { rx, tx, timestamp: now };

                return {
                    download: parseFloat(Math.max(0, downloadMbps).toFixed(2)),
                    upload: parseFloat(Math.max(0, uploadMbps).toFixed(2)),
                };
            }

            prevNetworkStats = { rx, tx, timestamp: now };
        }

        return { upload: 0, download: 0 };
    } catch (error) {
        console.error('Failed to get network stats:', error);
        return { upload: 0, download: 0 };
    }
}

/**
 * Get all system statistics
 */
export async function getSystemStats(): Promise<SystemStats> {
    const [cpu, ram, disk, network] = await Promise.all([
        getCpuUsage(),
        getRamStats(),
        getDiskStats(),
        getNetworkStats(),
    ]);

    return {
        cpu: { usage: cpu },
        ram,
        disk,
        network,
    };
}
