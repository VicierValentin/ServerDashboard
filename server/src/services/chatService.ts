import { spawnProcess } from '../utils/exec.js';
import { GAME_SERVERS_PATH } from '../config.js';
import { join } from 'path';
import type { ChildProcess } from 'child_process';

export interface ChatMessage {
    timestamp: string;
    playerName?: string;
    message: string;
    type: 'player' | 'server';
}

/**
 * Parse a Minecraft log line to extract chat messages
 * Supports common Minecraft log formats:
 * [HH:MM:SS] [Server thread/INFO]: <PlayerName> message
 * [HH:MM:SS INFO]: <PlayerName> message
 */
function parseChatMessage(line: string): ChatMessage | null {
    // Pattern for player chat: <PlayerName> message
    const chatPattern = /\[(\d{2}:\d{2}:\d{2})\].*?<([^>]+)>\s+(.+)/;
    const match = line.match(chatPattern);

    if (match) {
        const [, timestamp, playerName, message] = match;
        return {
            timestamp,
            playerName,
            message: message.trim(),
            type: 'player',
        };
    }

    return null;
}

/**
 * Start streaming and filtering chat messages from a Minecraft server's logs
 * Only emits parsed chat messages (filters out server events, commands, etc.)
 */
export function startChatSession(
    serverId: string,
    onChatMessage: (message: ChatMessage) => void,
    onError: (error: Error) => void
): () => void {
    const serverDir = join(GAME_SERVERS_PATH, serverId);
    const logsScriptPath = join(serverDir, 'logs.sh');

    // Spawn the logs.sh script
    const proc = spawnProcess('bash', [logsScriptPath], { cwd: serverDir });

    let buffer = '';

    proc.stdout?.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.trim()) {
                // Try to parse as chat message
                const chatMessage = parseChatMessage(line);
                if (chatMessage) {
                    onChatMessage(chatMessage);
                }
            }
        }
    });

    proc.stderr?.on('data', (chunk: Buffer) => {
        console.error(`Chat stream error for ${serverId}:`, chunk.toString());
    });

    proc.on('error', (error) => {
        onError(error);
    });

    proc.on('close', (code) => {
        if (code !== 0 && code !== null) {
            console.log(`Chat stream closed for ${serverId} with code ${code}`);
        }
    });

    // Return cleanup function
    return () => {
        console.log(`Stopping chat stream for ${serverId}`);
        if (!proc.killed) {
            proc.kill('SIGTERM');
        }
    };
}
