import { readFile, writeFile } from 'fs/promises';
import { join, normalize } from 'path';
import { promisify } from 'util';
import * as nbt from 'prismarine-nbt';
import { GAME_SERVERS_PATH, discoverGameServers } from '../config.js';
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
 * Deep clone an NBT compound tag
 */
function cloneNbtTag(tag: any): any {
    if (tag === null || tag === undefined) return tag;
    if (typeof tag !== 'object') return tag;
    if (Array.isArray(tag)) return tag.map(cloneNbtTag);

    const clone: any = {};
    for (const key in tag) {
        clone[key] = cloneNbtTag(tag[key]);
    }
    return clone;
}

/**
 * Parse Minecraft item from NBT compound tag, preserving full NBT data
 * Handles both formats: {id: {value: "..."}} and {id: "..."}
 */
function parseMinecraftItemFromNbt(itemTag: any): MinecraftItem | null {
    try {
        // Handle both NBT formats
        const getId = () => {
            if (itemTag.id?.value) return itemTag.id.value;
            if (typeof itemTag.id === 'string') return itemTag.id;
            return null;
        };

        const getCount = () => {
            if (itemTag.Count?.value !== undefined) return itemTag.Count.value;
            if (typeof itemTag.Count === 'number') return itemTag.Count;
            if (itemTag.count?.value !== undefined) return itemTag.count.value;
            if (typeof itemTag.count === 'number') return itemTag.count;
            return null;
        };

        const getSlot = () => {
            if (itemTag.Slot?.value !== undefined) return itemTag.Slot.value;
            if (typeof itemTag.Slot === 'number') return itemTag.Slot;
            if (itemTag.slot?.value !== undefined) return itemTag.slot.value;
            if (typeof itemTag.slot === 'number') return itemTag.slot;
            return 0;
        };

        const id = getId();
        const count = getCount();

        if (!id || count === null) {
            return null;
        }

        const item: MinecraftItem = {
            id,
            count,
            slot: getSlot(),
            nbt: cloneNbtTag(itemTag), // Store the complete raw NBT
        };

        // Parse display information for UI - try multiple structures
        const tagValue = itemTag.tag?.value || itemTag.tag;
        if (tagValue?.display?.value || tagValue?.display) {
            const displayTag = tagValue.display?.value || tagValue.display;
            item.display = {};
            if (displayTag.Name?.value || displayTag.Name) {
                item.display.Name = displayTag.Name?.value || displayTag.Name;
            }
            if (displayTag.Lore?.value?.value || displayTag.Lore) {
                const loreArray = displayTag.Lore?.value?.value || displayTag.Lore;
                if (Array.isArray(loreArray)) {
                    item.display.Lore = loreArray.map((l: any) =>
                        typeof l === 'object' ? (l.value || l) : l
                    );
                }
            }
        }

        // Parse enchantments for UI - try multiple structures
        const enchantments = tagValue?.Enchantments?.value?.value ||
            tagValue?.Enchantments?.value ||
            tagValue?.Enchantments;
        if (enchantments && Array.isArray(enchantments)) {
            item.enchantments = enchantments.map((e: any) => ({
                id: e.id?.value || e.id || '',
                level: e.lvl?.value || e.lvl || 1,
            }));
        }

        // Parse damage (durability) for UI
        const damage = tagValue?.Damage?.value ?? tagValue?.Damage;
        if (damage !== undefined) {
            item.damage = damage;
        }

        return item;
    } catch (error) {
        console.error('Failed to parse item from NBT:', error);
        return null;
    }
}

/**
 * Check if an item is a Traveler's Backpack
 */
function isTravelersBackpack(itemId: string): boolean {
    const lowerItemId = itemId.toLowerCase();
    return lowerItemId.includes('travelersbackpack:') ||
        lowerItemId.includes('travelers_backpack') ||
        lowerItemId.startsWith('travelersbackpack:');
}

