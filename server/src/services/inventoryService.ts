import { readFile } from 'fs/promises';
import { writeFile } from 'fs/promises';
import { join, normalize } from 'path';
import { promisify } from 'util';
import * as nbt from 'prismarine-nbt';
import { GAME_SERVERS_PATH, discoverGameServers } from '../config.js';
import { sendRconCommand, getOnlinePlayers } from './rconConsole.js';
import type { MinecraftItem, PlayerInventory } from '../types.js';

const parseNbt = promisify(nbt.parse);

interface UserCacheEntry {
    name: string;
    uuid: string;
    expiresOn: string;
}

/**
 * Validate that the server exists
 */
async function validateServer(serverId: string): Promise<void> {
    const servers = await discoverGameServers();
    if (!servers.find(s => s.id === serverId)) {
        throw new Error(`Unknown server: ${serverId}`);
    }
}

/**
 * Build a safe path within the server directory
 */
function buildServerPath(serverId: string, ...pathParts: string[]): string {
    const serverPath = join(GAME_SERVERS_PATH, serverId);
    const fullPath = normalize(join(serverPath, ...pathParts));

    // Prevent directory traversal
    if (!fullPath.startsWith(serverPath)) {
        throw new Error('Invalid path: directory traversal not allowed');
    }

    return fullPath;
}

/**
 * Read usercache.json to map username to UUID
 */
async function getPlayerUuid(serverId: string, playerName: string): Promise<string | null> {
    try {
        await validateServer(serverId);
        const userCachePath = buildServerPath(serverId, 'usercache.json');
        const content = await readFile(userCachePath, 'utf-8');
        const cache: UserCacheEntry[] = JSON.parse(content);

        const entry = cache.find(e => e.name.toLowerCase() === playerName.toLowerCase());
        return entry ? entry.uuid : null;
    } catch (error) {
        console.error(`Failed to read usercache.json for ${serverId}:`, error);
        return null;
    }
}

/**
 * Check if a player is currently online
 */
async function isPlayerOnline(serverId: string, playerName: string): Promise<boolean> {
    try {
        const playerInfo = await getOnlinePlayers(serverId);
        return playerInfo.players.some((p: string) => p.toLowerCase() === playerName.toLowerCase());
    } catch (error) {
        console.error(`Failed to check if player ${playerName} is online:`, error);
        return false;
    }
}

/**
 * Parse Minecraft item from NBT compound tag
 */
function parseMinecraftItemFromNbt(itemTag: any): MinecraftItem | null {
    try {
        if (!itemTag.id || !itemTag.Count) {
            return null;
        }

        const item: MinecraftItem = {
            id: itemTag.id.value,
            count: itemTag.Count.value,
            slot: itemTag.Slot?.value || 0,
        };

        // Parse display information
        if (itemTag.tag?.display) {
            item.display = {};
            if (itemTag.tag.display.Name) {
                item.display.Name = itemTag.tag.display.Name.value;
            }
            if (itemTag.tag.display.Lore?.value?.value) {
                item.display.Lore = itemTag.tag.display.Lore.value.value.map((l: any) => l.value);
            }
        }

        // Parse enchantments
        if (itemTag.tag?.Enchantments?.value?.value) {
            item.enchantments = itemTag.tag.Enchantments.value.value.map((e: any) => ({
                id: e.id.value,
                level: e.lvl.value,
            }));
        }

        // Parse damage (durability)
        if (itemTag.tag?.Damage) {
            item.damage = itemTag.tag.Damage.value;
        }

        return item;
    } catch (error) {
        console.error('Failed to parse item from NBT:', error);
        return null;
    }
}

/**
 * Get inventory for an offline player by reading their .dat file
 */
async function getOfflinePlayerInventory(serverId: string, playerName: string, uuid: string): Promise<MinecraftItem[]> {
    try {
        await validateServer(serverId);
        const playerDataPath = buildServerPath(serverId, 'world', 'playerdata', `${uuid}.dat`);
        const data = await readFile(playerDataPath);

        const parsed: any = await parseNbt(data);
        const rootTag = parsed.parsed || parsed;

        if (!rootTag.value.Inventory) {
            return [];
        }

        const inventoryArray = rootTag.value.Inventory.value.value;
        const items: MinecraftItem[] = [];

        for (const itemTag of inventoryArray) {
            const item = parseMinecraftItemFromNbt(itemTag);
            if (item) {
                items.push(item);
            }
        }

        return items;
    } catch (error) {
        console.error(`Failed to read offline inventory for ${playerName}:`, error);
        throw new Error(`Could not read player data file for ${playerName}`);
    }
}

