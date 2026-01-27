
import React, { useState, useEffect, useCallback } from 'react';
import { PowerControls } from './components/PowerControls';
import { GameServerManager } from './components/GameServerManager';
import { TimerManager } from './components/TimerManager';
import { SystemMonitor } from './components/SystemMonitor';
import type { SystemStats, GameServer, SystemdTimer } from './types';
import { api } from './services/api';

const App: React.FC = () => {
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);
  const [gameServers, setGameServers] = useState<GameServer[]>([]);
  const [timers, setTimers] = useState<SystemdTimer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [stats, servers, currentTimers] = await Promise.all([
        api.getSystemStats(),
        api.getGameServers(),
        api.getShutdownTimers(),
      ]);
      setSystemStats(stats);
      setGameServers(servers);
      setTimers(currentTimers);
    } catch (err) {
      setError('Failed to fetch initial data. Is the backend running?');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      const stats = await api.getSystemStats();
      setSystemStats(stats);
    } catch (err) {
      console.error("Failed to refresh system stats", err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(refreshStats, 3000); // Refresh stats every 3 seconds
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-4 text-lg">Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-red-400">
        <div className="text-center p-8 bg-gray-800 rounded-lg shadow-xl">
          <h2 className="text-2xl font-bold mb-4">Connection Error</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">Server Dashboard</h1>
          <p className="text-gray-400">Manage le serveur comme Ad avec ses sous-fifres.</p>
        </header>

        <main className="space-y-8">
          <SystemMonitor stats={systemStats} />
          <PowerControls />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <GameServerManager servers={gameServers} setServers={setGameServers} />
            <TimerManager timers={timers} setTimers={setTimers} />
          </div>
        </main>

        <footer className="text-center text-gray-500 mt-12">
          <p>Ubuntu Server Dashboard v1.0</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
