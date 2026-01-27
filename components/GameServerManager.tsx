
import React, { useState } from 'react';
import type { GameServer } from '../types';
import { GameServerStatus } from '../types';
import { api } from '../services/api';
import { Modal } from './Modal';
import { LogViewer } from './LogViewer';
import { FileBrowser } from './FileBrowser';
import { LogsIcon } from './icons/LogsIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { UploadIcon } from './icons/UploadIcon';

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
  const [viewingLogsFor, setViewingLogsFor] = useState<GameServer | null>(null);
  const [fileBrowserServer, setFileBrowserServer] = useState<GameServer | null>(null);
  const [fileBrowserMode, setFileBrowserMode] = useState<'download' | 'upload'>('download');

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

  return (
    <>
      <div className="bg-gray-800/50 rounded-lg shadow-lg p-6 backdrop-blur-sm h-full">
        <h2 className="text-xl font-semibold text-white mb-4">Game Servers</h2>
        <div className="space-y-3">
          {servers.map((server) => {
            const styles = statusStyles[server.status];
            const isLoading = loadingServer === server.id;

            return (
              <div key={server.id} className="bg-gray-900/70 p-4 rounded-lg flex items-center justify-between">
                <div>
                  <p className="font-bold text-white">{server.name}</p>
                  <div className="flex items-center mt-1">
                    <span className={`w-2 h-2 rounded-full mr-2 ${styles.dot}`}></span>
                    <p className={`text-sm ${styles.text}`}>{styles.label}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewingLogsFor(server)}
                    className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors"
                    aria-label={`View logs for ${server.name}`}
                    title="View Logs"
                  >
                    <LogsIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      setFileBrowserServer(server);
                      setFileBrowserMode('download');
                    }}
                    className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors"
                    aria-label={`Download files from ${server.name}`}
                    title="Download Files"
                  >
                    <DownloadIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      setFileBrowserServer(server);
                      setFileBrowserMode('upload');
                    }}
                    className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors"
                    aria-label={`Upload files to ${server.name}`}
                    title="Upload Files"
                  >
                    <UploadIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleToggle(server)}
                    disabled={isLoading}
                    className={`px-4 py-2 rounded-md font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-wait w-24 text-center
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
          title={`Logs for ${viewingLogsFor.name}`}
          size="3xl"
        >
          <LogViewer server={viewingLogsFor} />
        </Modal>
      )}

      {fileBrowserServer && (
        <Modal
          isOpen={!!fileBrowserServer}
          onClose={() => setFileBrowserServer(null)}
          title={`${fileBrowserMode === 'download' ? 'Download from' : 'Upload to'} ${fileBrowserServer.name}`}
          size="4xl"
        >
          <FileBrowser
            server={fileBrowserServer}
            mode={fileBrowserMode}
            onClose={() => setFileBrowserServer(null)}
          />
        </Modal>
      )}
    </>
  );
};
