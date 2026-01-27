import type { FastifyInstance } from 'fastify';
import { listDirectory, getFileForDownload, uploadFile } from '../services/fileManager.js';
import type { MultipartFile } from '@fastify/multipart';

export async function fileRoutes(fastify: FastifyInstance) {
    // GET /api/servers/:id/files - List directory contents
    fastify.get<{
        Params: { id: string };
        Querystring: { path?: string }
    }>('/api/servers/:id/files', async (request, reply) => {
        try {
            const { id } = request.params;
            const path = request.query.path || '/';
            const files = await listDirectory(id, path);
            return files;
        } catch (error: any) {
            console.error('Failed to list directory:', error);
            reply.status(error.message.includes('Unknown server') ? 404 : 500)
                .send({ error: error.message || 'Failed to list directory' });
        }
    });

    // GET /api/servers/:id/files/download - Download a file
    fastify.get<{
        Params: { id: string };
        Querystring: { path: string }
    }>('/api/servers/:id/files/download', async (request, reply) => {
        try {
            const { id } = request.params;
            const { path } = request.query;

            if (!path) {
                reply.status(400).send({ error: 'path query parameter is required' });
                return;
            }

            const { stream, filename, size, mimeType } = await getFileForDownload(id, path);

            reply
                .header('Content-Type', mimeType)
                .header('Content-Disposition', `attachment; filename="${filename}"`)
                .header('Content-Length', size);

            return reply.send(stream);
        } catch (error: any) {
            console.error('Failed to download file:', error);
            reply.status(error.message.includes('Unknown server') ? 404 : 500)
                .send({ error: error.message || 'Failed to download file' });
        }
    });

    // POST /api/servers/:id/files/upload - Upload a file
    fastify.post<{
        Params: { id: string };
        Querystring: { path?: string }
    }>('/api/servers/:id/files/upload', async (request, reply) => {
        try {
            const { id } = request.params;
            const uploadPath = request.query.path || '/';

            // Get the multipart file
            const data = await request.file();

            if (!data) {
                reply.status(400).send({ error: 'No file uploaded' });
                return;
            }

            const fileEntry = await uploadFile(id, uploadPath, data.filename, data.file);
            return fileEntry;
        } catch (error: any) {
            console.error('Failed to upload file:', error);
            reply.status(error.message.includes('Unknown server') ? 404 : 500)
                .send({ error: error.message || 'Failed to upload file' });
        }
    });
}
