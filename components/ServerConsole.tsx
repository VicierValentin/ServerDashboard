import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { GameServer } from '../types';
import { api } from '../services/api';

interface ServerConsoleProps {
    server: GameServer;
}

export const ServerConsole: React.FC<ServerConsoleProps> = ({ server }) => {
    const [lines, setLines] = useState<string[]>([]);
    const [command, setCommand] = useState('');
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [commandHistory, setCommandHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const sendCommandRef = useRef<((cmd: string) => void) | null>(null);

    useEffect(() => {
        setLines([`Connecting to ${server.name} console via RCON...`]);

        const cleanup = api.connectConsole(
            server.id,
            (line) => {
                setLines(prev => [...prev.slice(-500), line]); // Keep last 500 lines
            },
            (sendFn) => {
                sendCommandRef.current = sendFn;
                setConnected(true);
                setError(null);
                setLines(prev => [...prev, '✓ Connected to server console. Type commands below.']);
            },
            (err) => {
                setError(err);
                setConnected(false);
                setLines(prev => [...prev, `✗ Error: ${err}`]);
            }
        );

        return cleanup;
    }, [server.id, server.name]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [lines]);

    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        if (!command.trim() || !sendCommandRef.current) return;

        const cmd = command.trim();
        setLines(prev => [...prev, `> ${cmd}`]);
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
        <div className="flex flex-col h-[500px]">
            <div
                ref={scrollRef}
                className="flex-1 bg-black rounded-t-lg p-4 font-mono text-sm text-green-400 overflow-y-auto"
            >
                {lines.map((line, idx) => (
                    <div key={idx} className="whitespace-pre-wrap break-all">
                        {line}
                    </div>
                ))}
            </div>

            <form onSubmit={handleSubmit} className="flex gap-2 bg-gray-900 p-3 rounded-b-lg">
                <span className="text-green-400 font-mono self-center">&gt;</span>
                <input
                    ref={inputRef}
                    type="text"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={!connected}
                    placeholder={connected ? "Enter command..." : "Connecting..."}
                    className="flex-1 bg-gray-800 text-white font-mono px-3 py-2 rounded border border-gray-700 focus:border-green-500 focus:outline-none disabled:opacity-50"
                    autoFocus
                />
                <button
                    type="submit"
                    disabled={!connected || !command.trim()}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded transition-colors"
                >
                    Send
                </button>
            </form>

            {error && (
                <div className="mt-2 text-red-400 text-sm">
                    Connection error: {error}
                </div>
            )}
        </div>
    );
};
