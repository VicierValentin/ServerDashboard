
import React, { useState, useEffect } from 'react';
import type { GameServer } from '../types';
import { GameServerStatus } from '../types';
import { api } from '../services/api';
import { Modal } from './Modal';
import { FileBrowser } from './FileBrowser';
import { ServerLogsConsole } from './ServerLogsConsole';
import { ServerChat } from './ServerChat';
import { UsernamePrompt } from './UsernamePrompt';
import { LogsIcon } from './icons/LogsIcon';
import { FolderIcon } from './icons/FolderIcon';
import { PowerIcon } from './icons/PowerIcon';
import { TerminalIcon } from './icons/TerminalIcon';
import { ChatIcon } from './icons/ChatIcon';

// Check if a server is a Minecraft server
const isMinecraftServer = (server: GameServer): boolean => {
  return server.name.toLowerCase().includes('minecraft') || server.id.toLowerCase().includes('minecraft');
};

interface GameServerManagerProps {
  servers: GameServer[];
  setServers: React.Dispatch<React.SetStateAction<GameServer[]>>;
}

const statusStyles = {
  [GameServerStatus.RUNNING]: {
    dot: 'bg-green-500',
    text: 'text-green-400',
    label: 'Running',
  },
  [GameServerStatus.STOPPED]: {
    dot: 'bg-gray-500',
    text: 'text-gray-400',
    label: 'Stopped',
  },
  [GameServerStatus.CRASHED]: {
    dot: 'bg-red-500',
    text: 'text-red-400',
    label: 'Crashed',
  },
};

