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
    type: 'player' | 'you';
}

export const ServerChat: React.FC<ServerChatProps> = ({ server, username }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [playerCount, setPlayerCount] = useState<{ count: number; max: number; players: string[] }>({ count: 0, max: 20, players: [] });
    const scrollRef = useRef<HTMLDivElement>(null);
    const sendMessageRef = useRef<((msg: string) => void) | null>(null);
    const messageIdCounter = useRef(0);

    useEffect(() => {
        const cleanup = api.connectChat(
            server.id,
            username,
            (chatMsg) => {
                // Incoming chat message from player
                const newMessage: ChatMessage = {
                    id: messageIdCounter.current++,
                    timestamp: chatMsg.timestamp,
                    playerName: chatMsg.playerName,
                    message: chatMsg.message,
                    type: 'player',
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
                setError(null);
            },
            (err) => {
                setError(err);
                setConnected(false);
            }
        );

        return cleanup;
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

        // Add your own message to the chat
        const newMessage: ChatMessage = {
            id: messageIdCounter.current++,
            timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            message: msg,
            type: 'you',
        };
        setMessages(prev => [...prev, newMessage]);

        // Send message via WebSocket
        sendMessageRef.current(msg);
        setInputMessage('');
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
                        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className="text-sm font-medium text-gray-300">
                            {connected ? 'Connected' : 'Disconnected'}
                        </span>
                    </div>
                    <div className="flex items-center space-x-2" title={playerCount.players.join(', ')}>
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className="text-sm text-gray-400">
                            Players Online: <span className="text-white font-medium">{playerCount.count}/{playerCount.max}</span>
                        </span>
                    </div>
                </div>
                {playerCount.players.length > 0 && (
                    <div className="mt-2 text-xs text-gray-500">
                        {playerCount.players.join(', ')}
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

                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex flex-col ${msg.type === 'you' ? 'items-end' : 'items-start'}`}
                    >
                        {/* Timestamp and player name */}
                        <div className="text-xs text-gray-500 mb-1 px-1">
                            {formatTime(msg.timestamp)}
                            {msg.playerName && (
                                <span className="ml-2 font-medium text-blue-400">{msg.playerName}</span>
                            )}
                            {msg.type === 'you' && (
                                <span className="ml-2 font-medium text-green-400">{username}</span>
                            )}
                        </div>

                        {/* Message bubble */}
                        <div
                            className={`max-w-[75%] px-4 py-2 rounded-lg ${msg.type === 'you'
                                    ? 'bg-green-600 text-white'
                                    : 'bg-gray-700 text-gray-100'
                                }`}
                        >
                            <p className="text-sm break-words whitespace-pre-wrap">{msg.message}</p>
                        </div>
                    </div>
                ))}
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
                </div>
            </form>
        </div>
    );
};