/**
 * Recursively find arrays that look like item inventories in NBT
 */
function findInventoryArrays(obj: any, path: string = ''): Array<{ path: string; array: any[] }> {
    const results: Array<{ path: string; array: any[] }> = [];

    if (!obj || typeof obj !== 'object') return results;

    // Check if this is an array of items
    if (Array.isArray(obj)) {
        // Check if items in array have id/Count fields (inventory-like structure)
        if (obj.length > 0 && obj.some((item: any) => item?.id || item?.Count)) {
            results.push({ path, array: obj });
        }
        return results;
    }

    // Check value property (common in NBT)
    if (obj.value !== undefined) {
        if (Array.isArray(obj.value)) {
            if (obj.value.length > 0 && obj.value.some((item: any) => item?.id || item?.Count)) {
                results.push({ path: path + '.value', array: obj.value });
            }
        } else if (obj.value?.value && Array.isArray(obj.value.value)) {
            if (obj.value.value.length > 0 && obj.value.value.some((item: any) => item?.id || item?.Count)) {
                results.push({ path: path + '.value.value', array: obj.value.value });
            }
        }
    }

    // Recursively search relevant keys
    const keysToSearch = ['Inventory', 'Items', 'inventory', 'items', 'Contents', 'contents', 'BlockEntityTag', 'tag'];
    for (const key of keysToSearch) {
        if (obj[key]) {
            const subResults = findInventoryArrays(obj[key], path ? `${path}.${key}` : key);
            results.push(...subResults);
        }
    }

    return results;
}

/**
 * Parse Traveler's Backpack contents from item NBT
 * Structure: backpack item -> tag -> Inventory (list of items)
 */
function parseBackpackContents(itemTag: any): MinecraftItem[] {
    const contents: MinecraftItem[] = [];

    try {
        const tagValue = itemTag.tag?.value;
        if (!tagValue) {
            console.log('Backpack has no tag.value');
            return contents;
        }

        // Log the keys available in the tag to help debug
        console.log('Backpack tag keys:', Object.keys(tagValue));

        // The backpack's inventory is stored in tag.Inventory
        // Try multiple access patterns for the inventory list
        const inventoryPatterns = [
            // Direct array access
            tagValue.Inventory?.value?.value,
            tagValue.inventory?.value?.value,
            tagValue.Items?.value?.value,
            tagValue.items?.value?.value,
            // Sometimes it's just .value
            tagValue.Inventory?.value,
            tagValue.inventory?.value,
            tagValue.Items?.value,
            tagValue.items?.value,
            // Or direct
            tagValue.Inventory,
            tagValue.inventory,
            tagValue.Items,
            tagValue.items,
        ];

        let inventoryArray: any[] | null = null;
        let patternIndex = 0;

        for (let i = 0; i < inventoryPatterns.length; i++) {
            const pattern = inventoryPatterns[i];
            if (pattern && Array.isArray(pattern) && pattern.length > 0) {
                inventoryArray = pattern;
                patternIndex = i;
                break;
            }
        }

        if (inventoryArray) {
            console.log(`Found backpack inventory using pattern ${patternIndex}, ${inventoryArray.length} slots`);

            // Log first item structure for debugging
            if (inventoryArray.length > 0) {
                const firstItem = inventoryArray[0];
                console.log('First backpack item structure:', JSON.stringify({
                    keys: Object.keys(firstItem || {}),
                    id: firstItem?.id,
                    Count: firstItem?.Count,
                    Slot: firstItem?.Slot,
                }, null, 2));
            }

            for (const itemNbt of inventoryArray) {
                const item = parseMinecraftItemFromNbt(itemNbt);
                if (item) {
                    contents.push(item);
                }
            }
            console.log(`Parsed ${contents.length} items from backpack`);
        } else {
            // Log more details about the structure
            console.log('Could not find inventory array. Tag structure:');
            for (const key of Object.keys(tagValue)) {
                const val = tagValue[key];
                console.log(`  ${key}: type=${val?.type}, hasValue=${!!val?.value}, isArray=${Array.isArray(val?.value)}`);
                if (val?.value && typeof val.value === 'object') {
                    console.log(`    value keys: ${Object.keys(val.value).slice(0, 5).join(', ')}`);
                }
            }
        }
    } catch (error) {
        console.error('Failed to parse backpack contents:', error);
    }

    return contents;
}

