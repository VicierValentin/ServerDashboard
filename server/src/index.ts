import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';

import { PORT, HOST, FRONTEND_ORIGIN } from './config.js';
import { systemRoutes } from './routes/system.js';
import { serverRoutes } from './routes/servers.js';
import { timerRoutes } from './routes/timers.js';
import { powerRoutes } from './routes/power.js';
import { logRoutes } from './routes/logs.js';

async function main() {
    const fastify = Fastify({
        logger: {
            level: 'info',
            transport: {
                target: 'pino-pretty',
                options: {
                    translateTime: 'HH:MM:ss Z',
                    ignore: 'pid,hostname',
                },
            },
        },
    });

    // Register CORS
    await fastify.register(cors, {
        origin: FRONTEND_ORIGIN,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
    });

    // Register WebSocket support
    await fastify.register(websocket);

    // Register routes
    await fastify.register(systemRoutes);
    await fastify.register(serverRoutes);
    await fastify.register(timerRoutes);
    await fastify.register(powerRoutes);
    await fastify.register(logRoutes);

    // Health check endpoint
    fastify.get('/api/health', async () => {
        return { status: 'ok', timestamp: new Date().toISOString() };
    });

    // Start server
    try {
        await fastify.listen({ port: PORT, host: HOST });
        console.log(`🚀 Server Dashboard Backend running at http://${HOST}:${PORT}`);
        console.log(`📡 WebSocket logs available at ws://${HOST}:${PORT}/ws/logs/:serverId`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
}

main();
