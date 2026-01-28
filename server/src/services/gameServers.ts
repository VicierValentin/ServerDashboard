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

        if (activeState === 'active') {
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
 * Check if a service is enabled (starts at boot)
 */
async function isServiceEnabled(serviceId: string): Promise<boolean> {
    try {
        const { stdout } = await execCommand('systemctl', [
            'is-enabled',
            `${serviceId}.service`,
        ]);
        return stdout.trim() === 'enabled';
    } catch {
        // is-enabled returns non-zero exit code for disabled services
        return false;
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
            enabled: await isServiceEnabled(server.id),
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

/**
 * Enable a game server service (start at boot)
 */
export async function enableGameServer(serviceId: string): Promise<void> {
    // Validate that this is a known server
    const servers = await discoverGameServers();
    if (!servers.find(s => s.id === serviceId)) {
        throw new Error(`Unknown game server: ${serviceId}`);
    }

    await execCommand('systemctl', ['enable', `${serviceId}.service`], { sudo: true });
}

/**
 * Disable a game server service (don't start at boot)
 */
export async function disableGameServer(serviceId: string): Promise<void> {
    // Validate that this is a known server
    const servers = await discoverGameServers();
    if (!servers.find(s => s.id === serviceId)) {
        throw new Error(`Unknown game server: ${serviceId}`);
    }

    await execCommand('systemctl', ['disable', `${serviceId}.service`], { sudo: true });
}

/**
 * Toggle a game server enabled state (enable or disable based on action)
 */
export async function toggleGameServerEnabled(
    serviceId: string,
    action: 'enable' | 'disable'
): Promise<GameServer[]> {
    if (action === 'enable') {
        await enableGameServer(serviceId);
    } else {
        await disableGameServer(serviceId);
    }

    // Return updated list of all servers
    return getGameServers();
}
