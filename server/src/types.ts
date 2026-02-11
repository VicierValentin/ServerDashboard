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
    enabled: boolean; // Whether the service is enabled to start at boot
    playerInfo?: {
        count: number;
        max: number;
        players: string[];
    };
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
    persistent: boolean;         // Run immediately if missed last scheduled time
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
    persistent: boolean;
}

export interface UpdateTimerRequest extends CreateTimerRequest {
    id: string;
}

// Minecraft Inventory Types
export interface MinecraftItem {
    id: string;           // e.g., "minecraft:diamond_sword"
    count: number;
    slot: number;         // 0-35 for main inventory, 100-103 for armor
    display?: {
        Name?: string;
        Lore?: string[];
    };
    enchantments?: Array<{
        id: string;
        level: number;
    }>;
    damage?: number;      // Tool/armor durability
    nbt?: any;            // Raw NBT data for complex items
}

export interface PlayerInventory {
    playerName: string;
    uuid: string;
    isOnline: boolean;
    items: MinecraftItem[];
}

export interface InventoryTransferRequest {
    sourcePlayer: string;   // Username of source player
    targetPlayer: string;   // Username of target player (must be online)
    itemSlot: number;       // Slot number in source inventory
    amount: number;         // Number of items to transfer
}

export interface InventoryTransferResponse {
    success: boolean;
    message: string;
    error?: string;
}
