import type { SystemStats, GameServer, SystemdTimer } from '../types';

// API base URL - uses Vite proxy in development
const API_BASE_URL = '/api';
const WS_BASE_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

/**
 * Generic error handler for API responses
 */
async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `API error: ${response.status}`);
    }
    return response.json();
}

/**
 * Get system statistics (CPU, RAM, disk, network)
 */
const getSystemStats = async (): Promise<SystemStats> => {
    const response = await fetch(`${API_BASE_URL}/system/stats`);
    return handleResponse<SystemStats>(response);
};

/**
 * Get all game servers with their status
 */
const getGameServers = async (): Promise<GameServer[]> => {
    const response = await fetch(`${API_BASE_URL}/servers`);
    return handleResponse<GameServer[]>(response);
};

/**
 * Get all shutdown timers
 */
const getShutdownTimers = async (): Promise<SystemdTimer[]> => {
    const response = await fetch(`${API_BASE_URL}/timers`);
    return handleResponse<SystemdTimer[]>(response);
};

/**
 * Perform a power action (shutdown or restart)
 */
const performPowerAction = async (action: 'shutdown' | 'restart'): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/power/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    await handleResponse<{ success: boolean }>(response);
};

/**
 * Toggle a game server (start or stop)
 */
const toggleGameServer = async (id: string, action: 'start' | 'stop'): Promise<GameServer[]> => {
    const response = await fetch(`${API_BASE_URL}/servers/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    return handleResponse<GameServer[]>(response);
};

/**
 * Add or update a shutdown timer
 */
const addOrUpdateTimer = async (
    timer: Omit<SystemdTimer, 'id' | 'nextElapse' | 'lastTriggered'> & { id?: string }
): Promise<SystemdTimer[]> => {
    const url = timer.id
        ? `${API_BASE_URL}/timers/${timer.id}`
        : `${API_BASE_URL}/timers`;

    const response = await fetch(url, {
        method: timer.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: timer.name,
            onCalendar: timer.onCalendar,
            active: timer.active,
        }),
    });
    return handleResponse<SystemdTimer[]>(response);
};

/**
 * Remove a shutdown timer
 */
const removeTimer = async (id: string): Promise<SystemdTimer[]> => {
    const response = await fetch(`${API_BASE_URL}/timers/${id}`, {
        method: 'DELETE',
    });
    return handleResponse<SystemdTimer[]>(response);
};

/**
 * Skip a timer temporarily
 */
const skipTimer = async (id: string): Promise<SystemdTimer[]> => {
    const response = await fetch(`${API_BASE_URL}/timers/${id}/skip`, {
        method: 'POST',
    });
    return handleResponse<SystemdTimer[]>(response);
};

/**
 * Stream logs from a game server via WebSocket
 * Returns a cleanup function to close the connection
 */
const streamLogs = (serverId: string, onNewLine: (line: string) => void): (() => void) => {
    const ws = new WebSocket(`${WS_BASE_URL}/logs/${serverId}`);

    ws.onopen = () => {
        console.log(`Connected to log stream for ${serverId}`);
    };

    ws.onmessage = (event) => {
        onNewLine(event.data);
    };

    ws.onerror = (error) => {
        console.error(`WebSocket error for ${serverId}:`, error);
    };

    ws.onclose = () => {
        console.log(`Disconnected from log stream for ${serverId}`);
    };

    // Return cleanup function
    return () => {
        console.log(`Closing log stream for ${serverId}`);
        ws.close();
    };
};

// Export API object matching mockApi interface
export const api = {
    getSystemStats,
    getGameServers,
    getShutdownTimers,
    performPowerAction,
    toggleGameServer,
    addOrUpdateTimer,
    removeTimer,
    skipTimer,
    streamLogs,
};