/**
 * Get inventory for a player by reading their .dat file (offline only)
 */
async function getPlayerInventoryFromDat(serverId: string, playerName: string, uuid: string): Promise<{
    items: MinecraftItem[];
    backpacks: Array<{ slot: number; itemId: string; contents: MinecraftItem[] }>;
}> {
    try {
        await validateServer(serverId);
        const playerDataPath = buildServerPath(serverId, 'world', 'playerdata', `${uuid}.dat`);
        const data = await readFile(playerDataPath);

        const parsed: any = await parseNbt(data);
        const rootTag = parsed.parsed || parsed;

        const items: MinecraftItem[] = [];
        const backpacks: Array<{ slot: number; itemId: string; contents: MinecraftItem[] }> = [];

        if (!rootTag.value.Inventory) {
            return { items, backpacks };
        }

        const inventoryArray = rootTag.value.Inventory.value.value;

        for (const itemTag of inventoryArray) {
            const item = parseMinecraftItemFromNbt(itemTag);
            if (item) {
                items.push(item);

                // Check if this is a backpack and parse its contents
                if (isTravelersBackpack(item.id)) {
                    console.log(`Found backpack: ${item.id} in slot ${item.slot}`);
                    const contents = parseBackpackContents(itemTag);
                    // Always add the backpack, even if empty
                    backpacks.push({
                        slot: item.slot,
                        itemId: item.id,
                        contents,
                    });
                    console.log(`Backpack ${item.id} has ${contents.length} items`);
                }
            }
        }

        return { items, backpacks };
    } catch (error) {
        console.error(`Failed to read inventory for ${playerName}:`, error);
        throw new Error(`Could not read player data file for ${playerName}`);
    }
}

/**
 * Get player inventory (offline mode only - reads from .dat file)
 */
export async function getPlayerInventory(serverId: string, playerName: string): Promise<PlayerInventory & {
    backpacks: Array<{ slot: number; itemId: string; contents: MinecraftItem[] }>;
}> {
    const uuid = await getPlayerUuid(serverId, playerName);
    if (!uuid) {
        throw new Error(`Player ${playerName} not found in server cache`);
    }

    const { items, backpacks } = await getPlayerInventoryFromDat(serverId, playerName, uuid);

    return {
        playerName,
        uuid,
        isOnline: false, // Always false - we only work with offline data
        items,
        backpacks,
    };
}

/**
 * Extract and remove items from a player's .dat file
 * Returns the raw NBT data of the removed item for transfer
 */
async function extractItemFromPlayer(
    serverId: string,
    uuid: string,
    itemSlot: number,
    amount: number
): Promise<{ removedNbt: any; remainingCount: number }> {
    await validateServer(serverId);
    const playerDataPath = buildServerPath(serverId, 'world', 'playerdata', `${uuid}.dat`);
    const data = await readFile(playerDataPath);

    const parsed: any = await parseNbt(data);
    const rootTag = parsed.parsed || parsed;

    if (!rootTag.value.Inventory) {
        throw new Error('No inventory found');
    }

    const inventoryArray = rootTag.value.Inventory.value.value;
    let removedNbt: any = null;
    let remainingCount = 0;

    for (let i = 0; i < inventoryArray.length; i++) {
        const item = inventoryArray[i];
        if (item.Slot?.value === itemSlot) {
            const currentCount = item.Count.value;

            if (currentCount < amount) {
                throw new Error(`Not enough items. Has ${currentCount}, requested ${amount}`);
            }

            // Clone the item NBT for transfer
            removedNbt = cloneNbtTag(item);
            removedNbt.Count.value = amount; // Set to the extracted amount

            if (currentCount === amount) {
                // Remove the entire stack
                inventoryArray.splice(i, 1);
                remainingCount = 0;
            } else {
                // Reduce the count
                item.Count.value = currentCount - amount;
                remainingCount = currentCount - amount;
            }
            break;
        }
    }

    if (!removedNbt) {
        throw new Error(`No item found in slot ${itemSlot}`);
    }

    // Write back the modified NBT data
    const serialized = nbt.writeUncompressed(rootTag);
    await writeFile(playerDataPath, serialized);

    return { removedNbt, remainingCount };
}

