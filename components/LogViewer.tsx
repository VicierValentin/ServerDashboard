
import React, { useState, useEffect, useRef } from 'react';
import type { GameServer } from '../types';
import { api } from '../services/api';
import { TrashIcon } from './icons/TrashIcon';

interface LogViewerProps {
    server: GameServer;
}

export const LogViewer: React.FC<LogViewerProps> = ({ server }) => {
    const [logs, setLogs] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [autoScroll, setAutoScroll] = useState(false);
    const logContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setIsLoading(true);
        setLogs([]);

        const loadingTimeout = setTimeout(() => {
            setIsLoading(false); // Prevent infinite loading state if no logs arrive
        }, 5000);

        const stopStreaming = api.streamLogs(server.id, (newLine) => {
            clearTimeout(loadingTimeout);
            setIsLoading(false);
            setLogs(prevLogs => [...prevLogs, newLine]);
        });

        // Cleanup function for when the component unmounts or server.id changes
        return () => {
            clearTimeout(loadingTimeout);
            stopStreaming();
        };
    }, [server.id]);

    useEffect(() => {
        // Auto-scroll to bottom when enabled and new logs are added
        if (autoScroll && logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs, autoScroll]);

    const handleClear = () => {
        setLogs([]);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="ml-3 text-gray-400">Connecting to log stream...</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[60vh]">
            <div className="flex justify-end gap-2 mb-2">
                <button
                    onClick={() => setAutoScroll(!autoScroll)}
                    className={`flex items-center px-3 py-1.5 rounded-md text-sm ${autoScroll
                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        }`}
                >
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    Auto-scroll
                </button>
                <button
                    onClick={handleClear}
                    className="flex items-center px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-md text-sm"
                >
                    <TrashIcon className="w-4 h-4 mr-1.5" />
                    Clear
                </button>
            </div>
            <div ref={logContainerRef} className="bg-black rounded-md p-4 flex-1 overflow-y-auto font-mono text-sm text-gray-300 selection:bg-indigo-500 selection:text-white">
                {logs.length > 0 ? (
                    logs.map((line, index) => (
                        <div key={index} className="whitespace-pre-wrap">{line}</div>
                    ))
                ) : (
                    <p className="text-gray-500">No log entries yet. Waiting for new entries...</p>
                )}
            </div>
        </div>
    );
};
