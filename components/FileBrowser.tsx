import React, { useState, useEffect, useRef } from 'react';
import type { GameServer } from '../types';
import { api, type FileEntry } from '../services/api';
import { FolderIcon } from './icons/FolderIcon';
import { FileIcon } from './icons/FileIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { UploadIcon } from './icons/UploadIcon';

interface FileBrowserProps {
    server: GameServer;
    onClose: () => void;
}

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(isoString: string): string {
    return new Date(isoString).toLocaleString();
}

export const FileBrowser: React.FC<FileBrowserProps> = ({ server, onClose }) => {
    const [currentPath, setCurrentPath] = useState('/');
    const [files, setFiles] = useState<FileEntry[]>([]);
    const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadDirectory = async (path: string) => {
        setIsLoading(true);
        setError(null);
        setSelectedFile(null);
        try {
            const entries = await api.listServerFiles(server.id, path);
            setFiles(entries);
            setCurrentPath(path);
        } catch (err: any) {
            setError(err.message || 'Failed to load directory');
            setFiles([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadDirectory('/');
    }, [server.id]);

    const handleNavigate = (entry: FileEntry) => {
        if (entry.isDirectory) {
            loadDirectory(entry.path);
        } else {
            setSelectedFile(entry);
        }
    };

    const handleGoUp = () => {
        if (currentPath === '/') return;
        const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
        loadDirectory(parentPath);
    };

    const handleDownload = async () => {
        if (!selectedFile) return;
        try {
            await api.downloadServerFile(server.id, selectedFile.path, selectedFile.name);
        } catch (err: any) {
            setError(err.message || 'Failed to download file');
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadProgress(`Uploading ${file.name}...`);
        setError(null);

        try {
            await api.uploadServerFile(server.id, currentPath, file);
            setUploadProgress(null);
            // Refresh the directory
            await loadDirectory(currentPath);
        } catch (err: any) {
            setError(err.message || 'Failed to upload file');
            setUploadProgress(null);
        }

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const breadcrumbs = currentPath.split('/').filter(Boolean);

    return (
        <div className="flex flex-col h-[70vh]">
            {/* Header with path breadcrumbs */}
            <div className="flex items-center gap-2 mb-4 text-sm">
                <button
                    onClick={() => loadDirectory('/')}
                    className="text-indigo-400 hover:text-indigo-300"
                >
                    {server.name}
                </button>
                {breadcrumbs.map((part, index) => (
                    <React.Fragment key={index}>
                        <span className="text-gray-500">/</span>
                        <button
                            onClick={() => loadDirectory('/' + breadcrumbs.slice(0, index + 1).join('/'))}
                            className="text-indigo-400 hover:text-indigo-300"
                        >
                            {part}
                        </button>
                    </React.Fragment>
                ))}
            </div>

            {/* Error message */}
            {error && (
                <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-2 rounded mb-4">
                    {error}
                </div>
            )}

            {/* Upload progress */}
            {uploadProgress && (
                <div className="bg-indigo-500/20 border border-indigo-500 text-indigo-400 px-4 py-2 rounded mb-4 flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {uploadProgress}
                </div>
            )}

            {/* File list */}
            <div className="flex-1 bg-gray-900/50 rounded-lg overflow-hidden">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <svg className="animate-spin h-8 w-8 text-indigo-500" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                    </div>
                ) : (
                    <div className="overflow-auto h-full">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-800/50 sticky top-0">
                                <tr>
                                    <th className="text-left p-3 font-medium text-gray-400">Name</th>
                                    <th className="text-right p-3 font-medium text-gray-400 w-24">Size</th>
                                    <th className="text-right p-3 font-medium text-gray-400 w-44">Modified</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Go up entry */}
                                {currentPath !== '/' && (
                                    <tr
                                        onClick={handleGoUp}
                                        className="hover:bg-gray-800/50 cursor-pointer border-b border-gray-800"
                                    >
                                        <td className="p-3 flex items-center gap-2">
                                            <FolderIcon className="w-5 h-5 text-yellow-500" />
                                            <span className="text-gray-300">..</span>
                                        </td>
                                        <td className="p-3 text-right text-gray-500">—</td>
                                        <td className="p-3 text-right text-gray-500">—</td>
                                    </tr>
                                )}

                                {files.length === 0 && currentPath === '/' ? (
                                    <tr>
                                        <td colSpan={3} className="p-8 text-center text-gray-500">
                                            No files found in this directory
                                        </td>
                                    </tr>
                                ) : (
                                    files.map((entry) => (
                                        <tr
                                            key={entry.path}
                                            onClick={() => handleNavigate(entry)}
                                            className={`hover:bg-gray-800/50 cursor-pointer border-b border-gray-800 ${selectedFile?.path === entry.path ? 'bg-indigo-500/20' : ''
                                                }`}
                                        >
                                            <td className="p-3 flex items-center gap-2">
                                                {entry.isDirectory ? (
                                                    <FolderIcon className="w-5 h-5 text-yellow-500" />
                                                ) : (
                                                    <FileIcon className="w-5 h-5 text-gray-400" />
                                                )}
                                                <span className="text-gray-300">{entry.name}</span>
                                            </td>
                                            <td className="p-3 text-right text-gray-500">
                                                {entry.isDirectory ? '—' : formatFileSize(entry.size)}
                                            </td>
                                            <td className="p-3 text-right text-gray-500">
                                                {formatDate(entry.modifiedAt)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
                <div className="text-sm text-gray-400">
                    {selectedFile ? (
                        <span>Selected: {selectedFile.name}</span>
                    ) : (
                        <span>Current folder: {currentPath}</span>
                    )}
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md"
                    >
                        Close
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileSelect}
                        className="hidden"
                    />
                    <button
                        onClick={handleUploadClick}
                        disabled={!!uploadProgress}
                        className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-md flex items-center gap-2"
                    >
                        <UploadIcon className="w-4 h-4" />
                        Upload
                    </button>
                    <button
                        onClick={handleDownload}
                        disabled={!selectedFile}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-md flex items-center gap-2"
                    >
                        <DownloadIcon className="w-4 h-4" />
                        Download
                    </button>
                </div>
            </div>
        </div>
    );
};
