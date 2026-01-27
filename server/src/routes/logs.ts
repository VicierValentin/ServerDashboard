import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import { streamLogs, validateServerId } from '../services/logStreamer.js';

export async function logRoutes(fastify: FastifyInstance) {
    // WebSocket /ws/logs/:serverId - Stream logs for a game server
    fastify.get<{ Params: { serverId: string } }>(
        '/ws/logs/:serverId',
        { websocket: true },
        async (connection, request) => {
            const socket: WebSocket = connection;
            const { serverId } = request.params;

            // Validate server ID
            const isValid = await validateServerId(serverId);
            if (!isValid) {
                socket.send(JSON.stringify({ error: `Unknown server: ${serverId}` }));
                socket.close();
                return;
            }

            console.log(`Starting log stream for ${serverId}`);

            // Start streaming logs
            const cleanup = streamLogs(
                serverId,
                (line) => {
                    if (socket.readyState === 1) { // WebSocket.OPEN
                        socket.send(line);
                    }
                },
                (error) => {
                    console.error(`Log stream error for ${serverId}:`, error);
                    if (socket.readyState === 1) {
                        socket.send(JSON.stringify({ error: error.message }));
                    }
                }
            );

            // Handle client disconnect
            socket.on('close', () => {
                console.log(`Client disconnected from log stream ${serverId}`);
                cleanup();
            });

            socket.on('error', (error: Error) => {
                console.error(`WebSocket error for ${serverId}:`, error);
                cleanup();
            });
        }
    );
}
