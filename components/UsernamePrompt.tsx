import React, { useState, useEffect } from 'react';

interface UsernamePromptProps {
    isOpen: boolean;
    onSubmit: (username: string, remember: boolean) => void;
    onCancel: () => void;
}

export const UsernamePrompt: React.FC<UsernamePromptProps> = ({ isOpen, onSubmit, onCancel }) => {
    const [username, setUsername] = useState('');
    const [remember, setRemember] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        // Load saved username from localStorage if available
        if (isOpen) {
            const saved = localStorage.getItem('chatUsername');
            if (saved) {
                setUsername(saved);
            }
        }
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validate username
        const trimmed = username.trim();
        if (!trimmed) {
            setError('Username cannot be empty');
            return;
        }

        if (trimmed.length > 16) {
            setError('Username must be 16 characters or less');
            return;
        }

        // Only allow alphanumeric and underscore
        if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
            setError('Username can only contain letters, numbers, and underscores');
            return;
        }

        onSubmit(trimmed, remember);
        setError('');
        setUsername('');
    };

    const handleCancel = () => {
        setError('');
        setUsername('');
        onCancel();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75" aria-modal="true" role="dialog">
            <div className="fixed inset-0" onClick={handleCancel} aria-hidden="true"></div>
            <div className="relative bg-gray-800 rounded-lg shadow-xl w-full mx-4 p-6 text-white max-w-md">
                <h3 className="text-lg font-medium leading-6 mb-4">Enter Your Username</h3>
                <p className="text-sm text-gray-400 mb-4">
                    Choose a username to use when chatting with players in-game.
                </p>

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => {
                                setUsername(e.target.value);
                                setError('');
                            }}
                            placeholder="Username"
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                            maxLength={16}
                        />
                        {error && (
                            <p className="mt-2 text-sm text-red-400">{error}</p>
                        )}
                    </div>

                    <div className="mb-4">
                        <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={remember}
                                onChange={(e) => setRemember(e.target.checked)}
                                className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-300">Remember my username</span>
                        </label>
                    </div>

                    <div className="flex space-x-3">
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                        >
                            Continue
                        </button>
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
