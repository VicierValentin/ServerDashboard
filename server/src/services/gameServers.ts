import { execCommand, parseSystemctlShow } from '../utils/exec.js';
import { discoverGameServers } from '../config.js';
import { GameServerStatus, type GameServer } from '../types.js';

/**
 * Get the systemd service status for a game server
 */
async function getServiceStatus(serviceId: string): Promise<GameServerStatus> {
    try {
        const { stdout } = await execCommand('systemctl', [
            'show',
            `${serviceId}.service`,
            '--property=ActiveState,SubState',
        ]);

        const props = parseSystemctlShow(stdout);
        const activeState = props['ActiveState'];
        const subState = props['SubState'];

        if (activeState === 'active' && subState === 'running') {
            return GameServerStatus.RUNNING;
        } else if (activeState === 'failed' || subState === 'failed') {
            return GameServerStatus.CRASHED;
        } else {
            return GameServerStatus.STOPPED;
        }
    } catch (error) {
        console.error(`Failed to get status for ${serviceId}:`, error);
        return GameServerStatus.STOPPED;
    }
}

/**
 * Get all game servers with their current status
 */
export async function getGameServers(): Promise<GameServer[]> {
    const servers = await discoverGameServers();

    const serversWithStatus = await Promise.all(
        servers.map(async (server) => ({
            ...server,
            status: await getServiceStatus(server.id),
        }))
    );

    return serversWithStatus;
}

/**
 * Start a game server service
 */
export async function startGameServer(serviceId: string): Promise<void> {
    // Validate that this is a known server
    const servers = await discoverGameServers();
    if (!servers.find(s => s.id === serviceId)) {
        throw new Error(`Unknown game server: ${serviceId}`);
    }

    await execCommand('systemctl', ['start', `${serviceId}.service`], { sudo: true });
}

/**
 * Stop a game server service
 */
export async function stopGameServer(serviceId: string): Promise<void> {
    // Validate that this is a known server
    const servers = await discoverGameServers();
    if (!servers.find(s => s.id === serviceId)) {
        throw new Error(`Unknown game server: ${serviceId}`);
    }

    await execCommand('systemctl', ['stop', `${serviceId}.service`], { sudo: true });
}

/**
 * Toggle a game server (start or stop based on action)
 */
export async function toggleGameServer(
    serviceId: string,
    action: 'start' | 'stop'
): Promise<GameServer[]> {
    if (action === 'start') {
        await startGameServer(serviceId);
    } else {
        await stopGameServer(serviceId);
    }

    // Return updated list of all servers
    return getGameServers();
}
