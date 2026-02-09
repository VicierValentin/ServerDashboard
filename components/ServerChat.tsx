import React, { useState, useEffect, useRef } from 'react';
import type { GameServer } from '../types';
import { api } from '../services/api';

interface ServerChatProps {
    server: GameServer;
    username: string;
}

interface ChatMessage {
    id: number;
    timestamp: string;
    playerName?: string;
    message: string;
    source: 'game' | 'dashboard' | 'system';
}

export const ServerChat: React.FC<ServerChatProps> = ({ server, username }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reconnecting, setReconnecting] = useState(false);
    const [playerCount, setPlayerCount] = useState<{ count: number; max: number; players: string[]; dashboardUsers: string[] }>({
        count: 0,
        max: 20,
        players: [],
        dashboardUsers: []
    });
    const scrollRef = useRef<HTMLDivElement>(null);
    const sendMessageRef = useRef<((msg: string) => void) | null>(null);
    const messageIdCounter = useRef(0);
    const cleanupRef = useRef<(() => void) | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectAttemptsRef = useRef(0);

    const connectToChat = () => {
        // Clear any existing connection
        if (cleanupRef.current) {
            cleanupRef.current();
            cleanupRef.current = null;
        }

        setReconnecting(true);
        const cleanup = api.connectChat(
            server.id,
            username,
            (chatMsg) => {
                // Incoming chat message from player, dashboard user, or system
                const newMessage: ChatMessage = {
                    id: messageIdCounter.current++,
                    timestamp: chatMsg.timestamp,
                    playerName: chatMsg.playerName,
                    message: chatMsg.message,
                    source: chatMsg.source,
                };
                setMessages(prev => [...prev.slice(-100), newMessage]); // Keep last 100 messages
            },
            (info) => {
                // Player count update
                setPlayerCount(info);
            },
            (sendFn) => {
                sendMessageRef.current = sendFn;
                setConnected(true);
                setReconnecting(false);
                setError(null);
                reconnectAttemptsRef.current = 0;
            },
            (err) => {
                setError(err);
                setConnected(false);
                setReconnecting(false);

                // Auto-reconnect on abnormal closure (code 1006) - common on mobile
                if (err.includes('1006') || err.includes('closed unexpectedly')) {
                    const attempts = reconnectAttemptsRef.current;
                    const delay = Math.min(1000 * Math.pow(2, attempts), 10000); // Exponential backoff, max 10s

                    console.log(`WebSocket closed abnormally, reconnecting in ${delay}ms (attempt ${attempts + 1})`);

                    reconnectTimeoutRef.current = setTimeout(() => {
                        reconnectAttemptsRef.current++;
                        connectToChat();
                    }, delay);
                }
            }
        );

        cleanupRef.current = cleanup;
    };

    useEffect(() => {
        connectToChat();

        // Handle page visibility changes (mobile screen lock, app switching)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && !connected) {
                console.log('Page became visible, attempting reconnection');
                connectToChat();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            if (cleanupRef.current) {
                cleanupRef.current();
            }
        };
    }, [server.id, username]);

    useEffect(() => {
        // Auto-scroll to bottom when new messages arrive
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputMessage.trim() || !sendMessageRef.current) return;

        const msg = inputMessage.trim();

        // Send message via WebSocket (it will be broadcast back to all users)
        sendMessageRef.current(msg);
        setInputMessage('');
    };

    const handleManualReconnect = () => {
        reconnectAttemptsRef.current = 0;
        setError(null);
        connectToChat();
    };

    const formatTime = (timestamp: string) => {
        // timestamp is already in HH:MM:SS format from server
        return timestamp;
    };

    return (
        <div className="flex flex-col h-[600px]">
            {/* Header with player count */}
            <div className="bg-gray-900 px-4 py-3 rounded-t-lg border-b border-gray-700">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : reconnecting ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                        <span className="text-sm font-medium text-gray-300">
                            {connected ? 'Connected' : reconnecting ? 'Reconnecting...' : 'Disconnected'}
                        </span>
                        {!connected && !reconnecting && (
                            <button
                                onClick={handleManualReconnect}
                                className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded transition-colors"
                            >
                                Reconnect
                            </button>
                        )}
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className="text-sm text-gray-400">
                            User In Chat: <span className="text-white font-medium">{playerCount.count}/{playerCount.max}</span>
                        </span>
                    </div>
                </div>
                {(playerCount.players.length > 0 || playerCount.dashboardUsers.length > 0) && (
                    <div className="mt-2 text-xs space-y-1">
                        {playerCount.players.length > 0 && (
                            <div className="text-green-400">
                                In-game: {playerCount.players.join(', ')}
                            </div>
                        )}
                        {playerCount.dashboardUsers.length > 0 && (
                            <div className="text-blue-400">
                                Dashboard: {playerCount.dashboardUsers.join(', ')}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Error message */}
            {error && (
                <div className="bg-red-900/50 px-4 py-2 text-sm text-red-200">
                    {error}
                </div>
            )}

            {/* Chat messages */}
            <div
                ref={scrollRef}
                className="flex-1 bg-gray-800 p-4 overflow-y-auto space-y-3"
            >
                {messages.length === 0 && (
                    <div className="text-center text-gray-500 text-sm mt-8">
                        No messages yet. Start chatting with players!
                    </div>
                )}

                {messages.map((msg) => {
                    // System messages (join/leave notifications and command results)
                    if (msg.source === 'system') {
                        // Check if it's a command result (contains "Command:" prefix)
                        const isCommandResult = msg.message.startsWith('Command: ');

                        if (isCommandResult) {
                            // Command result - show in a larger, code-style box
                            return (
                                <div key={msg.id} className="my-3">
                                    <div className="text-xs text-yellow-400 mb-1 px-1">
                                        {formatTime(msg.timestamp)} • {msg.playerName} (Command)
                                    </div>
                                    <div className="bg-gray-900 border border-yellow-600/30 rounded-lg p-3">
                                        <pre className="text-xs text-yellow-200 whitespace-pre-wrap font-mono overflow-x-auto">
                                            {msg.message}
                                        </pre>
                                    </div>
                                </div>
                            );
                        } else {
                            // Regular system message (join/leave)
                            return (
                                <div key={msg.id} className="flex justify-center my-2">
                                    <div className="text-xs text-gray-500 italic px-3 py-1 bg-gray-900/50 rounded-full">
                                        {msg.message}
                                    </div>
                                </div>
                            );
                        }
                    }

                    // Regular chat messages
                    const isFromMe = msg.playerName === username;
                    const isDashboard = msg.source === 'dashboard';

                    return (
                        <div
                            key={msg.id}
                            className={`flex flex-col ${isFromMe ? 'items-end' : 'items-start'}`}
                        >
                            {/* Timestamp and player name */}
                            <div className="text-xs text-gray-500 mb-1 px-1">
                                {formatTime(msg.timestamp)}
                                <span className={`ml-2 font-medium ${isDashboard ? 'text-blue-400' : 'text-green-400'}`}>
                                    {msg.playerName}
                                </span>
                                {isDashboard && (
                                    <span className="ml-1 text-gray-600">(Dashboard)</span>
                                )}
                            </div>

                            {/* Message bubble */}
                            <div
                                className={`max-w-[75%] px-4 py-2 rounded-lg ${isFromMe
                                    ? 'bg-blue-600 text-white'
                                    : isDashboard
                                        ? 'bg-indigo-700 text-gray-100'
                                        : 'bg-gray-700 text-gray-100'
                                    }`}
                            >
                                <p className="text-sm break-words whitespace-pre-wrap">{msg.message}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Input area */}
            <form onSubmit={handleSubmit} className="bg-gray-900 p-4 rounded-b-lg">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        placeholder={connected ? "Type a message..." : "Connecting..."}
                        disabled={!connected}
                        className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        maxLength={256}
                    />
                    <button
                        type="submit"
                        disabled={!connected || !inputMessage.trim()}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
                    >
                        Send
                    </button>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                    Sending as <span className="text-white font-medium">{username}</span>
                    <span className="ml-3 text-yellow-400">Tip: Start with "/" to send RCON commands</span>
                </div>
            </form>
        </div>
    );
};
