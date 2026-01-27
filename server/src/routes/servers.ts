import type { FastifyInstance } from 'fastify';
import { getGameServers, toggleGameServer } from '../services/gameServers.js';

export async function serverRoutes(fastify: FastifyInstance) {
    // GET /api/servers - List all game servers
    fastify.get('/api/servers', async (request, reply) => {
        try {
            const servers = await getGameServers();
            return servers;
        } catch (error) {
            console.error('Failed to get game servers:', error);
            reply.status(500).send({ error: 'Failed to get game servers' });
        }
    });

    // POST /api/servers/:id/start - Start a game server
    fastify.post<{ Params: { id: string } }>('/api/servers/:id/start', async (request, reply) => {
        try {
            const { id } = request.params;
            const servers = await toggleGameServer(id, 'start');
            return servers;
        } catch (error: any) {
            console.error('Failed to start game server:', error);
            reply.status(500).send({ error: error.message || 'Failed to start game server' });
        }
    });

    // POST /api/servers/:id/stop - Stop a game server
    fastify.post<{ Params: { id: string } }>('/api/servers/:id/stop', async (request, reply) => {
        try {
            const { id } = request.params;
            const servers = await toggleGameServer(id, 'stop');
            return servers;
        } catch (error: any) {
            console.error('Failed to stop game server:', error);
            reply.status(500).send({ error: error.message || 'Failed to stop game server' });
        }
    });
}
