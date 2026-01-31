import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import { startRconSession, validateMinecraftServer } from '../services/rconConsole.js';

export async function consoleRoutes(fastify: FastifyInstance) {
    // WebSocket /ws/console/:serverId - Interactive RCON console for Minecraft servers
    fastify.get<{ Params: { serverId: string } }>(
        '/ws/console/:serverId',
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

            console.log(`Starting RCON console for ${serverId}`);

            // Start RCON session
            const { cleanup, sendCommand } = startRconSession(
                serverId,
                (line) => {
                    if (socket.readyState === 1) { // WebSocket.OPEN
                        socket.send(JSON.stringify({ type: 'output', data: line }));
                    }
                },
                (error) => {
                    console.error(`RCON error for ${serverId}:`, error);
                    if (socket.readyState === 1) {
                        socket.send(JSON.stringify({ type: 'error', data: error.message }));
                    }
                }
            );

            // Send ready signal
            socket.send(JSON.stringify({ type: 'ready' }));

            // Handle incoming commands from client
            socket.on('message', (message: Buffer | string) => {
                try {
                    const data = JSON.parse(message.toString());
                    if (data.type === 'command' && data.command) {
                        console.log(`RCON command for ${serverId}: ${data.command}`);
                        sendCommand(data.command);
                    }
                } catch (e) {
                    console.error('Invalid message format:', e);
                }
            });

            // Handle client disconnect
            socket.on('close', () => {
                console.log(`Client disconnected from RCON console ${serverId}`);
                cleanup();
            });

            socket.on('error', (error: Error) => {
                console.error(`WebSocket error for RCON ${serverId}:`, error);
                cleanup();
            });
        }
    );
}