export const GameServerManager: React.FC<GameServerManagerProps> = ({ servers, setServers }) => {
  const [loadingServer, setLoadingServer] = useState<string | null>(null);
  const [enablingServer, setEnablingServer] = useState<string | null>(null);
  const [viewingLogsFor, setViewingLogsFor] = useState<GameServer | null>(null);
  const [fileBrowserServer, setFileBrowserServer] = useState<GameServer | null>(null);
  const [chatServer, setChatServer] = useState<GameServer | null>(null);
  const [chatUsername, setChatUsername] = useState<string | null>(null);
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);
  const [pendingChatServer, setPendingChatServer] = useState<GameServer | null>(null);

  // Fetch player info for running Minecraft servers
  useEffect(() => {
    const fetchPlayerInfo = async () => {
      const updatedServers = await Promise.all(
        servers.map(async (server) => {
          if (isMinecraftServer(server) && server.status === GameServerStatus.RUNNING) {
            try {
              const playerInfo = await api.getServerPlayers(server.id);
              return { ...server, playerInfo };
            } catch (error) {
              // Silently fail - server might not be accessible
              return server;
            }
          }
          return server;
        })
      );
      setServers(updatedServers);
    };

    // Only fetch if there are running Minecraft servers
    const hasRunningMinecraft = servers.some(
      s => isMinecraftServer(s) && s.status === GameServerStatus.RUNNING
    );
    if (hasRunningMinecraft) {
      fetchPlayerInfo();
      const interval = setInterval(fetchPlayerInfo, 30000); // Update every 30 seconds
      return () => clearInterval(interval);
    }
  }, [servers.map(s => `${s.id}-${s.status}`).join(',')]); // Re-run when server statuses change

  const handleToggle = async (server: GameServer) => {
    setLoadingServer(server.id);
    const action = server.status === GameServerStatus.RUNNING ? 'stop' : 'start';
    try {
      const updatedServers = await api.toggleGameServer(server.id, action);
      setServers(updatedServers);
    } catch (error) {
      alert(`Failed to ${action} ${server.name}.`);
      console.error(error);
    } finally {
      setLoadingServer(null);
    }
  };

  const handleToggleEnabled = async (server: GameServer) => {
    setEnablingServer(server.id);
    const action = server.enabled ? 'disable' : 'enable';
    try {
      const updatedServers = await api.toggleGameServerEnabled(server.id, action);
      setServers(updatedServers);
    } catch (error) {
      alert(`Failed to ${action} ${server.name}.`);
      console.error(error);
    } finally {
      setEnablingServer(null);
    }
  };

  const handleOpenChat = (server: GameServer) => {
    // Check if username is saved in localStorage
    const savedUsername = localStorage.getItem('chatUsername');
    if (savedUsername) {
      setChatUsername(savedUsername);
      setChatServer(server);
    } else {
      setPendingChatServer(server);
      setShowUsernamePrompt(true);
    }
  };

  const handleUsernameSubmit = (username: string, remember: boolean) => {
    if (remember) {
      localStorage.setItem('chatUsername', username);
    }
    setChatUsername(username);
    setChatServer(pendingChatServer);
    setPendingChatServer(null);
    setShowUsernamePrompt(false);
  };

  const handleUsernameCancel = () => {
    setPendingChatServer(null);
    setShowUsernamePrompt(false);
  };

  return (
    <>
      <div className="bg-gray-800/50 rounded-lg shadow-lg p-6 backdrop-blur-sm h-full">
        <h2 className="text-xl font-semibold text-white mb-4">Game Servers</h2>
        <div className="space-y-3">
          {servers.map((server) => {
            const styles = statusStyles[server.status];
            const isLoading = loadingServer === server.id;

            return (
              <div key={server.id} className="bg-gray-900/70 p-4 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-white">{server.name}</p>
                    {server.enabled ? (
                      <span className="text-xs bg-blue-600/50 text-blue-200 px-1.5 py-0.5 rounded">Enabled</span>
                    ) : (
                      <span className="text-xs bg-gray-600/50 text-gray-300 px-1.5 py-0.5 rounded">Disabled</span>
                    )}
                  </div>
                  <div className="flex items-center mt-1">
                    <span className={`w-2 h-2 rounded-full mr-2 ${styles.dot}`}></span>
                    <p className={`text-sm ${styles.text}`}>{styles.label}</p>
                  </div>
                  {isMinecraftServer(server) && server.status === GameServerStatus.RUNNING && server.playerInfo && (
                    <div className="mt-2 text-xs text-gray-400">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                        <span className="text-green-400 font-medium">{server.playerInfo.count}/{server.playerInfo.max}</span>
                        <span>players online</span>
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleToggleEnabled(server)}
                    disabled={enablingServer === server.id}
                    className={`p-2 rounded-md transition-colors disabled:opacity-50 ${server.enabled
                      ? 'bg-blue-700 hover:bg-blue-600 text-blue-200'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white'}`}
                    aria-label={server.enabled ? `Disable ${server.name} at boot` : `Enable ${server.name} at boot`}
                    title={server.enabled ? 'Disable at boot' : 'Enable at boot'}
                  >
                    <PowerIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setViewingLogsFor(server)}
                    className={`p-2 rounded-md transition-colors ${isMinecraftServer(server) && server.status === GameServerStatus.RUNNING
                      ? 'bg-green-700 hover:bg-green-600 text-green-200 hover:text-white'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white'
                      }`}
                    aria-label={`View logs${isMinecraftServer(server) ? ' and console' : ''} for ${server.name}`}
                    title={isMinecraftServer(server) ? 'Logs & Console' : 'View Logs'}
                  >
                    {isMinecraftServer(server) ? <TerminalIcon className="w-5 h-5" /> : <LogsIcon className="w-5 h-5" />}
                  </button>
                  {isMinecraftServer(server) && server.status === GameServerStatus.RUNNING && (
                    <button
                      onClick={() => handleOpenChat(server)}
                      className="p-2 rounded-md bg-blue-700 hover:bg-blue-600 text-blue-200 hover:text-white transition-colors"
                      aria-label={`Open chat for ${server.name}`}
                      title="In-Game Chat"
                    >
                      <ChatIcon className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    onClick={() => setFileBrowserServer(server)}
                    className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors"
                    aria-label={`Browse files for ${server.name}`}
                    title="Browse Files"
                  >
                    <FolderIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleToggle(server)}
                    disabled={isLoading}
                    className={`px-4 py-2 rounded-md font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-wait w-full sm:w-24 text-center
                      ${server.status === GameServerStatus.RUNNING
                        ? 'bg-yellow-600 hover:bg-yellow-500'
                        : 'bg-green-600 hover:bg-green-500'}`}
                  >
                    {isLoading ? 'Processing...' : (server.status === GameServerStatus.RUNNING ? 'Stop' : 'Start')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {viewingLogsFor && (
        <Modal
          isOpen={!!viewingLogsFor}
          onClose={() => setViewingLogsFor(null)}
          title={isMinecraftServer(viewingLogsFor) ? `Logs & Console for ${viewingLogsFor.name}` : `Logs for ${viewingLogsFor.name}`}
          size="4xl"
        >
          <ServerLogsConsole server={viewingLogsFor} showConsole={isMinecraftServer(viewingLogsFor)} />
        </Modal>
      )}

      {fileBrowserServer && (
        <Modal
          isOpen={!!fileBrowserServer}
          onClose={() => setFileBrowserServer(null)}
          title={`Files - ${fileBrowserServer.name}`}
          size="4xl"
        >
          <FileBrowser
            server={fileBrowserServer}
            onClose={() => setFileBrowserServer(null)}
          />
        </Modal>
      )}

      <UsernamePrompt
        isOpen={showUsernamePrompt}
        onSubmit={handleUsernameSubmit}
        onCancel={handleUsernameCancel}
      />

      {chatServer && chatUsername && (
        <Modal
          isOpen={!!chatServer && !!chatUsername}
          onClose={() => {
            setChatServer(null);
            setChatUsername(null);
          }}
          title={`Chat - ${chatServer.name}`}
          size="4xl"
        >
          <ServerChat
            server={chatServer}
            username={chatUsername}
            onReload={() => {
              // Close and reopen the chat to force a fresh connection
              const server = chatServer;
              const username = chatUsername;
              setChatServer(null);
              setChatUsername(null);
              // Reopen after a brief delay to ensure cleanup
              setTimeout(() => {
                setChatServer(server);
                setChatUsername(username);
              }, 100);
            }}
          />
        </Modal>
      )}
    </>
  );
};
