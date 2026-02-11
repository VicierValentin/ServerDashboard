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

// Item source types for transfer tracking
export type ItemSource = 'inventory' | 'backpack' | 'equippedBackpack' | 'accessory';

// Minecraft Inventory Types
export interface MinecraftItem {
    id: string;           // e.g., "minecraft:diamond_sword"
    count: number;
    slot: number;         // 0-35 for main inventory, 100-103 for armor
    source?: ItemSource;  // Where the item is located
    parentSlot?: number;  // For backpack items: slot of the backpack in main inventory
    accessoryType?: string; // For accessory items: type of accessory slot
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

export interface BackpackContents {
    slot: number;
    itemId: string;
    contents: MinecraftItem[];
}

export interface AccessorySlot {
    slotType: string;     // e.g., "anklet", "ring", "necklace", "hat", etc.
    items: MinecraftItem[];
}

export interface PlayerInventory {
    playerName: string;
    uuid: string;
    isOnline: boolean;
    items: MinecraftItem[];
    backpacks?: BackpackContents[];
    accessories?: AccessorySlot[];
    equippedBackpack?: BackpackContents;
}

export interface InventoryTransferRequest {
    sourcePlayer: string;     // Username of source player
    targetPlayer: string;     // Username of target player
    itemSlot: number;         // Slot number in source location
    amount: number;           // Number of items to transfer
    source?: ItemSource;      // Where the item is located (default: 'inventory')
    parentSlot?: number;      // For backpack items: slot of the backpack
    accessoryType?: string;   // For accessory items: type of accessory slot
}

export interface InventoryTransferResponse {
    success: boolean;
    message: string;
    error?: string;
}