/**
 * Find an empty slot in the inventory
 */
function findEmptySlot(inventoryArray: any[]): number | null {
    const occupiedSlots = new Set(
        inventoryArray.map((item: any) => item.Slot?.value).filter((s: any) => s !== undefined)
    );

    // Find first empty slot (0-35 for main inventory + hotbar)
    for (let slot = 0; slot <= 35; slot++) {
        if (!occupiedSlots.has(slot)) {
            return slot;
        }
    }

    return null;
}

/**
 * Add a complete item (with all NBT data) to a player's inventory
 */
async function addItemToPlayer(
    serverId: string,
    uuid: string,
    itemNbt: any
): Promise<void> {
    await validateServer(serverId);
    const playerDataPath = buildServerPath(serverId, 'world', 'playerdata', `${uuid}.dat`);
    const data = await readFile(playerDataPath);

    const parsed: any = await parseNbt(data);
    const rootTag = parsed.parsed || parsed;

    // Initialize inventory if it doesn't exist
    if (!rootTag.value.Inventory) {
        rootTag.value.Inventory = { type: 'list', value: { type: 'compound', value: [] } };
    }

    const inventoryArray = rootTag.value.Inventory.value.value;
    const itemId = itemNbt.id?.value;
    const itemCount = itemNbt.Count?.value || 1;

    // Check if we can stack with an existing item (only for simple items without special NBT)
    const hasSpecialNbt = itemNbt.tag && Object.keys(itemNbt.tag.value || {}).length > 0;

    if (!hasSpecialNbt) {
        // Try to stack with existing items
        for (const existingItem of inventoryArray) {
            if (existingItem.id?.value === itemId &&
                existingItem.Slot?.value >= 0 &&
                existingItem.Slot?.value <= 35) {
                const existingCount = existingItem.Count?.value || 0;
                if (existingCount + itemCount <= 64) {
                    existingItem.Count.value = existingCount + itemCount;

                    const serialized = nbt.writeUncompressed(rootTag);
                    await writeFile(playerDataPath, serialized);
                    return;
                }
            }
        }
    }

    // Find an empty slot for the new item
    const emptySlot = findEmptySlot(inventoryArray);
    if (emptySlot === null) {
        throw new Error('Inventory is full');
    }

    // Clone the item NBT and set the new slot
    const newItem = cloneNbtTag(itemNbt);
    newItem.Slot = { type: 'byte', value: emptySlot };

    inventoryArray.push(newItem);

    const serialized = nbt.writeUncompressed(rootTag);
    await writeFile(playerDataPath, serialized);
}

/**
 * Restore items to a player (for rollback)
 */
