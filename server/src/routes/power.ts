import type { FastifyInstance } from 'fastify';
import { performPowerAction, cancelPowerAction } from '../services/power.js';

export async function powerRoutes(fastify: FastifyInstance) {
    // POST /api/power/shutdown - Shutdown the system
    fastify.post('/api/power/shutdown', async (request, reply) => {
        try {
            await performPowerAction('shutdown');
            return { success: true, message: 'Shutdown scheduled in 1 minute' };
        } catch (error: any) {
            console.error('Failed to initiate shutdown:', error);
            reply.status(500).send({ error: error.message || 'Failed to initiate shutdown' });
        }
    });

    // POST /api/power/restart - Restart the system
    fastify.post('/api/power/restart', async (request, reply) => {
        try {
            await performPowerAction('restart');
            return { success: true, message: 'Restart scheduled in 1 minute' };
        } catch (error: any) {
            console.error('Failed to initiate restart:', error);
            reply.status(500).send({ error: error.message || 'Failed to initiate restart' });
        }
    });

    // POST /api/power/cancel - Cancel pending shutdown/restart
    fastify.post('/api/power/cancel', async (request, reply) => {
        try {
            await cancelPowerAction();
            return { success: true, message: 'Pending power action cancelled' };
        } catch (error: any) {
            console.error('Failed to cancel power action:', error);
            reply.status(500).send({ error: error.message || 'Failed to cancel power action' });
        }
    });
}
