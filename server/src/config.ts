import { readdir } from 'fs/promises';
import { join } from 'path';

// Configuration for the server dashboard backend

// Path to the folder containing game server directories
// Each subfolder name becomes a service ID (e.g., /gameservers/palworld -> palworld.service)
export const GAME_SERVERS_PATH = process.env.GAME_SERVERS_PATH || '/home/vvicier/gameservers';

// Server port
export const PORT = parseInt(process.env.PORT || '3001', 10);

// Host to bind to
export const HOST = process.env.HOST || '0.0.0.0';

// Frontend origin for CORS
export const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';

// Timer files directory (systemd user timers)
export const SYSTEMD_USER_DIR = process.env.SYSTEMD_USER_DIR || '/etc/systemd/system';

// Network interface to monitor
export const NETWORK_INTERFACE = process.env.NETWORK_INTERFACE || 'eth0';

// Discover game servers by scanning the GAME_SERVERS_PATH directory
export async function discoverGameServers(): Promise<{ id: string; name: string }[]> {
    try {
        const entries = await readdir(GAME_SERVERS_PATH, { withFileTypes: true });
        return entries
            .filter(entry => entry.isDirectory())
            .map(entry => ({
                id: entry.name,
                name: formatServerName(entry.name),
            }));
    } catch (error) {
        console.error(`Failed to scan game servers directory: ${GAME_SERVERS_PATH}`, error);
        return [];
    }
}

// Convert folder name to display name (e.g., 'palworld' -> 'Palworld', 'minecraft-server' -> 'Minecraft Server')
function formatServerName(foldername: string): string {
    return foldername
        .split(/[-_]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}
