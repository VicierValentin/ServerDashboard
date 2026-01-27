import { spawnProcess } from '../utils/exec.js';
import { discoverGameServers, GAME_SERVERS_PATH } from '../config.js';
import { join } from 'path';
import type { ChildProcess } from 'child_process';

interface LogStream {
    process: ChildProcess;
    cleanup: () => void;
}

/**
 * Start streaming logs for a game server
 * Returns a cleanup function to stop the stream
 */
export function streamLogs(
    serverId: string,
    onLine: (line: string) => void,
    onError: (error: Error) => void
): () => void {
    // Build path to the server's directory and logs.sh script
    const serverDir = join(GAME_SERVERS_PATH, serverId);
    const logsScriptPath = join(serverDir, 'logs.sh');

    // Spawn the logs.sh script using bash, with cwd set to server directory
    const proc = spawnProcess('bash', [logsScriptPath], { cwd: serverDir });

    let buffer = '';

    proc.stdout?.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.trim()) {
                onLine(line);
            }
        }
    });

    proc.stderr?.on('data', (chunk: Buffer) => {
        console.error(`Log stream error for ${serverId}:`, chunk.toString());
    });

    proc.on('error', (error) => {
        onError(error);
    });

    proc.on('close', (code) => {
        if (code !== 0 && code !== null) {
            console.log(`Log stream for ${serverId} closed with code ${code}`);
        }
    });

    // Return cleanup function
    return () => {
        console.log(`Stopping log stream for ${serverId}`);
        proc.kill('SIGTERM');
    };
}

/**
 * Validate that a server ID is valid before streaming logs
 */
export async function validateServerId(serverId: string): Promise<boolean> {
    const servers = await discoverGameServers();
    return servers.some(s => s.id === serverId);
}
