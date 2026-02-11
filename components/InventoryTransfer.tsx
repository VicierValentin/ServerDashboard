import React, { useState, useEffect } from 'react';
import type { GameServer, PlayerInventory, MinecraftItem, BackpackContents } from '../types';
import { api } from '../services/api';

interface InventoryTransferProps {
    server: GameServer;
    onClose: () => void;
}

export const InventoryTransfer: React.FC<InventoryTransferProps> = ({ server, onClose }) => {
    const [allPlayers, setAllPlayers] = useState<string[]>([]);
    const [sourcePlayer, setSourcePlayer] = useState<string>('');
    const [targetPlayer, setTargetPlayer] = useState<string>('');
    const [inventory, setInventory] = useState<PlayerInventory | null>(null);
    const [selectedItem, setSelectedItem] = useState<MinecraftItem | null>(null);
    const [transferAmount, setTransferAmount] = useState<number>(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [expandedBackpack, setExpandedBackpack] = useState<number | null>(null);

    // Fetch all players on mount
    useEffect(() => {
        const loadPlayers = async () => {
            try {
                const players = await api.getAllPlayers(server.id);
                setAllPlayers(players);
            } catch (err: any) {
                setError(err.message || 'Failed to load players');
            }
        };
        loadPlayers();
    }, [server.id]);

    // Load inventory when source player changes
    useEffect(() => {
        if (!sourcePlayer) {
            setInventory(null);
            setSelectedItem(null);
            return;
        }

        const loadInventory = async () => {
            setLoading(true);
            setError(null);
            setSelectedItem(null);
            try {
                const inv = await api.getPlayerInventory(server.id, sourcePlayer);
                setInventory(inv);
            } catch (err: any) {
                setError(err.message || 'Failed to load inventory');
                setInventory(null);
            } finally {
                setLoading(false);
            }
        };

        loadInventory();
    }, [server.id, sourcePlayer]);

    // Reset transfer amount when selected item changes
    useEffect(() => {
        if (selectedItem) {
            setTransferAmount(Math.min(selectedItem.count, 64));
        }
    }, [selectedItem]);

    const handleItemClick = (item: MinecraftItem) => {
        setSelectedItem(item);
        setError(null);
        setSuccess(null);
    };

    const handleTransfer = async () => {
        if (!sourcePlayer || !targetPlayer || !selectedItem) {
            setError('Please select source player, target player, and an item');
            return;
        }

        if (sourcePlayer === targetPlayer) {
            setError('Cannot transfer to the same player');
            return;
        }

        if (transferAmount <= 0 || transferAmount > selectedItem.count) {
            setError(`Invalid amount. Must be between 1 and ${selectedItem.count}`);
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const result = await api.transferItems(server.id, {
                sourcePlayer,
                targetPlayer,
                itemSlot: selectedItem.slot,
                amount: transferAmount,
            });

            if (result.success) {
                setSuccess(result.message);
                setSelectedItem(null);
                setTransferAmount(1);

                // Reload inventory after successful transfer
                const inv = await api.getPlayerInventory(server.id, sourcePlayer);
                setInventory(inv);
            } else {
                setError(result.error || 'Transfer failed');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to transfer items');
        } finally {
            setLoading(false);
        }
    };

    const getItemDisplayName = (item: MinecraftItem): string => {
        if (item.display?.Name) {
            return item.display.Name;
        }
        // Format minecraft:diamond_sword -> Diamond Sword
        const name = item.id.replace('minecraft:', '').replace(/_/g, ' ');
        return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    };

    // Get emoji/symbol for item type
    const getItemIcon = (itemId: string): string => {
        // Extract only the part after the last colon (e.g., "minecraft:diamond_sword" -> "diamond_sword")
        const parts = itemId.split(':');
        const id = parts[parts.length - 1].toLowerCase();

        // Tools & Weapons
        if (id.includes('sword')) return '⚔️';
        if (id.includes('pickaxe')) return '⛏️';
        if (id.includes('axe') && !id.includes('pickaxe')) return '🪓';
        if (id.includes('shovel')) return '🔨';
        if (id.includes('hoe')) return '🌾';
        if (id.includes('bow')) return '🏹';
        if (id.includes('fishing_rod')) return '🎣';
        if (id.includes('shears')) return '✂️';

        // Armor
        if (id.includes('helmet') || id.includes('cap')) return '🪖';
        if (id.includes('chestplate') || id.includes('tunic')) return '🦺';
        if (id.includes('leggings') || id.includes('pants')) return '👖';
        if (id.includes('boots')) return '👢';
        if (id.includes('elytra')) return '🪽';

        // Food
        if (id.includes('apple')) return '🍎';
        if (id.includes('bread')) return '🍞';
        if (id.includes('carrot')) return '🥕';
        if (id.includes('potato')) return '🥔';
        if (id.includes('beef') || id.includes('steak')) return '🥩';
        if (id.includes('porkchop')) return '🥓';
        if (id.includes('chicken')) return '🍗';
        if (id.includes('fish') || id.includes('salmon') || id.includes('cod')) return '🐟';
        if (id.includes('cookie')) return '🍪';
        if (id.includes('melon')) return '🍉';
        if (id.includes('cake')) return '🎂';

        // Resources
        if (id.includes('diamond')) return '💎';
        if (id.includes('emerald')) return '💚';
        if (id.includes('gold')) return '🟡';
        if (id.includes('iron')) return '⚙️';
        if (id.includes('coal')) return '⚫';
        if (id.includes('redstone')) return '🔴';
        if (id.includes('lapis')) return '🔵';
        if (id.includes('quartz')) return '⚪';
        if (id.includes('netherite')) return '🟣';

        // Blocks
        if (id.includes('stone') && !id.includes('cobblestone')) return '🪨';
        if (id.includes('cobblestone')) return '🗿';
        if (id.includes('dirt')) return '🟤';
        if (id.includes('grass')) return '🌱';
        if (id.includes('wood') || id.includes('log') || id.includes('planks')) return '🪵';
        if (id.includes('glass')) return '🔷';
        if (id.includes('sand')) return '⏳';
        if (id.includes('gravel')) return '◾';
        if (id.includes('obsidian')) return '⬛';
        if (id.includes('wool')) return '🧶';

        // Plants & Nature
        if (id.includes('sapling')) return '🌿';
        if (id.includes('flower') || id.includes('rose') || id.includes('tulip')) return '🌸';
        if (id.includes('seed')) return '🌾';
        if (id.includes('wheat')) return '🌾';
        if (id.includes('sugar_cane')) return '🎋';
        if (id.includes('bamboo')) return '🎍';

        // Utility & Special
        if (id.includes('torch')) return '🔦';
        if (id.includes('bucket')) return '🪣';
        if (id.includes('book') || id.includes('enchanted_book')) return '📖';
        if (id.includes('map')) return '🗺️';
        if (id.includes('compass')) return '🧭';
        if (id.includes('clock')) return '🕐';
        if (id.includes('bed')) return '🛏️';
        if (id.includes('door')) return '🚪';
        if (id.includes('chest')) return '📦';
        if (id.includes('ender_pearl')) return '🟢';
        if (id.includes('ender_eye')) return '👁️';
        if (id.includes('arrow')) return '➡️';
        if (id.includes('egg')) return '🥚';
        if (id.includes('snowball')) return '⚪';
        if (id.includes('potion')) return '🧪';
        if (id.includes('bottle')) return '🍾';
        if (id.includes('firework')) return '🎆';
        if (id.includes('tnt')) return '💣';

        // Default - intelligent letter extraction from text after colon
        const words = id.split('_');
        if (words.length >= 2) {
            // Multiple words: first letter of first two words (e.g., diamond_sword -> DS)
            return (words[0][0] + words[1][0]).toUpperCase();
        } else {
            // Single word: first 2 letters (e.g., stone -> ST)
            return words[0].substring(0, 2).toUpperCase();
        }
    };

    // Get background color based on item rarity/type
    const getItemColor = (item: MinecraftItem): string => {
        const id = item.id.toLowerCase();

        if (item.enchantments && item.enchantments.length > 0) return 'from-purple-900 to-purple-800';
        if (id.includes('netherite')) return 'from-purple-900 to-gray-800';
        if (id.includes('diamond')) return 'from-cyan-900 to-blue-800';
        if (id.includes('emerald')) return 'from-green-900 to-green-800';
        if (id.includes('gold')) return 'from-yellow-900 to-yellow-800';
        if (id.includes('iron')) return 'from-gray-700 to-gray-600';
        if (id.includes('enchanted')) return 'from-purple-900 to-purple-800';

        return 'from-gray-700 to-gray-800';
    };

    const renderInventorySlot = (slotIndex: number) => {
        const item = inventory?.items.find(i => i.slot === slotIndex);
        const isSelected = selectedItem?.slot === slotIndex;

        return (
            <button
                key={slotIndex}
                onClick={() => item && handleItemClick(item)}
                title={item ? `${getItemDisplayName(item)}${item.count > 1 ? ` (x${item.count})` : ''}` : 'Empty slot'}
                className={`
                    group relative w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 border-2 transition-all duration-200 rounded
                    ${item
                        ? `bg-gradient-to-br ${getItemColor(item)} sm:hover:scale-105 sm:hover:z-20 cursor-pointer shadow-md`
                        : 'bg-gray-900 bg-opacity-50 cursor-default border-gray-700'
                    }
                    ${isSelected ? 'border-blue-400 ring-2 ring-blue-400 ring-offset-1 ring-offset-gray-900 sm:scale-105 z-10' : 'border-gray-600 z-0'}
                `}
                disabled={!item}
            >
                {item ? (
                    <>
                        {/* Item icon/emoji */}
                        <div className="absolute inset-0 flex items-center justify-center text-xl sm:text-2xl">
                            {getItemIcon(item.id)}
                        </div>

                        {/* Stack count */}
                        {item.count > 1 && (
                            <div className="absolute bottom-0.5 right-0.5 sm:bottom-1 sm:right-1 text-xs font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
                                {item.count}
                            </div>
                        )}

                        {/* Enchantment glint */}
                        {item.enchantments && item.enchantments.length > 0 && (
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded animate-pulse"></div>
                        )}

                        {/* Hover tooltip - hide on mobile */}
                        <div className="hidden sm:block absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                            <div className="font-medium">{getItemDisplayName(item)}</div>
                            {item.enchantments && item.enchantments.length > 0 && (
                                <div className="text-purple-400 text-xs">
                                    {item.enchantments.map(e => e.id.replace('minecraft:', '')).join(', ')}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-700 text-xl">
                        ·
                    </div>
                )}
            </button>
        );
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center sm:justify-end z-50">
            <div className="bg-gray-800 w-full sm:max-w-2xl h-full overflow-y-auto shadow-2xl">
                {/* Header */}
                <div className="sticky top-0 bg-gray-900 p-3 sm:p-4 border-b border-gray-700 flex justify-between items-center z-10">
                    <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                        <span>📦</span> <span className="hidden xs:inline">Inventory Transfer</span><span className="xs:hidden">Inventory</span>
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white text-2xl leading-none"
                    >
                        ×
                    </button>
                </div>

                <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                    {/* Source Player Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Source Player (Your Character)
                        </label>
                        <select
                            value={sourcePlayer}
                            onChange={(e) => setSourcePlayer(e.target.value)}
                            className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:border-blue-500"
                            disabled={loading}
                        >
                            <option value="">Select a player...</option>
                            {allPlayers.map(player => (
                                <option key={player} value={player}>
                                    {player}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Loading State */}
                    {loading && sourcePlayer && !inventory && (
                        <div className="text-center text-gray-400 py-8">
                            Loading inventory...
                        </div>
                    )}

                    {/* Inventory Display */}
                    {inventory && (
                        <div className="space-y-4">
                            {/* Player Info */}
                            <div className="bg-gray-900 p-3 rounded">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-300">
                                        <span className="font-bold text-white">{inventory.playerName}</span>'s Inventory
                                    </span>
                                    <span className={`text-sm px-2 py-1 rounded ${inventory.isOnline ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
                                        {inventory.isOnline ? '● Online' : '○ Offline'}
                                    </span>
                                </div>
                            </div>

                            {/* Main Inventory Grid (27 slots, 3x9) */}
                            <div>
                                <div className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                                    <span>📦</span> Main Inventory
                                </div>
                                <div className="overflow-x-auto pb-2">
                                    <div className="grid grid-cols-5 sm:grid-cols-9 gap-2.5 sm:gap-3 bg-gray-900 bg-opacity-30 p-3 sm:p-3 rounded">
                                        {Array.from({ length: 27 }, (_, i) => renderInventorySlot(i + 9))}
                                    </div>
                                </div>
                            </div>

                            {/* Hotbar (9 slots) */}
                            <div>
                                <div className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                                    <span>🎯</span> Hotbar
                                </div>
                                <div className="overflow-x-auto pb-2">
                                    <div className="grid grid-cols-5 sm:grid-cols-9 gap-2.5 sm:gap-3 bg-gray-900 bg-opacity-30 p-3 sm:p-3 rounded">
                                        {Array.from({ length: 9 }, (_, i) => renderInventorySlot(i))}
                                    </div>
                                </div>
                            </div>

                            {/* Armor Slots */}
                            <div>
                                <div className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                                    <span>🛡️</span> Armor
                                </div>
                                <div className="overflow-x-auto pb-2">
                                    <div className="grid grid-cols-4 gap-3 sm:gap-3 w-fit bg-gray-900 bg-opacity-30 p-3 sm:p-3 rounded">
                                        {[103, 102, 101, 100].map(slotIndex => (
                                            <div key={slotIndex} className="flex flex-col items-center">
                                                <div className="text-xs text-gray-400 mb-1 text-center font-medium hidden sm:block">
                                                    {slotIndex === 103 ? '⛑️ Head' : slotIndex === 102 ? '👕 Chest' : slotIndex === 101 ? '👖 Legs' : '👞 Feet'}
                                                </div>
                                                <div className="text-xs text-gray-400 mb-1 text-center font-medium sm:hidden">
                                                    {slotIndex === 103 ? '⛑️' : slotIndex === 102 ? '👕' : slotIndex === 101 ? '👖' : '👞'}
                                                </div>
                                                {renderInventorySlot(slotIndex)}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Backpacks Section */}
                            {inventory.backpacks && inventory.backpacks.length > 0 && (
                                <div>
                                    <div className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                                        <span>🎒</span> Traveler's Backpacks
                                    </div>
                                    <div className="space-y-3">
                                        {inventory.backpacks.map((backpack, idx) => (
                                            <div key={idx} className="bg-gray-900 bg-opacity-50 rounded p-3">
                                                <button
                                                    onClick={() => setExpandedBackpack(expandedBackpack === backpack.slot ? null : backpack.slot)}
                                                    className="w-full flex items-center justify-between text-left hover:bg-gray-800 rounded p-2 transition-colors"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-2xl">🎒</span>
                                                        <div>
                                                            <div className="text-white font-medium">
                                                                Backpack (Slot {backpack.slot})
                                                            </div>
                                                            <div className="text-xs text-gray-400">
                                                                {backpack.contents.length} items inside
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <span className="text-gray-400 text-xl">
                                                        {expandedBackpack === backpack.slot ? '▼' : '▶'}
                                                    </span>
                                                </button>
                                                {expandedBackpack === backpack.slot && (
                                                    <div className="mt-3 border-t border-gray-700 pt-3">
                                                        <div className="overflow-x-auto pb-2">
                                                            <div className="grid grid-cols-5 sm:grid-cols-9 gap-2 bg-gray-900 bg-opacity-30 p-2 sm:p-3 rounded min-w-fit">
                                                                {backpack.contents.map((item, itemIdx) => {
                                                                    const itemColor = getItemColor(item);
                                                                    const itemName = getItemDisplayName(item);
                                                                    return (
                                                                        <div
                                                                            key={itemIdx}
                                                                            className={`
                                                                                relative w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded
                                                                                bg-gray-800 border cursor-default
                                                                                ${itemColor}
                                                                            `}
                                                                            title={`${itemName} x${item.count}${item.enchantments ? ' (Enchanted)' : ''}`}
                                                                        >
                                                                            <span className="text-lg sm:text-xl">{getItemIcon(item.id)}</span>
                                                                            {item.count > 1 && (
                                                                                <div className="absolute bottom-0 right-0.5 text-xs font-bold text-white bg-black bg-opacity-70 px-0.5 rounded">
                                                                                    {item.count}
                                                                                </div>
                                                                            )}
                                                                            {item.enchantments && item.enchantments.length > 0 && (
                                                                                <div className="absolute top-0 left-0.5 text-xs">✨</div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Selected Item Details */}
                    {selectedItem && (
                        <div className="bg-gray-900 p-4 rounded space-y-3">
                            <h3 className="font-bold text-white">Selected Item</h3>
                            <div className="space-y-2 text-sm">
                                <div>
                                    <span className="text-gray-400">Name: </span>
                                    <span className="text-white">{getItemDisplayName(selectedItem)}</span>
                                </div>
                                <div>
                                    <span className="text-gray-400">ID: </span>
                                    <span className="text-gray-300 font-mono text-xs">{selectedItem.id}</span>
                                </div>
                                <div>
                                    <span className="text-gray-400">Count: </span>
                                    <span className="text-white">{selectedItem.count}</span>
                                </div>
                                {selectedItem.enchantments && selectedItem.enchantments.length > 0 && (
                                    <div>
                                        <span className="text-gray-400">Enchantments: </span>
                                        <div className="mt-1 space-y-1">
                                            {selectedItem.enchantments.map((ench, idx) => (
                                                <div key={idx} className="text-purple-400 text-xs">
                                                    {ench.id} {ench.level}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Amount Input */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Amount to Transfer
                                </label>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                        onClick={() => setTransferAmount(Math.max(1, transferAmount - 1))}
                                        className="bg-gray-700 text-white px-3 py-2 rounded hover:bg-gray-600 text-lg"
                                        disabled={transferAmount <= 1}
                                    >
                                        -
                                    </button>
                                    <input
                                        type="number"
                                        min="1"
                                        max={selectedItem.count}
                                        value={transferAmount}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value) || 1;
                                            setTransferAmount(Math.max(1, Math.min(selectedItem.count, val)));
                                        }}
                                        className="w-16 sm:w-20 bg-gray-700 text-white px-3 py-2 rounded text-center border border-gray-600 focus:outline-none focus:border-blue-500"
                                    />
                                    <button
                                        onClick={() => setTransferAmount(Math.min(selectedItem.count, transferAmount + 1))}
                                        className="bg-gray-700 text-white px-3 py-2 rounded hover:bg-gray-600 text-lg"
                                        disabled={transferAmount >= selectedItem.count}
                                    >
                                        +
                                    </button>
                                    <button
                                        onClick={() => setTransferAmount(selectedItem.count)}
                                        className="bg-gray-700 text-white px-3 py-2 rounded hover:bg-gray-600 text-sm"
                                    >
                                        Max
                                    </button>
                                </div>
                            </div>

                            {/* Target Player Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Target Player
                                </label>
                                <select
                                    value={targetPlayer}
                                    onChange={(e) => setTargetPlayer(e.target.value)}
                                    className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:border-blue-500"
                                    disabled={loading}
                                >
                                    <option value="">Select target player...</option>
                                    {allPlayers
                                        .filter(p => p !== sourcePlayer)
                                        .map(player => (
                                            <option key={player} value={player}>
                                                {player}
                                            </option>
                                        ))}
                                </select>
                            </div>

                            {/* Transfer Button */}
                            <button
                                onClick={handleTransfer}
                                disabled={loading || !targetPlayer}
                                className={`
                                    w-full py-2 px-4 rounded font-medium transition-colors
                                    ${loading || !targetPlayer
                                        ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                    }
                                `}
                            >
                                {loading ? 'Transferring...' : `Send ${transferAmount}x to ${targetPlayer || '...'}`}
                            </button>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-900 bg-opacity-50 border border-red-600 text-red-200 px-4 py-3 rounded">
                            {error}
                        </div>
                    )}

                    {/* Success Message */}
                    {success && (
                        <div className="bg-green-900 bg-opacity-50 border border-green-600 text-green-200 px-4 py-3 rounded">
                            {success}
                        </div>
                    )}

                    {/* Instructions */}
                    {!sourcePlayer && (
                        <div className="bg-gray-900 p-4 rounded text-sm text-gray-400">
                            <p className="font-medium text-white mb-2">How to use:</p>
                            <ol className="list-decimal list-inside space-y-1">
                                <li>Select your Minecraft character (source player)</li>
                                <li>Click on an item in your inventory</li>
                                <li>Choose how many to send</li>
                                <li>Select an online player to receive the items</li>
                                <li>Click Send to complete the transfer</li>
                            </ol>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