async function restoreItemToPlayer(
    serverId: string,
    uuid: string,
    itemNbt: any,
    originalSlot: number
): Promise<void> {
    await validateServer(serverId);
    const playerDataPath = buildServerPath(serverId, 'world', 'playerdata', `${uuid}.dat`);
    const data = await readFile(playerDataPath);

    const parsed: any = await parseNbt(data);
    const rootTag = parsed.parsed || parsed;

    if (!rootTag.value.Inventory) {
        rootTag.value.Inventory = { type: 'list', value: { type: 'compound', value: [] } };
    }

    const inventoryArray = rootTag.value.Inventory.value.value;

    // Try to put back in original slot
    const existingInSlot = inventoryArray.find((item: any) => item.Slot?.value === originalSlot);

    if (existingInSlot && existingInSlot.id?.value === itemNbt.id?.value) {
        // Same item in original slot, add to it
        existingInSlot.Count.value = (existingInSlot.Count?.value || 0) + (itemNbt.Count?.value || 1);
    } else if (!existingInSlot) {
        // Original slot is empty, put it back
        const restoredItem = cloneNbtTag(itemNbt);
        restoredItem.Slot = { type: 'byte', value: originalSlot };
        inventoryArray.push(restoredItem);
    } else {
        // Original slot has different item, find a new slot
        const emptySlot = findEmptySlot(inventoryArray);
        if (emptySlot !== null) {
            const restoredItem = cloneNbtTag(itemNbt);
            restoredItem.Slot = { type: 'byte', value: emptySlot };
            inventoryArray.push(restoredItem);
        } else {
            throw new Error('Cannot restore item: inventory is full');
        }
    }

    const serialized = nbt.writeUncompressed(rootTag);
    await writeFile(playerDataPath, serialized);
}

/**
 * Transfer items from one player to another (offline NBT file transfer only)
 * Transfers the complete item with all NBT data (enchantments, name, durability, etc.)
 */
export async function transferItems(
    serverId: string,
    sourcePlayer: string,
    targetPlayer: string,
    itemSlot: number,
    amount: number
): Promise<{ success: boolean; message: string; error?: string }> {
    try {
        // Get UUIDs for both players
        const sourceUuid = await getPlayerUuid(serverId, sourcePlayer);
        const targetUuid = await getPlayerUuid(serverId, targetPlayer);

        if (!sourceUuid) {
            return {
                success: false,
                message: 'Transfer failed',
                error: `Source player ${sourcePlayer} not found`,
            };
        }

        if (!targetUuid) {
            return {
                success: false,
                message: 'Transfer failed',
                error: `Target player ${targetPlayer} not found`,
            };
        }

        // Extract item from source player (removes from their inventory)
        const { removedNbt } = await extractItemFromPlayer(serverId, sourceUuid, itemSlot, amount);
        const itemId = removedNbt.id?.value || 'unknown';

        // Try to add to target player
        try {
            await addItemToPlayer(serverId, targetUuid, removedNbt);
        } catch (addError: any) {
            // Rollback: restore item to source player
            console.error('Failed to add item to target, rolling back...', addError);
            try {
                await restoreItemToPlayer(serverId, sourceUuid, removedNbt, itemSlot);
            } catch (rollbackError) {
                console.error('Rollback failed! Item may be lost:', rollbackError);
                return {
                    success: false,
                    message: 'Critical error',
                    error: `Transfer failed and rollback failed. Item may be lost: ${addError.message}`,
                };
            }
            throw addError;
        }

        return {
            success: true,
            message: `Successfully transferred ${amount}x ${itemId} from ${sourcePlayer} to ${targetPlayer}`,
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
 * Get list of all players that have readable data files
 */
export async function getAllPlayers(serverId: string): Promise<string[]> {
    try {
        await validateServer(serverId);
        const userCachePath = buildServerPath(serverId, 'usercache.json');
        const content = await readFile(userCachePath, 'utf-8');
        const cache: UserCacheEntry[] = JSON.parse(content);

        const validPlayers: string[] = [];

        for (const entry of cache) {
            try {
                const playerDataPath = buildServerPath(serverId, 'world', 'playerdata', `${entry.uuid}.dat`);
                await readFile(playerDataPath);
                validPlayers.push(entry.name);
            } catch (error) {
                console.log(`Skipping player ${entry.name} - data file not readable`);
            }
        }

        return [...new Set(validPlayers)].sort();
    } catch (error) {
        console.error(`Failed to read player list for ${serverId}:`, error);
        return [];
    }
}
