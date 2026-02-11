import React, { useState, useEffect } from 'react';
import type { GameServer, PlayerInventory, MinecraftItem } from '../types';
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
    const [onlinePlayers, setOnlinePlayers] = useState<string[]>([]);

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

    // Fetch online players for target dropdown
    useEffect(() => {
        const loadOnlinePlayers = async () => {
            try {
                const playerInfo = await api.getServerPlayers(server.id);
                setOnlinePlayers(playerInfo.players);
            } catch (err) {
                // Not critical, just means target dropdown won't filter
                console.error('Failed to load online players:', err);
            }
        };
        loadOnlinePlayers();

        // Refresh every 10 seconds
        const interval = setInterval(loadOnlinePlayers, 10000);
        return () => clearInterval(interval);
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

    const renderInventorySlot = (slotIndex: number) => {
        const item = inventory?.items.find(i => i.slot === slotIndex);
        const isSelected = selectedItem?.slot === slotIndex;

        return (
            <button
                key={slotIndex}
                onClick={() => item && handleItemClick(item)}
                className={`
                    relative w-12 h-12 border-2 transition-all
                    ${item ? 'bg-gray-700 hover:bg-gray-600 cursor-pointer' : 'bg-gray-800 cursor-default'}
                    ${isSelected ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-600'}
                `}
                disabled={!item}
            >
                {item && (
                    <>
                        <div className="absolute inset-0 flex items-center justify-center text-xs text-white truncate px-1">
                            {getItemDisplayName(item).substring(0, 3)}
                        </div>
                        {item.count > 1 && (
                            <div className="absolute bottom-0 right-0 text-xs font-bold text-white bg-black bg-opacity-50 px-1">
                                {item.count}
                            </div>
                        )}
                        {item.enchantments && item.enchantments.length > 0 && (
                            <div className="absolute top-0 right-0 w-2 h-2 bg-purple-500 rounded-full"></div>
                        )}
                    </>
                )}
            </button>
        );
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-end z-50">
            <div className="bg-gray-800 w-full max-w-2xl h-full overflow-y-auto shadow-2xl">
                {/* Header */}
                <div className="sticky top-0 bg-gray-900 p-4 border-b border-gray-700 flex justify-between items-center z-10">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <span>📦</span> Inventory Transfer
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white text-2xl leading-none"
                    >
                        ×
                    </button>
                </div>

                <div className="p-4 space-y-4">
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
                                <div className="text-sm text-gray-400 mb-2">Main Inventory</div>
                                <div className="grid grid-cols-9 gap-1">
                                    {Array.from({ length: 27 }, (_, i) => renderInventorySlot(i + 9))}
                                </div>
                            </div>

                            {/* Hotbar (9 slots) */}
                            <div>
                                <div className="text-sm text-gray-400 mb-2">Hotbar</div>
                                <div className="grid grid-cols-9 gap-1">
                                    {Array.from({ length: 9 }, (_, i) => renderInventorySlot(i))}
                                </div>
                            </div>

                            {/* Armor Slots */}
                            <div>
                                <div className="text-sm text-gray-400 mb-2">Armor</div>
                                <div className="grid grid-cols-4 gap-1 w-fit">
                                    {[103, 102, 101, 100].map(slotIndex => (
                                        <div key={slotIndex}>
                                            <div className="text-xs text-gray-500 mb-1 text-center">
                                                {slotIndex === 103 ? 'Head' : slotIndex === 102 ? 'Chest' : slotIndex === 101 ? 'Legs' : 'Feet'}
                                            </div>
                                            {renderInventorySlot(slotIndex)}
                                        </div>
                                    ))}
                                </div>
                            </div>
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
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setTransferAmount(Math.max(1, transferAmount - 1))}
                                        className="bg-gray-700 text-white px-3 py-1 rounded hover:bg-gray-600"
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
                                        className="w-20 bg-gray-700 text-white px-3 py-1 rounded text-center border border-gray-600 focus:outline-none focus:border-blue-500"
                                    />
                                    <button
                                        onClick={() => setTransferAmount(Math.min(selectedItem.count, transferAmount + 1))}
                                        className="bg-gray-700 text-white px-3 py-1 rounded hover:bg-gray-600"
                                        disabled={transferAmount >= selectedItem.count}
                                    >
                                        +
                                    </button>
                                    <button
                                        onClick={() => setTransferAmount(selectedItem.count)}
                                        className="bg-gray-700 text-white px-3 py-1 rounded hover:bg-gray-600 text-sm"
                                    >
                                        Max
                                    </button>
                                </div>
                            </div>

                            {/* Target Player Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Target Player (Must be online)
                                </label>
                                <select
                                    value={targetPlayer}
                                    onChange={(e) => setTargetPlayer(e.target.value)}
                                    className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:border-blue-500"
                                    disabled={loading}
                                >
                                    <option value="">Select target player...</option>
                                    {onlinePlayers
                                        .filter(p => p !== sourcePlayer)
                                        .map(player => (
                                            <option key={player} value={player}>
                                                {player} ● Online
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
