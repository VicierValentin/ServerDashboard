import type { FastifyInstance } from 'fastify';
import { getGameServers, toggleGameServer, toggleGameServerEnabled } from '../services/gameServers.js';

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

    // POST /api/servers/:id/enable - Enable a game server (start at boot)
    fastify.post<{ Params: { id: string } }>('/api/servers/:id/enable', async (request, reply) => {
        try {
            const { id } = request.params;
            const servers = await toggleGameServerEnabled(id, 'enable');
            return servers;
        } catch (error: any) {
            console.error('Failed to enable game server:', error);
            reply.status(500).send({ error: error.message || 'Failed to enable game server' });
        }
    });

    // POST /api/servers/:id/disable - Disable a game server (don't start at boot)
    fastify.post<{ Params: { id: string } }>('/api/servers/:id/disable', async (request, reply) => {
        try {
            const { id } = request.params;
            const servers = await toggleGameServerEnabled(id, 'disable');
            return servers;
        } catch (error: any) {
            console.error('Failed to disable game server:', error);
            reply.status(500).send({ error: error.message || 'Failed to disable game server' });
        }
    });
}
