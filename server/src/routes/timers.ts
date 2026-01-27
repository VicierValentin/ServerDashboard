import type { FastifyInstance } from 'fastify';
import {
    getShutdownTimers,
    addOrUpdateTimer,
    removeTimer,
    skipTimer
} from '../services/timers.js';
import type { CreateTimerRequest } from '../types.js';

export async function timerRoutes(fastify: FastifyInstance) {
    // GET /api/timers - List all shutdown timers
    fastify.get('/api/timers', async (request, reply) => {
        try {
            const timers = await getShutdownTimers();
            return timers;
        } catch (error) {
            console.error('Failed to get timers:', error);
            reply.status(500).send({ error: 'Failed to get timers' });
        }
    });

    // POST /api/timers - Create a new timer
    fastify.post<{ Body: CreateTimerRequest }>('/api/timers', async (request, reply) => {
        try {
            const timerData = request.body;

            // Basic validation
            if (!timerData.name || !timerData.onCalendar) {
                reply.status(400).send({ error: 'name and onCalendar are required' });
                return;
            }

            const timers = await addOrUpdateTimer({
                name: timerData.name,
                onCalendar: timerData.onCalendar,
                active: timerData.active ?? true,
            });
            return timers;
        } catch (error: any) {
            console.error('Failed to create timer:', error);
            reply.status(500).send({ error: error.message || 'Failed to create timer' });
        }
    });

    // PUT /api/timers/:id - Update an existing timer
    fastify.put<{ Params: { id: string }; Body: CreateTimerRequest }>(
        '/api/timers/:id',
        async (request, reply) => {
            try {
                const { id } = request.params;
                const timerData = request.body;

                // Basic validation
                if (!timerData.name || !timerData.onCalendar) {
                    reply.status(400).send({ error: 'name and onCalendar are required' });
                    return;
                }

                const timers = await addOrUpdateTimer({
                    id,
                    name: timerData.name,
                    onCalendar: timerData.onCalendar,
                    active: timerData.active ?? true,
                });
                return timers;
            } catch (error: any) {
                console.error('Failed to update timer:', error);
                reply.status(500).send({ error: error.message || 'Failed to update timer' });
            }
        }
    );

    // DELETE /api/timers/:id - Remove a timer
    fastify.delete<{ Params: { id: string } }>('/api/timers/:id', async (request, reply) => {
        try {
            const { id } = request.params;
            const timers = await removeTimer(id);
            return timers;
        } catch (error: any) {
            console.error('Failed to remove timer:', error);
            reply.status(500).send({ error: error.message || 'Failed to remove timer' });
        }
    });

    // POST /api/timers/:id/skip - Skip a timer temporarily
    fastify.post<{ Params: { id: string } }>('/api/timers/:id/skip', async (request, reply) => {
        try {
            const { id } = request.params;
            const timers = await skipTimer(id);
            return timers;
        } catch (error: any) {
            console.error('Failed to skip timer:', error);
            reply.status(500).send({ error: error.message || 'Failed to skip timer' });
        }
    });
}
