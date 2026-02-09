import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import { discoverGameServers } from '../config.js';

// RCON configuration - can be customized per server in the future
const RCON_CONFIG = {
    host: 'localhost',
    port: 25575,
    password: '2106',
};

interface RconSession {
    process: ChildProcess;
    cleanup: () => void;
}

/**
 * Start an interactive RCON session for a Minecraft server
 * Uses mcrcon in interactive mode
 */
export function startRconSession(
    serverId: string,
    onOutput: (line: string) => void,
    onError: (error: Error) => void
): { cleanup: () => void; sendCommand: (cmd: string) => void } {
    // Spawn mcrcon in terminal mode (interactive)
    const proc = spawn('mcrcon', [
        '-H', RCON_CONFIG.host,
        '-P', RCON_CONFIG.port.toString(),
        '-p', RCON_CONFIG.password,
        '-t', // Terminal mode for interactive use
    ], {
        stdio: ['pipe', 'pipe', 'pipe'],
    });

    let buffer = '';

    proc.stdout?.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            // Filter out the mcrcon prompt if present
            const cleanLine = line.replace(/^> /, '').trim();
            if (cleanLine) {
                onOutput(cleanLine);
            }
        }
    });

    proc.stderr?.on('data', (chunk: Buffer) => {
        const errorMsg = chunk.toString().trim();
        if (errorMsg) {
            onOutput(`[RCON Error] ${errorMsg}`);
        }
    });

    proc.on('error', (error) => {
        onError(error);
    });

    proc.on('close', (code) => {
        if (code !== 0 && code !== null) {
            onOutput(`[RCON] Connection closed with code ${code}`);
        }
    });

    const sendCommand = (cmd: string) => {
        if (proc.stdin && !proc.killed) {
            proc.stdin.write(cmd + '\n');
        }
    };

    const cleanup = () => {
        console.log(`Stopping RCON session for ${serverId}`);
        if (!proc.killed) {
            proc.stdin?.end();
            proc.kill('SIGTERM');
        }
    };

    return { cleanup, sendCommand };
}

/**
 * Send a single RCON command (non-interactive)
 */
export function sendRconCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const proc = spawn('mcrcon', [
            '-H', RCON_CONFIG.host,
            '-P', RCON_CONFIG.port.toString(),
            '-p', RCON_CONFIG.password,
            command,
        ]);

        let output = '';
        let errorOutput = '';

        proc.stdout?.on('data', (chunk: Buffer) => {
            output += chunk.toString();
        });

        proc.stderr?.on('data', (chunk: Buffer) => {
            errorOutput += chunk.toString();
        });

        proc.on('close', (code) => {
            if (code === 0) {
                resolve(output.trim());
            } else {
                reject(new Error(errorOutput || `mcrcon exited with code ${code}`));
            }
        });

        proc.on('error', reject);
    });
}

/**
 * Get online players count and list
 * Executes the 'list' command via RCON
 */
export async function getOnlinePlayers(serverId: string): Promise<{
    count: number;
    max: number;
    players: string[];
}> {
    try {
        const response = await sendRconCommand('list');
        // Parse response: "There are X of Y max players online: PlayerA, PlayerB, PlayerC"
        // or "There are X of Y players online:" (no players)
        const match = response.match(/There are (\d+) of a max(imum)? of (\d+) players online:?\s*(.*)/i);

        if (match) {
            const count = parseInt(match[1], 10);
            const max = parseInt(match[3], 10);
            const playerList = match[4] ? match[4].split(',').map(p => p.trim()).filter(Boolean) : [];

            return { count, max, players: playerList };
        }

        // Fallback if parsing fails
        return { count: 0, max: 20, players: [] };
    } catch (error) {
        console.error('Error getting online players:', error);
        return { count: 0, max: 20, players: [] };
    }
}

/**
 * Send a formatted chat message to all players using tellraw
 * Message appears in-game as: <username> message
 */
export async function sendTellrawMessage(
    serverId: string,
    username: string,
    message: string,
    color: string = 'white'
): Promise<boolean> {
    try {
        // Sanitize username and message to prevent JSON injection
        const safeUsername = username.replace(/["\\]/g, '');
        const safeMessage = message.replace(/["\\]/g, '');

        // Format as tellraw JSON
        const tellrawCommand = `tellraw @a {"text":"<${safeUsername}> ${safeMessage}","color":"${color}"}`;

        await sendRconCommand(tellrawCommand);
        return true;
    } catch (error) {
        console.error('Error sending tellraw message:', error);
        return false;
    }
}

/**
 * Check if a server is a Minecraft server (has "minecraft" in the name)
 */
export function isMinecraftServer(serverName: string): boolean {
    return serverName.toLowerCase().includes('minecraft');
}

/**
 * Validate that a server ID is valid and is a Minecraft server
 */
export async function validateMinecraftServer(serverId: string): Promise<boolean> {
    const servers = await discoverGameServers();
    const server = servers.find(s => s.id === serverId);
    if (!server) return false;
    return isMinecraftServer(server.name) || isMinecraftServer(server.id);
}
