import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import { startChatSession } from '../services/chatService.js';
import { validateMinecraftServer, getOnlinePlayers, sendTellrawMessage } from '../services/rconConsole.js';

export async function chatRoutes(fastify: FastifyInstance) {
    // WebSocket /ws/chat/:serverId - Chat interface for Minecraft servers
    fastify.get<{ Params: { serverId: string } }>(
        '/ws/chat/:serverId',
        { websocket: true },
        async (connection, request) => {
            const socket: WebSocket = connection;
            const { serverId } = request.params;

            // Validate server ID and check if it's a Minecraft server
            const isValid = await validateMinecraftServer(serverId);
            if (!isValid) {
                socket.send(JSON.stringify({ error: `Server ${serverId} is not a valid Minecraft server` }));
                socket.close();
                return;
            }

            console.log(`Starting chat session for ${serverId}`);

            // Start chat stream
            const cleanup = startChatSession(
                serverId,
                (chatMessage) => {
                    if (socket.readyState === 1) { // WebSocket.OPEN
                        socket.send(JSON.stringify({
                            type: 'chat',
                            timestamp: chatMessage.timestamp,
                            playerName: chatMessage.playerName,
                            message: chatMessage.message,
                        }));
                    }
                },
                (error) => {
                    console.error(`Chat stream error for ${serverId}:`, error);
                    if (socket.readyState === 1) {
                        socket.send(JSON.stringify({ type: 'error', data: error.message }));
                    }
                }
            );

            // Send initial player count
            const sendPlayerCount = async () => {
                try {
                    const playerInfo = await getOnlinePlayers(serverId);
                    if (socket.readyState === 1) {
                        socket.send(JSON.stringify({
                            type: 'playerCount',
                            count: playerInfo.count,
                            max: playerInfo.max,
                            players: playerInfo.players,
                        }));
                    }
                } catch (error) {
                    console.error(`Error getting player count for ${serverId}:`, error);
                }
            };

            // Send initial player count
            await sendPlayerCount();

            // Set up periodic player count updates (every 10 seconds)
            const playerCountInterval = setInterval(sendPlayerCount, 10000);

            // Handle incoming messages from client
            socket.on('message', async (message: Buffer | string) => {
                try {
                    const data = JSON.parse(message.toString());

                    if (data.type === 'message' && data.message && data.username) {
                        console.log(`Chat message from ${data.username} to ${serverId}: ${data.message}`);

                        // Send message via tellraw
                        const success = await sendTellrawMessage(
                            serverId,
                            data.username,
                            data.message
                        );

                        // Send confirmation back to client
                        if (socket.readyState === 1) {
                            socket.send(JSON.stringify({
                                type: 'sent',
                                success,
                            }));
                        }
                    } else if (data.type === 'requestPlayerCount') {
                        // Client requesting player count update
                        await sendPlayerCount();
                    }
                } catch (e) {
                    console.error('Invalid message format:', e);
                }
            });

            // Handle client disconnect
            socket.on('close', () => {
                console.log(`Client disconnected from chat ${serverId}`);
                clearInterval(playerCountInterval);
                cleanup();
            });

            socket.on('error', (error: Error) => {
                console.error(`WebSocket error for chat ${serverId}:`, error);
                clearInterval(playerCountInterval);
                cleanup();
            });
        }
    );
}
