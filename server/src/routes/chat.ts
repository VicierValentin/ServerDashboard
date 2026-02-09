import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import { startChatSession } from '../services/chatService.js';
import { validateMinecraftServer, getOnlinePlayers, sendTellrawMessage } from '../services/rconConsole.js';

// Track dashboard users connected to each server
interface DashboardUser {
    username: string;
    socket: WebSocket;
}

// Map of serverId -> array of connected dashboard users
const dashboardUsers = new Map<string, DashboardUser[]>();

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

            let currentUsername: string | null = null;

            // Start chat stream
            const cleanup = startChatSession(
                serverId,
                (chatMessage) => {
                    // Broadcast in-game chat to all connected dashboard users
                    const users = dashboardUsers.get(serverId) || [];
                    users.forEach(user => {
                        if (user.socket.readyState === 1) {
                            user.socket.send(JSON.stringify({
                                type: 'chat',
                                timestamp: chatMessage.timestamp,
                                playerName: chatMessage.playerName,
                                message: chatMessage.message,
                                source: 'game',
                            }));
                        }
                    });
                },
                (error) => {
                    console.error(`Chat stream error for ${serverId}:`, error);
                    if (socket.readyState === 1) {
                        socket.send(JSON.stringify({ type: 'error', data: error.message }));
                    }
                }
            );

            // Send initial player count (including dashboard users)
            const sendPlayerCount = async () => {
                try {
                    const playerInfo = await getOnlinePlayers(serverId);
                    const users = dashboardUsers.get(serverId) || [];
                    const dashboardUsernames = users.map(u => u.username);
                    const totalCount = playerInfo.count + users.length;

                    // Broadcast to all connected dashboard users
                    users.forEach(user => {
                        if (user.socket.readyState === 1) {
                            user.socket.send(JSON.stringify({
                                type: 'playerCount',
                                count: totalCount,
                                max: playerInfo.max,
                                players: playerInfo.players,
                                dashboardUsers: dashboardUsernames,
                            }));
                        }
                    });
                } catch (error) {
                    console.error(`Error getting player count for ${serverId}:`, error);
                }
            };

            // Set up periodic player count updates (every 10 seconds)
            const playerCountInterval = setInterval(sendPlayerCount, 10000);

            // Handle incoming messages from client
            socket.on('message', async (message: Buffer | string) => {
                try {
                    const data = JSON.parse(message.toString());

                    if (data.type === 'register' && data.username) {
                        // Register dashboard user
                        currentUsername = data.username;

                        // Add to tracking
                        if (!dashboardUsers.has(serverId)) {
                            dashboardUsers.set(serverId, []);
                        }
                        const users = dashboardUsers.get(serverId)!;
                        users.push({ username: data.username, socket });

                        console.log(`Dashboard user ${data.username} registered for ${serverId}`);

                        // Send initial player count to all users
                        await sendPlayerCount();

                        // Broadcast join notification to all users
                        const timestamp = new Date().toLocaleTimeString('en-US', {
                            hour12: false,
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                        });
                        users.forEach(user => {
                            if (user.socket.readyState === 1) {
                                user.socket.send(JSON.stringify({
                                    type: 'userJoined',
                                    username: data.username,
                                    timestamp,
                                }));
                            }
                        });

                        // Notify user they're ready
                        socket.send(JSON.stringify({ type: 'registered' }));

                    } else if (data.type === 'message' && data.message && data.username) {
                        console.log(`Chat message from ${data.username} to ${serverId}: ${data.message}`);

                        // Send message via tellraw to in-game players
                        const success = await sendTellrawMessage(
                            serverId,
                            data.username,
                            data.message
                        );

                        // Broadcast to all dashboard users
                        const users = dashboardUsers.get(serverId) || [];
                        const timestamp = new Date().toLocaleTimeString('en-US', {
                            hour12: false,
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                        });

                        users.forEach(user => {
                            if (user.socket.readyState === 1) {
                                user.socket.send(JSON.stringify({
                                    type: 'chat',
                                    timestamp,
                                    playerName: data.username,
                                    message: data.message,
                                    source: 'dashboard',
                                }));
                            }
                        });

                        // Send confirmation back to sender
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

                // Remove user from tracking
                if (currentUsername) {
                    const users = dashboardUsers.get(serverId) || [];
                    const index = users.findIndex(u => u.socket === socket);
                    if (index !== -1) {
                        users.splice(index, 1);
                        console.log(`Dashboard user ${currentUsername} removed from ${serverId}`);

                        // Broadcast user left notification to remaining users
                        const timestamp = new Date().toLocaleTimeString('en-US', {
                            hour12: false,
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                        });
                        users.forEach(user => {
                            if (user.socket.readyState === 1) {
                                user.socket.send(JSON.stringify({
                                    type: 'userLeft',
                                    username: currentUsername,
                                    timestamp,
                                }));
                            }
                        });

                        // Broadcast updated player count to remaining users immediately
                        sendPlayerCount().catch(err =>
                            console.error('Error updating player count after disconnect:', err)
                        );
                    }
                    if (users.length === 0) {
                        dashboardUsers.delete(serverId);
                    }
                }
            });

            socket.on('error', (error: Error) => {
                console.error(`WebSocket error for chat ${serverId}:`, error);
                clearInterval(playerCountInterval);
                cleanup();

                // Remove user from tracking
                if (currentUsername) {
                    const users = dashboardUsers.get(serverId) || [];
                    const index = users.findIndex(u => u.socket === socket);
                    if (index !== -1) {
                        users.splice(index, 1);
                        console.log(`Dashboard user ${currentUsername} removed from ${serverId} after error`);

                        // Broadcast user left notification to remaining users
                        const timestamp = new Date().toLocaleTimeString('en-US', {
                            hour12: false,
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                        });
                        users.forEach(user => {
                            if (user.socket.readyState === 1) {
                                user.socket.send(JSON.stringify({
                                    type: 'userLeft',
                                    username: currentUsername,
                                    timestamp,
                                }));
                            }
                        });

                        // Broadcast updated player count to remaining users immediately
                        sendPlayerCount().catch(err =>
                            console.error('Error updating player count after error:', err)
                        );
                    }
                    if (users.length === 0) {
                        dashboardUsers.delete(serverId);
                    }
                }
            });
        }
    );
}
