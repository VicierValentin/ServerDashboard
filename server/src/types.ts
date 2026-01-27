// Types shared between frontend and backend

export enum GameServerStatus {
    RUNNING = 'running',
    STOPPED = 'stopped',
    CRASHED = 'crashed',
}

export interface GameServer {
    id: string;
    name: string;
    status: GameServerStatus;
}

export interface SystemStats {
    cpu: {
        usage: number; // percentage
    };
    ram: {
        used: number;   // GB
        total: number;  // GB
        usage: number;  // percentage
    };
    disk: {
        used: number;   // GB
        total: number;  // GB
        usage: number;  // percentage
    };
    network: {
        upload: number;   // Mbps
        download: number; // Mbps
    };
}

export interface SystemdTimer {
    id: string;
    name: string;
    onCalendar: string;          // systemd.time format, e.g., "*-*-* 02:00:00"
    nextElapse: string;          // ISO date string
    lastTriggered: string | null;
    active: boolean;
}

// Request/Response types for API
export interface ToggleServerRequest {
    action: 'start' | 'stop';
}

export interface PowerActionRequest {
    action: 'shutdown' | 'restart';
}

export interface CreateTimerRequest {
    name: string;
    onCalendar: string;
    active: boolean;
}

export interface UpdateTimerRequest extends CreateTimerRequest {
    id: string;
}
