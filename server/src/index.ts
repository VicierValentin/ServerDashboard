import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import multipart from '@fastify/multipart';

import { PORT, HOST, FRONTEND_ORIGIN } from './config.js';
import { systemRoutes } from './routes/system.js';
import { serverRoutes } from './routes/servers.js';
import { timerRoutes } from './routes/timers.js';
import { powerRoutes } from './routes/power.js';
import { logRoutes } from './routes/logs.js';
import { fileRoutes } from './routes/files.js';

async function main() {
    const fastify = Fastify({
        logger: true,
    });

    // Register CORS
    await fastify.register(cors, {
        origin: FRONTEND_ORIGIN,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
    });

    // Register WebSocket support
    await fastify.register(websocket);

    // Register multipart support for file uploads
    await fastify.register(multipart, {
        limits: {
            fileSize: 100 * 1024 * 1024, // 100MB max file size
        },
    });

    // Register routes
    await fastify.register(systemRoutes);
    await fastify.register(serverRoutes);
    await fastify.register(timerRoutes);
    await fastify.register(powerRoutes);
    await fastify.register(logRoutes);
    await fastify.register(fileRoutes);

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
