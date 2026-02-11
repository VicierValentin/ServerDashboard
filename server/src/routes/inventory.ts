import type { FastifyInstance } from 'fastify';
import { validateMinecraftServer } from '../services/rconConsole.js';
import {
    getPlayerInventory,
    transferItems,
    getAllPlayers
} from '../services/inventoryService.js';
import type { InventoryTransferRequest } from '../types.js';

export async function inventoryRoutes(fastify: FastifyInstance) {
    // GET /api/servers/:id/inventory/players - Get list of all players
    fastify.get<{ Params: { id: string } }>(
        '/api/servers/:id/inventory/players',
        async (request, reply) => {
            try {
                const { id } = request.params;

                // Validate this is a Minecraft server
                const isValid = await validateMinecraftServer(id);
                if (!isValid) {
                    return reply.status(400).send({ error: 'Not a Minecraft server' });
                }

                const players = await getAllPlayers(id);
                return { players };
            } catch (error: any) {
                console.error('Failed to get player list:', error);
                reply.status(500).send({ error: error.message || 'Failed to get player list' });
            }
        }
    );

    // GET /api/servers/:id/inventory/:playerName - Get player inventory
    fastify.get<{ Params: { id: string; playerName: string } }>(
        '/api/servers/:id/inventory/:playerName',
        async (request, reply) => {
            try {
                const { id, playerName } = request.params;

                // Validate this is a Minecraft server
                const isValid = await validateMinecraftServer(id);
                if (!isValid) {
                    return reply.status(400).send({ error: 'Not a Minecraft server' });
                }

                const inventory = await getPlayerInventory(id, playerName);
                return inventory;
            } catch (error: any) {
                console.error('Failed to get player inventory:', error);
                reply.status(500).send({
                    error: error.message || 'Failed to get player inventory'
                });
            }
        }
    );

    // POST /api/servers/:id/inventory/transfer - Transfer items between players
    fastify.post<{
        Params: { id: string };
        Body: InventoryTransferRequest;
    }>(
        '/api/servers/:id/inventory/transfer',
        async (request, reply) => {
            try {
                const { id } = request.params;
                const { sourcePlayer, targetPlayer, itemSlot, amount, source, parentSlot, accessoryType } = request.body;

                // Validate this is a Minecraft server
                const isValid = await validateMinecraftServer(id);
                if (!isValid) {
                    return reply.status(400).send({ error: 'Not a Minecraft server' });
                }

                // Validate request body
                if (!sourcePlayer || !targetPlayer || itemSlot === undefined || !amount) {
                    return reply.status(400).send({
                        error: 'Missing required fields: sourcePlayer, targetPlayer, itemSlot, amount'
                    });
                }

                if (amount <= 0) {
                    return reply.status(400).send({ error: 'Amount must be greater than 0' });
                }

                if (sourcePlayer === targetPlayer) {
                    return reply.status(400).send({ error: 'Cannot transfer to the same player' });
                }

                const result = await transferItems(
                    id,
                    sourcePlayer,
                    targetPlayer,
                    itemSlot,
                    amount,
                    source || 'inventory',
                    parentSlot,
                    accessoryType
                );

                if (!result.success) {
                    return reply.status(400).send({
                        error: result.error || 'Transfer failed'
                    });
                }

                return result;
            } catch (error: any) {
                console.error('Failed to transfer items:', error);
                reply.status(500).send({
                    error: error.message || 'Failed to transfer items'
                });
            }
        }
    );
}
