import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import { discoverGameServers } from '../config.js';

// RCON configuration - configurable via environment variables
const RCON_CONFIG = {
    host: process.env.RCON_HOST || 'localhost',
    port: parseInt(process.env.RCON_PORT || '25575', 10),
    password: process.env.RCON_PASSWORD || '2106',
};

interface RconSession {
    process: ChildProcess;
    cleanup: () => void;
}

// Persistent RCON connection pool for query commands
interface QuerySession {
    process: ChildProcess;
    lastUsed: number;
    isReady: boolean;
    currentCommand: { resolve: (value: string) => void; reject: (error: Error) => void } | null;
}

const querySessionPool = new Map<string, QuerySession>();
const SESSION_TIMEOUT = 60000; // Close idle sessions after 60 seconds

// Cleanup idle query sessions periodically
setInterval(() => {
    const now = Date.now();
    for (const [serverId, session] of querySessionPool.entries()) {
        if (now - session.lastUsed > SESSION_TIMEOUT && session.isReady) {
            console.log(`Closing idle query session for ${serverId}`);
            session.process.stdin?.end();
            session.process.kill('SIGTERM');
            querySessionPool.delete(serverId);
        }
    }
}, 30000); // Check every 30 seconds

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
 * Get or create a persistent query session for a server
 */
function getQuerySession(serverId: string): QuerySession {
    let session = querySessionPool.get(serverId);
    
    if (!session || session.process.killed) {
        console.log(`Creating new persistent RCON query session for ${serverId}`);
        
        const proc = spawn('mcrcon', [
            '-H', RCON_CONFIG.host,
            '-P', RCON_CONFIG.port.toString(),
            '-p', RCON_CONFIG.password,
            '-t', // Terminal mode for persistent connection
        ], {
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        session = {
            process: proc,
            lastUsed: Date.now(),
            isReady: false,
            currentCommand: null,
        };

        let buffer = '';

        proc.stdout?.on('data', (chunk: Buffer) => {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const cleanLine = line.replace(/^> /, '').trim();
                if (cleanLine && session && session.currentCommand) {
                    // Resolve the current command with the output
                    session.currentCommand.resolve(cleanLine);
                    session.currentCommand = null;
                    session.isReady = true;
                }
            }
        });

        proc.stderr?.on('data', (chunk: Buffer) => {
            console.error(`RCON query error for ${serverId}:`, chunk.toString());
        });

        proc.on('error', (error) => {
            console.error(`RCON query process error for ${serverId}:`, error);
            if (session && session.currentCommand) {
                session.currentCommand.reject(error);
                session.currentCommand = null;
            }
            querySessionPool.delete(serverId);
        });

        proc.on('close', () => {
            console.log(`RCON query session closed for ${serverId}`);
            if (session && session.currentCommand) {
                session.currentCommand.reject(new Error('RCON connection closed'));
                session.currentCommand = null;
            }
            querySessionPool.delete(serverId);
        });

        querySessionPool.set(serverId, session);
        
        // Mark as ready after a short delay for connection establishment
        setTimeout(() => {
            if (session) {
                session.isReady = true;
            }
        }, 500);
    }

    session.lastUsed = Date.now();
    return session;
}

/**
 * Send a single RCON command using persistent connection pool
 */
export function sendRconCommand(command: string, serverId: string = 'default'): Promise<string> {
    return new Promise((resolve, reject) => {
        try {
            const session = getQuerySession(serverId);
            
            // Wait for session to be ready and no command in progress
            const attemptSend = () => {
                if (!session.isReady || session.currentCommand) {
                    // Wait a bit and retry
                    setTimeout(attemptSend, 100);
                    return;
                }
                
                const commandRef = { resolve, reject };
                session.currentCommand = commandRef;
                
                if (session.process.stdin && !session.process.killed) {
                    session.process.stdin.write(command + '\n');
                } else {
                    reject(new Error('RCON connection not available'));
                    session.currentCommand = null;
                    return;
                }

                // Timeout after 5 seconds
                setTimeout(() => {
                    if (session.currentCommand === commandRef) {
                        session.currentCommand = null;
                        session.isReady = true;
                        reject(new Error('RCON command timeout'));
                    }
                }, 5000);
            };
            
            // Start with a small delay to allow initial connection
            setTimeout(attemptSend, 100);
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Strip ANSI escape codes from string
 */
function stripAnsiCodes(text: string): string {
    // Remove ANSI color codes and other escape sequences
    return text.replace(/\x1b\[[0-9;]*m/g, '').replace(/\[0m/g, '');
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
        const response = stripAnsiCodes(await sendRconCommand('list', serverId));
        // Parse response: "There are X of Y max players online: PlayerA, PlayerB, PlayerC"
        // or "There are X of Y players online:" (no players)
        const match = response.match(/There are (\d+) of a max(imum)? of (\d+) players online:?\s*(.*)/i);

        if (match) {
            const count = parseInt(match[1], 10);
            const max = parseInt(match[3], 10);
            const playerList = match[4]
                ? match[4].split(',').map(p => stripAnsiCodes(p.trim())).filter(p => p.length > 0 && p.match(/^[a-zA-Z0-9_]+$/))
                : [];

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

        await sendRconCommand(tellrawCommand, serverId);
        return true;
    } catch (error) {
        console.error('Error sending tellraw message:', error);
        return false;
    }
}

/**
 * Send a system notification to all in-game players
 * Used for join/leave notifications and other system messages
 */
export async function sendSystemNotification(
    serverId: string,
    message: string,
    color: string = 'yellow'
): Promise<boolean> {
    try {
        // Sanitize message to prevent JSON injection
        const safeMessage = message.replace(/["\\]/g, '');

        // Format as tellraw JSON with italic style for system messages
        const tellrawCommand = `tellraw @a {"text":"[Dashboard] ${safeMessage}","color":"${color}","italic":true}`;

        await sendRconCommand(tellrawCommand, serverId);
        return true;
    } catch (error) {
        console.error('Error sending system notification:', error);
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
