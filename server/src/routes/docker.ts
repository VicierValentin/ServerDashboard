import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import {
    getDockerData,
    startContainer,
    stopContainer,
    restartContainer,
    pauseContainer,
    unpauseContainer,
    composeUp,
    composeDown,
    composeRestart,
    streamContainerStatus,
} from '../services/dockerService.js';

export async function dockerRoutes(fastify: FastifyInstance) {
    // GET /api/docker/data - Get all Docker containers and compose projects
    fastify.get('/api/docker/data', async (request, reply) => {
        try {
            const data = await getDockerData();
            return data;
        } catch (error) {
            console.error('Failed to get Docker data:', error);
            reply.status(500).send({ error: 'Failed to get Docker data' });
        }
    });

    // POST /api/docker/container/:id/start - Start a container
    fastify.post<{ Params: { id: string } }>('/api/docker/container/:id/start', async (request, reply) => {
        try {
            const { id } = request.params;
            await startContainer(id);
            const data = await getDockerData();
            return data;
        } catch (error: any) {
            console.error('Failed to start container:', error);
            reply.status(500).send({ error: error.message || 'Failed to start container' });
        }
    });

    // POST /api/docker/container/:id/stop - Stop a container
    fastify.post<{ Params: { id: string } }>('/api/docker/container/:id/stop', async (request, reply) => {
        try {
            const { id } = request.params;
            await stopContainer(id);
            const data = await getDockerData();
            return data;
        } catch (error: any) {
            console.error('Failed to stop container:', error);
            reply.status(500).send({ error: error.message || 'Failed to stop container' });
        }
    });

    // POST /api/docker/container/:id/restart - Restart a container
    fastify.post<{ Params: { id: string } }>('/api/docker/container/:id/restart', async (request, reply) => {
        try {
            const { id } = request.params;
            await restartContainer(id);
            const data = await getDockerData();
            return data;
        } catch (error: any) {
            console.error('Failed to restart container:', error);
            reply.status(500).send({ error: error.message || 'Failed to restart container' });
        }
    });

    // POST /api/docker/container/:id/pause - Pause a container
    fastify.post<{ Params: { id: string } }>('/api/docker/container/:id/pause', async (request, reply) => {
        try {
            const { id } = request.params;
            await pauseContainer(id);
            const data = await getDockerData();
            return data;
        } catch (error: any) {
            console.error('Failed to pause container:', error);
            reply.status(500).send({ error: error.message || 'Failed to pause container' });
        }
    });

    // POST /api/docker/container/:id/unpause - Unpause a container
    fastify.post<{ Params: { id: string } }>('/api/docker/container/:id/unpause', async (request, reply) => {
        try {
            const { id } = request.params;
            await unpauseContainer(id);
            const data = await getDockerData();
            return data;
        } catch (error: any) {
            console.error('Failed to unpause container:', error);
            reply.status(500).send({ error: error.message || 'Failed to unpause container' });
        }
    });

    // POST /api/docker/compose/:project/up - Bring up a compose project
    fastify.post<{ Params: { project: string } }>('/api/docker/compose/:project/up', async (request, reply) => {
        try {
            const { project } = request.params;
            await composeUp(project);
            const data = await getDockerData();
            return data;
        } catch (error: any) {
            console.error('Failed to bring up compose project:', error);
            reply.status(500).send({ error: error.message || 'Failed to bring up compose project' });
        }
    });

    // POST /api/docker/compose/:project/down - Bring down a compose project
    fastify.post<{ Params: { project: string } }>('/api/docker/compose/:project/down', async (request, reply) => {
        try {
            const { project } = request.params;
            await composeDown(project);
            const data = await getDockerData();
            return data;
        } catch (error: any) {
            console.error('Failed to bring down compose project:', error);
            reply.status(500).send({ error: error.message || 'Failed to bring down compose project' });
        }
    });

    // POST /api/docker/compose/:project/restart - Restart a compose project
    fastify.post<{ Params: { project: string } }>('/api/docker/compose/:project/restart', async (request, reply) => {
        try {
            const { project } = request.params;
            await composeRestart(project);
            const data = await getDockerData();
            return data;
        } catch (error: any) {
            console.error('Failed to restart compose project:', error);
            reply.status(500).send({ error: error.message || 'Failed to restart compose project' });
        }
    });

    // WebSocket /ws/docker/status - Stream Docker container status updates
    fastify.get(
        '/ws/docker/status',
        { websocket: true },
        async (connection, request) => {
            const socket: WebSocket = connection;

            console.log('Starting Docker status stream');

            // Start streaming status updates
            const cleanup = await streamContainerStatus((data) => {
                if (socket.readyState === 1) { // WebSocket.OPEN
                    socket.send(JSON.stringify(data));
                }
            });

            // Handle client disconnect
            socket.on('close', () => {
                console.log('Client disconnected from Docker status stream');
                cleanup();
            });

            socket.on('error', (error: Error) => {
                console.error('WebSocket error for Docker status stream:', error);
                cleanup();
            });
        }
    );
}
