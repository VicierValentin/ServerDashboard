
import React, { useState, useEffect, useRef } from 'react';
import type { GameServer } from '../types';
import { api } from '../services/api';

interface LogViewerProps {
    server: GameServer;
}

export const LogViewer: React.FC<LogViewerProps> = ({ server }) => {
    const [logs, setLogs] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const logContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setIsLoading(true);
        setLogs([]);

        const loadingTimeout = setTimeout(() => {
            setIsLoading(false); // Prevent infinite loading state if no logs arrive
        }, 5000);

        const stopStreaming = api.streamLogs(server.id, (newLine) => {
            clearTimeout(loadingTimeout);
            if (isLoading) {
                setIsLoading(false);
            }
            setLogs(prevLogs => [...prevLogs, newLine]);
        });

        // Cleanup function for when the component unmounts or server.id changes
        return () => {
            clearTimeout(loadingTimeout);
            stopStreaming();
        };
    }, [server.id, isLoading]);

    useEffect(() => {
        // Auto-scroll to bottom when new logs are added
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs]);

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
        <div ref={logContainerRef} className="bg-black rounded-md p-4 h-[60vh] overflow-y-auto font-mono text-sm text-gray-300 selection:bg-indigo-500 selection:text-white">
            {logs.length > 0 ? (
                logs.map((line, index) => (
                    <div key={index} className="whitespace-pre-wrap">{line}</div>
                ))
            ) : (
                <p className="text-gray-500">No log entries yet. Waiting for new entries...</p>
            )}
        </div>
    );
};