/**
 * Get inventory for an online player using RCON data get command
 */
async function getOnlinePlayerInventory(serverId: string, playerName: string): Promise<MinecraftItem[]> {
    try {
        // Use RCON to get player inventory data
        const response = await sendRconCommand(`data get entity ${playerName} Inventory`);

        // Parse RCON response which returns NBT-like JSON
        // Expected format: "PlayerName has the following entity data: [{Slot: 0b, id: "minecraft:stone", Count: 64b}, ...]"
        const match = response.match(/\[.*\]/);
        if (!match) {
            console.log(`No inventory data found in RCON response for ${playerName}`);
            return [];
        }

        // Parse the JSON-like structure from RCON
        // Note: Minecraft RCON returns NBT in a special format that needs conversion
        const inventoryStr = match[0]
            .replace(/(\w+):/g, '"$1":')  // Quote keys
            .replace(/(\d+)b/g, '$1')      // Remove byte suffix
            .replace(/(\d+)s/g, '$1')      // Remove short suffix
            .replace(/"/g, '\\"')          // Escape quotes
            .replace(/^"/, '')             // Remove leading quote
            .replace(/"$/, '');            // Remove trailing quote

        const inventoryData = JSON.parse(inventoryStr);

        const items: MinecraftItem[] = [];
        for (const itemData of inventoryData) {
            if (itemData.id && itemData.Count) {
                items.push({
                    id: itemData.id.replace(/"/g, ''),
                    count: parseInt(itemData.Count),
                    slot: parseInt(itemData.Slot || 0),
                });
            }
        }

        return items;
    } catch (error) {
        console.error(`Failed to get online inventory for ${playerName}:`, error);
        throw new Error(`Could not retrieve inventory for online player ${playerName}`);
    }
}

/**
 * Get player inventory (online or offline)
 */
export async function getPlayerInventory(serverId: string, playerName: string): Promise<PlayerInventory> {
    const uuid = await getPlayerUuid(serverId, playerName);
    if (!uuid) {
        throw new Error(`Player ${playerName} not found in server cache`);
    }

    const isOnline = await isPlayerOnline(serverId, playerName);

    let items: MinecraftItem[];
    if (isOnline) {
        items = await getOnlinePlayerInventory(serverId, playerName);
    } else {
        items = await getOfflinePlayerInventory(serverId, playerName, uuid);
    }

    return {
        playerName,
        uuid,
        isOnline,
        items,
    };
}

/**
 * Remove items from offline player by editing their .dat file
 */
async function removeItemsFromOfflinePlayer(
    serverId: string,
    playerName: string,
    uuid: string,
    itemSlot: number,
    amount: number
): Promise<void> {
    try {
        await validateServer(serverId);
        const playerDataPath = buildServerPath(serverId, 'world', 'playerdata', `${uuid}.dat`);
        const data = await readFile(playerDataPath);

        const parsed: any = await parseNbt(data);
        const rootTag = parsed.parsed || parsed;

        if (!rootTag.value.Inventory) {
            throw new Error(`No inventory found for ${playerName}`);
        }

        const inventoryArray = rootTag.value.Inventory.value.value;
        let itemFound = false;

        for (let i = 0; i < inventoryArray.length; i++) {
            const item = inventoryArray[i];
            if (item.Slot.value === itemSlot) {
                itemFound = true;
                const currentCount = item.Count.value;

                if (currentCount < amount) {
                    throw new Error(`Not enough items in slot ${itemSlot}. Has ${currentCount}, requested ${amount}`);
                }

                if (currentCount === amount) {
                    // Remove the entire stack
                    inventoryArray.splice(i, 1);
                } else {
                    // Reduce the count
                    item.Count.value = currentCount - amount;
                }
                break;
            }
        }

        if (!itemFound) {
            throw new Error(`No item found in slot ${itemSlot}`);
        }

        // Write back the modified NBT data
        const serialized = nbt.writeUncompressed(rootTag);
        await writeFile(playerDataPath, serialized);

        console.log(`Removed ${amount} items from slot ${itemSlot} for offline player ${playerName}`);
    } catch (error) {
        console.error(`Failed to remove items from offline player ${playerName}:`, error);
        throw error;
    }
}

/**
 * Remove items from online player using RCON clear command
 */
async function removeItemsFromOnlinePlayer(
    serverId: string,
    playerName: string,
    itemId: string,
    amount: number
): Promise<void> {
    try {
        // Use RCON clear command: /clear <player> <item> <maxCount>
        const response = await sendRconCommand(`clear ${playerName} ${itemId} ${amount}`);
        console.log(`Cleared ${amount} of ${itemId} from ${playerName}: ${response}`);

        // Check if the clear was successful
        if (response.includes('Removed') || response.includes('Cleared')) {
            return;
        }

        throw new Error(`Failed to clear items: ${response}`);
    } catch (error) {
        console.error(`Failed to clear items from online player ${playerName}:`, error);
        throw error;
    }
}

/**
 * Give items to a player (must be online) using RCON
 */
async function giveItemsToPlayer(
    serverId: string,
    playerName: string,
    itemId: string,
    amount: number
): Promise<void> {
    try {
        // Use RCON give command: /give <player> <item> <count>
        const response = await sendRconCommand(`give ${playerName} ${itemId} ${amount}`);
        console.log(`Gave ${amount} of ${itemId} to ${playerName}: ${response}`);

        // Check if the give was successful
        if (response.includes('Gave') || response.includes('Given')) {
            return;
        }

        throw new Error(`Failed to give items: ${response}`);
    } catch (error) {
        console.error(`Failed to give items to ${playerName}:`, error);
        throw error;
    }
}

/**
 * Transfer items from one player to another
 */
export async function transferItems(
    serverId: string,
    sourcePlayer: string,
    targetPlayer: string,
    itemSlot: number,
    amount: number
): Promise<{ success: boolean; message: string; error?: string }> {
    try {
        // Validate target player is online
        const targetOnline = await isPlayerOnline(serverId, targetPlayer);
        if (!targetOnline) {
            return {
                success: false,
                message: 'Transfer failed',
                error: 'Target player must be online to receive items',
            };
        }

        // Get source player inventory
        const sourceInventory = await getPlayerInventory(serverId, sourcePlayer);
        const sourceItem = sourceInventory.items.find(item => item.slot === itemSlot);

        if (!sourceItem) {
            return {
                success: false,
                message: 'Transfer failed',
                error: `No item found in slot ${itemSlot}`,
            };
        }

        if (sourceItem.count < amount) {
            return {
                success: false,
                message: 'Transfer failed',
                error: `Not enough items. Has ${sourceItem.count}, requested ${amount}`,
            };
        }

        // Remove items from source player
        if (sourceInventory.isOnline) {
            await removeItemsFromOnlinePlayer(serverId, sourcePlayer, sourceItem.id, amount);
        } else {
            await removeItemsFromOfflinePlayer(serverId, sourcePlayer, sourceInventory.uuid, itemSlot, amount);
        }

        // Give items to target player
        await giveItemsToPlayer(serverId, targetPlayer, sourceItem.id, amount);

        return {
            success: true,
            message: `Successfully transferred ${amount}x ${sourceItem.id} from ${sourcePlayer} to ${targetPlayer}`,
        };
    } catch (error: any) {
        console.error('Transfer failed:', error);
        return {
            success: false,
            message: 'Transfer failed',
            error: error.message || 'Unknown error occurred',
        };
    }
}

/**
 * Get list of all players (online and cached) that have readable data files
 */
export async function getAllPlayers(serverId: string): Promise<string[]> {
    try {
        await validateServer(serverId);
        const userCachePath = buildServerPath(serverId, 'usercache.json');
        const content = await readFile(userCachePath, 'utf-8');
        const cache: UserCacheEntry[] = JSON.parse(content);

        // Filter players to only include those with readable data files
        const validPlayers: string[] = [];

        for (const entry of cache) {
            try {
                // Try to check if player data file exists and is readable
                const playerDataPath = buildServerPath(serverId, 'world', 'playerdata', `${entry.uuid}.dat`);
                await readFile(playerDataPath);
                // If we can read it, add to valid players
                validPlayers.push(entry.name);
            } catch (error) {
                // Skip players whose data files can't be read
                console.log(`Skipping player ${entry.name} - data file not readable`);
            }
        }

        // Return unique player names sorted alphabetically
        return [...new Set(validPlayers)].sort();
    } catch (error) {
        console.error(`Failed to read player list for ${serverId}:`, error);
        return [];
    }
}
