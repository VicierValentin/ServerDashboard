
export interface SystemStats {
  cpu: {
    usage: number; // percentage
  };
  ram: {
    used: number; // in GB
    total: number; // in GB
    usage: number; // percentage
  };
  disk: {
    used: number; // in GB
    total: number; // in GB
    usage: number; // percentage
  };
  network: {
    upload: number; // in Mbps
    download: number; // in Mbps
  };
}

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

export interface SystemdTimer {
  id: string;
  name: string;
  onCalendar: string; // e.g., "*-*-* 02:00:00"
  nextElapse: string; // ISO string date
  lastTriggered: string | null; // ISO string date or null
  active: boolean;
  persistent: boolean; // Run immediately if missed last scheduled time
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
  sourcePlayer: string;   // Username of source player
  targetPlayer: string;   // Username of target player (must be online)
  itemSlot: number;       // Slot number in source inventory
  amount: number;         // Number of items to transfer
}
