import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { GameServer } from '../types';
import { GameServerStatus } from '../types';
import { api } from '../services/api';
import { TrashIcon } from './icons/TrashIcon';

interface ServerLogsConsoleProps {
    server: GameServer;
    showConsole: boolean; // Whether to show the RCON console (for Minecraft servers)
}

export const ServerLogsConsole: React.FC<ServerLogsConsoleProps> = ({ server, showConsole }) => {
    // Logs state
    const [logs, setLogs] = useState<string[]>([]);
    const [logsLoading, setLogsLoading] = useState(true);
    const [logsError, setLogsError] = useState<string | null>(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const logContainerRef = useRef<HTMLDivElement>(null);

    // Console state
    const [consoleLines, setConsoleLines] = useState<string[]>([]);
    const [command, setCommand] = useState('');
    const [connected, setConnected] = useState(false);
    const [consoleError, setConsoleError] = useState<string | null>(null);
    const [commandHistory, setCommandHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const consoleRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const sendCommandRef = useRef<((cmd: string) => void) | null>(null);

    const isRunning = server.status === GameServerStatus.RUNNING;

    // Stream logs
    useEffect(() => {
        setLogsLoading(true);
        setLogs([]);
        setLogsError(null);

        const loadingTimeout = setTimeout(() => {
            setLogsLoading(false);
        }, 5000);

        const stopStreaming = api.streamLogs(
            server.id,
            (newLine) => {
                clearTimeout(loadingTimeout);
                setLogsLoading(false);
                setLogsError(null);
                setLogs(prevLogs => [...prevLogs.slice(-1000), newLine]);
            },
            (errorMsg) => {
                clearTimeout(loadingTimeout);
                setLogsLoading(false);
                setLogsError(errorMsg);
            }
        );

        return () => {
            clearTimeout(loadingTimeout);
            stopStreaming();
        };
    }, [server.id]);

    // Connect to RCON console (only for Minecraft servers when running)
    useEffect(() => {
        if (!showConsole || !isRunning) {
            setConsoleLines([]);
            setConnected(false);
            sendCommandRef.current = null;
            return;
        }

        setConsoleLines([`Connecting to ${server.name} console via RCON...`]);

        const cleanup = api.connectConsole(
            server.id,
            (line) => {
                setConsoleLines(prev => [...prev.slice(-500), line]);
            },
            (sendFn) => {
                sendCommandRef.current = sendFn;
                setConnected(true);
                setConsoleError(null);
                setConsoleLines(prev => [...prev, '✓ Connected to server console. Type commands below.']);
            },
            (err) => {
                setConsoleError(err);
                setConnected(false);
                setConsoleLines(prev => [...prev, `✗ Error: ${err}`]);
            }
        );

        return cleanup;
    }, [server.id, server.name, showConsole, isRunning]);

    // Auto-scroll logs
    useEffect(() => {
        if (autoScroll && logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs, autoScroll]);

    // Auto-scroll console
    useEffect(() => {
        if (consoleRef.current) {
            consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
        }
    }, [consoleLines]);

    const handleClearLogs = () => {
        setLogs([]);
    };

    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        if (!command.trim() || !sendCommandRef.current) return;

        const cmd = command.trim();
        setConsoleLines(prev => [...prev, `> ${cmd}`]);
        sendCommandRef.current(cmd);
        setCommandHistory(prev => [...prev, cmd]);
        setHistoryIndex(-1);
        setCommand('');
    }, [command]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (commandHistory.length > 0) {
                const newIndex = historyIndex === -1
                    ? commandHistory.length - 1
                    : Math.max(0, historyIndex - 1);
                setHistoryIndex(newIndex);
                setCommand(commandHistory[newIndex]);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex !== -1) {
                const newIndex = historyIndex + 1;
                if (newIndex >= commandHistory.length) {
                    setHistoryIndex(-1);
                    setCommand('');
                } else {
                    setHistoryIndex(newIndex);
                    setCommand(commandHistory[newIndex]);
                }
            }
        }
    }, [commandHistory, historyIndex]);

    return (
        <div className={`flex flex-col ${showConsole ? 'h-[70vh]' : 'h-[60vh]'}`}>
            {/* Logs Section */}
            <div className={`flex flex-col ${showConsole ? 'h-1/2' : 'flex-1'}`}>
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-medium text-gray-400">Server Logs</h3>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setAutoScroll(!autoScroll)}
                            className={`flex items-center px-2 py-1 rounded text-xs ${autoScroll
                                ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                }`}
                        >
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                            Auto-scroll
                        </button>
                        <button
                            onClick={handleClearLogs}
                            className="flex items-center px-2 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-300"
                        >
                            <TrashIcon className="w-3 h-3 mr-1" />
                            Clear
                        </button>
                    </div>
                </div>

                {logsLoading ? (
                    <div className="flex-1 flex items-center justify-center bg-gray-900 rounded-lg">
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="ml-2 text-gray-400 text-sm">Connecting to log stream...</span>
                    </div>
                ) : logsError ? (
                    <div className="flex-1 flex items-center justify-center bg-gray-900 rounded-lg">
                        <p className="text-red-400 text-sm">{logsError}</p>
                    </div>
                ) : (
                    <div
                        ref={logContainerRef}
                        className="flex-1 bg-gray-900 rounded-lg p-3 font-mono text-xs text-gray-300 overflow-y-auto"
                    >
                        {logs.length === 0 ? (
                            <p className="text-gray-500 italic">Waiting for logs...</p>
                        ) : (
                            logs.map((line, idx) => (
                                <div key={idx} className="whitespace-pre-wrap break-all hover:bg-gray-800/50">
                                    {line}
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Console Section (only for Minecraft servers) */}
            {showConsole && (
                <div className="flex flex-col h-1/2 mt-3">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-sm font-medium text-gray-400">
                            RCON Console
                            {!isRunning && (
                                <span className="ml-2 text-yellow-500 text-xs">(Server not running)</span>
                            )}
                        </h3>
                        {connected && (
                            <span className="text-green-400 text-xs flex items-center">
                                <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
                                Connected
                            </span>
                        )}
                    </div>

                    {!isRunning ? (
                        <div className="flex-1 flex items-center justify-center bg-black rounded-lg">
                            <p className="text-gray-500 text-sm">Start the server to use the RCON console</p>
                        </div>
                    ) : (
                        <>
                            <div
                                ref={consoleRef}
                                className="flex-1 bg-black rounded-t-lg p-3 font-mono text-xs text-green-400 overflow-y-auto"
                            >
                                {consoleLines.map((line, idx) => (
                                    <div key={idx} className="whitespace-pre-wrap break-all">
                                        {line}
                                    </div>
                                ))}
                            </div>

                            <form onSubmit={handleSubmit} className="flex gap-2 bg-gray-900 p-2 rounded-b-lg">
                                <span className="text-green-400 font-mono self-center text-sm">&gt;</span>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={command}
                                    onChange={(e) => setCommand(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    disabled={!connected}
                                    placeholder={connected ? "Enter command..." : "Connecting..."}
                                    className="flex-1 bg-gray-800 text-white font-mono text-sm px-2 py-1.5 rounded border border-gray-700 focus:border-green-500 focus:outline-none disabled:opacity-50"
                                />
                                <button
                                    type="submit"
                                    disabled={!connected || !command.trim()}
                                    className="px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-semibold rounded transition-colors"
                                >
                                    Send
                                </button>
                            </form>
                        </>
                    )}

                    {consoleError && (
                        <p className="mt-1 text-red-400 text-xs">{consoleError}</p>
                    )}
                </div>
            )}
        </div>
    );
};
