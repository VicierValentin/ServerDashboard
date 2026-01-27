import type { FastifyInstance } from 'fastify';
import { getSystemStats } from '../services/systemStats.js';

export async function systemRoutes(fastify: FastifyInstance) {
    // GET /api/system/stats
    fastify.get('/api/system/stats', async (request, reply) => {
        try {
            const stats = await getSystemStats();
            return stats;
        } catch (error) {
            console.error('Failed to get system stats:', error);
            reply.status(500).send({ error: 'Failed to get system stats' });
        }
    });
}
