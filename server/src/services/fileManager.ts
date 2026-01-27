import { readdir, stat, readFile } from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import { join, relative, normalize, basename } from 'path';
import { GAME_SERVERS_PATH, discoverGameServers } from '../config.js';
import { pipeline } from 'stream/promises';
import type { Readable } from 'stream';

export interface FileEntry {
    name: string;
    path: string;
    isDirectory: boolean;
    size: number;
    modifiedAt: string;
}

/**
 * Validate that a path is within the allowed game server directory
 */
function validatePath(serverId: string, relativePath: string): string {
    const serverPath = join(GAME_SERVERS_PATH, serverId);
    const fullPath = normalize(join(serverPath, relativePath));

    // Prevent directory traversal attacks
    if (!fullPath.startsWith(serverPath)) {
        throw new Error('Invalid path: directory traversal not allowed');
    }

    return fullPath;
}

/**
 * List contents of a directory within a game server folder
 */
export async function listDirectory(serverId: string, relativePath: string = '/'): Promise<FileEntry[]> {
    // Validate server exists
    const servers = await discoverGameServers();
    if (!servers.find(s => s.id === serverId)) {
        throw new Error(`Unknown server: ${serverId}`);
    }

    const fullPath = validatePath(serverId, relativePath);

    try {
        const entries = await readdir(fullPath, { withFileTypes: true });
        const results: FileEntry[] = [];

        for (const entry of entries) {
            try {
                const entryPath = join(fullPath, entry.name);
                const stats = await stat(entryPath);
                const relPath = relative(join(GAME_SERVERS_PATH, serverId), entryPath);

                results.push({
                    name: entry.name,
                    path: '/' + relPath.replace(/\\/g, '/'),
                    isDirectory: entry.isDirectory(),
                    size: stats.size,
                    modifiedAt: stats.mtime.toISOString(),
                });
            } catch {
                // Skip files we can't read
            }
        }

        // Sort: directories first, then files, alphabetically
        results.sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) {
                return a.isDirectory ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });

        return results;
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            throw new Error(`Directory not found: ${relativePath}`);
        }
        if (error.code === 'ENOTDIR') {
            throw new Error(`Not a directory: ${relativePath}`);
        }
        throw error;
    }
}

/**
 * Get file info and create a read stream for downloading
 */
export async function getFileForDownload(serverId: string, relativePath: string): Promise<{
    stream: ReturnType<typeof createReadStream>;
    filename: string;
    size: number;
    mimeType: string;
}> {
    // Validate server exists
    const servers = await discoverGameServers();
    if (!servers.find(s => s.id === serverId)) {
        throw new Error(`Unknown server: ${serverId}`);
    }

    const fullPath = validatePath(serverId, relativePath);

    const stats = await stat(fullPath);
    if (stats.isDirectory()) {
        throw new Error('Cannot download a directory');
    }

    const filename = basename(fullPath);
    const stream = createReadStream(fullPath);

    // Determine MIME type from extension
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
        'txt': 'text/plain',
        'log': 'text/plain',
        'json': 'application/json',
        'xml': 'application/xml',
        'yaml': 'text/yaml',
        'yml': 'text/yaml',
        'ini': 'text/plain',
        'cfg': 'text/plain',
        'conf': 'text/plain',
        'properties': 'text/plain',
        'sh': 'text/x-shellscript',
        'zip': 'application/zip',
        'tar': 'application/x-tar',
        'gz': 'application/gzip',
    };

    return {
        stream,
        filename,
        size: stats.size,
        mimeType: mimeTypes[ext] || 'application/octet-stream',
    };
}

/**
 * Upload a file to a game server directory
 */
export async function uploadFile(
    serverId: string,
    relativePath: string,
    filename: string,
    data: Readable | Buffer
): Promise<FileEntry> {
    // Validate server exists
    const servers = await discoverGameServers();
    if (!servers.find(s => s.id === serverId)) {
        throw new Error(`Unknown server: ${serverId}`);
    }

    // Sanitize filename
    const sanitizedFilename = basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    if (!sanitizedFilename) {
        throw new Error('Invalid filename');
    }

    const dirPath = validatePath(serverId, relativePath);
    const fullPath = join(dirPath, sanitizedFilename);

    // Ensure path is still within server directory after adding filename
    const serverPath = join(GAME_SERVERS_PATH, serverId);
    if (!fullPath.startsWith(serverPath)) {
        throw new Error('Invalid path: directory traversal not allowed');
    }

    // Write file
    if (Buffer.isBuffer(data)) {
        const writeStream = createWriteStream(fullPath);
        await new Promise<void>((resolve, reject) => {
            writeStream.write(data, (err) => {
                if (err) reject(err);
                else {
                    writeStream.end();
                    resolve();
                }
            });
        });
    } else {
        const writeStream = createWriteStream(fullPath);
        await pipeline(data, writeStream);
    }

    // Get file info
    const stats = await stat(fullPath);
    const relPath = relative(serverPath, fullPath);

    return {
        name: sanitizedFilename,
        path: '/' + relPath.replace(/\\/g, '/'),
        isDirectory: false,
        size: stats.size,
        modifiedAt: stats.mtime.toISOString(),
    };
}
