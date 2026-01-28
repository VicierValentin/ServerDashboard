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
    });
    await handleResponse<{ success: boolean }>(response);
};

/**
 * Toggle a game server (start or stop)
 */
const toggleGameServer = async (id: string, action: 'start' | 'stop'): Promise<GameServer[]> => {
    const response = await fetch(`${API_BASE_URL}/servers/${id}/${action}`, {
        method: 'POST',
    });
    return handleResponse<GameServer[]>(response);
};

/**
 * Toggle a game server enabled state (enable or disable at boot)
 */
const toggleGameServerEnabled = async (id: string, action: 'enable' | 'disable'): Promise<GameServer[]> => {
    const response = await fetch(`${API_BASE_URL}/servers/${id}/${action}`, {
        method: 'POST',
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
            persistent: timer.persistent,
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
 * Unskip a timer (re-enable a skipped timer)
 */
const unskipTimer = async (id: string): Promise<SystemdTimer[]> => {
    const response = await fetch(`${API_BASE_URL}/timers/${id}/unskip`, {
        method: 'POST',
    });
    return handleResponse<SystemdTimer[]>(response);
};

/**
 * Stream logs from a game server via WebSocket
 * Returns a cleanup function to close the connection
 */
const streamLogs = (serverId: string, onNewLine: (line: string) => void, onError?: (error: string) => void): (() => void) => {
    const wsUrl = `${WS_BASE_URL}/logs/${serverId}`;
    console.log(`Attempting WebSocket connection to: ${wsUrl}`);

    let ws: WebSocket;
    try {
        ws = new WebSocket(wsUrl);
    } catch (error) {
        console.error(`Failed to create WebSocket:`, error);
        onError?.(`Failed to create WebSocket connection`);
        return () => { };
    }

    ws.onopen = () => {
        console.log(`Connected to log stream for ${serverId}`);
    };

    ws.onmessage = (event) => {
        onNewLine(event.data);
    };

    ws.onerror = (error) => {
        console.error(`WebSocket error for ${serverId}:`, error);
        onError?.(`WebSocket connection error`);
    };

    ws.onclose = (event) => {
        console.log(`Disconnected from log stream for ${serverId}, code: ${event.code}, reason: ${event.reason}`);
        if (event.code !== 1000) {
            onError?.(`WebSocket closed unexpectedly (code: ${event.code})`);
        }
    };

    // Return cleanup function
    return () => {
        console.log(`Closing log stream for ${serverId}`);
        ws.close();
    };
};

// File management types
export interface FileEntry {
    name: string;
    path: string;
    isDirectory: boolean;
    size: number;
    modifiedAt: string;
}

/**
 * List files in a game server directory
 */
const listServerFiles = async (serverId: string, path: string = '/'): Promise<FileEntry[]> => {
    const response = await fetch(`${API_BASE_URL}/servers/${serverId}/files?path=${encodeURIComponent(path)}`);
    return handleResponse<FileEntry[]>(response);
};

/**
 * Download a file from a game server
 */
const downloadServerFile = async (serverId: string, filePath: string, filename: string): Promise<void> => {
    const url = `${API_BASE_URL}/servers/${serverId}/files/download?path=${encodeURIComponent(filePath)}`;

    // Create a temporary link to trigger download
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

/**
 * Upload a file to a game server directory
 */
const uploadServerFile = async (serverId: string, path: string, file: File): Promise<FileEntry> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(
        `${API_BASE_URL}/servers/${serverId}/files/upload?path=${encodeURIComponent(path)}`,
        {
            method: 'POST',
            body: formData,
        }
    );
    return handleResponse<FileEntry>(response);
};

// Export API object matching mockApi interface
export const api = {
    getSystemStats,
    getGameServers,
    getShutdownTimers,
    performPowerAction,
    toggleGameServer,
    toggleGameServerEnabled,
    addOrUpdateTimer,
    removeTimer,
    skipTimer,
    unskipTimer,
    streamLogs,
    listServerFiles,
    downloadServerFile,
    uploadServerFile,
};
