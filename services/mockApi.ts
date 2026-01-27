
import type { SystemStats, GameServer, SystemdTimer } from '../types';
import { GameServerStatus } from '../types';

// --- MOCK DATABASE ---
// This data simulates what would be stored and managed by your backend.
let mockGameServers: GameServer[] = [
  { id: 'palworld', name: 'Palworld', status: GameServerStatus.RUNNING },
  { id: 'minecraft', name: 'Minecraft', status: GameServerStatus.STOPPED },
  { id: 'valheim', name: 'Valheim', status: GameServerStatus.CRASHED },
];

let mockTimers: SystemdTimer[] = [
  { 
    id: 'shutdown-daily', 
    name: 'Daily Shutdown', 
    onCalendar: '*-*-* 02:00:00', 
    nextElapse: new Date(Date.now() + 1000 * 60 * 60 * 8).toISOString(),
    lastTriggered: new Date(Date.now() - 1000 * 60 * 60 * 16).toISOString(),
    active: true 
  },
  { 
    id: 'shutdown-weekend', 
    name: 'Weekend Late Shutdown', 
    onCalendar: 'Sat,Sun *-*-* 04:00:00', 
    nextElapse: new Date(Date.now() + 1000 * 60 * 60 * 36).toISOString(),
    lastTriggered: null,
    active: true 
  },
];
// --- END MOCK DATABASE ---

// Simulates network delay
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));


const getSystemStats = async (): Promise<SystemStats> => {
  await delay(300);
  // In a real app, this would execute commands like `top`, `free`, `df`, `iftop` on the server.
  const ramUsed = (Math.random() * 10 + 4).toFixed(2);
  const diskUsed = (Math.random() * 100 + 350).toFixed(2);
  
  return {
    cpu: { usage: parseFloat((Math.random() * 30 + 5).toFixed(2)) },
    ram: { 
        used: parseFloat(ramUsed), 
        total: 16, 
        usage: parseFloat(((parseFloat(ramUsed) / 16) * 100).toFixed(2))
    },
    disk: { 
        used: parseFloat(diskUsed), 
        total: 1024, 
        usage: parseFloat(((parseFloat(diskUsed) / 1024) * 100).toFixed(2))
    },
    network: {
      upload: parseFloat((Math.random() * 20).toFixed(2)),
      download: parseFloat((Math.random() * 150).toFixed(2)),
    },
  };
};

const getGameServers = async (): Promise<GameServer[]> => {
  await delay(500);
  // In a real app, this would check `systemctl status <service_name>` for each game server.
  return [...mockGameServers];
};

const getShutdownTimers = async (): Promise<SystemdTimer[]> => {
    await delay(600);
    // In a real app, this would parse `systemctl list-timers`.
    return [...mockTimers];
}

const performPowerAction = async (action: 'shutdown' | 'restart'): Promise<void> => {
    console.log(`Simulating: ${action.toUpperCase()} command sent to backend.`);
    await delay(1500);
    // In a real app, this would be an API call that executes `sudo shutdown -h now` or `sudo reboot`.
    alert(`Server would ${action} now.`);
}

const toggleGameServer = async (id: string, action: 'start' | 'stop'): Promise<GameServer[]> => {
    console.log(`Simulating: ${action.toUpperCase()} command for server ${id}`);
    await delay(1000);
    mockGameServers = mockGameServers.map(s => {
        if (s.id === id) {
            return { ...s, status: action === 'start' ? GameServerStatus.RUNNING : GameServerStatus.STOPPED };
        }
        return s;
    });
    return [...mockGameServers];
}

const addOrUpdateTimer = async (timer: Omit<SystemdTimer, 'id' | 'nextElapse' | 'lastTriggered'> & { id?: string }): Promise<SystemdTimer[]> => {
    console.log(`Simulating: Adding/Updating timer`, timer);
    await delay(800);
    if(timer.id) { // Update
        mockTimers = mockTimers.map(t => t.id === timer.id ? { ...t, ...timer, id: t.id, nextElapse: new Date().toISOString(), lastTriggered: t.lastTriggered } : t)
    } else { // Add
        const newTimer: SystemdTimer = {
            ...timer,
            id: `custom-timer-${Math.random().toString(36).substring(7)}`,
            nextElapse: new Date().toISOString(),
            lastTriggered: null,
        }
        mockTimers.push(newTimer);
    }
    return [...mockTimers];
}

const removeTimer = async (id: string): Promise<SystemdTimer[]> => {
    console.log(`Simulating: Removing timer ${id}`);
    await delay(500);
    mockTimers = mockTimers.filter(t => t.id !== id);
    return [...mockTimers];
}

const skipTimer = async(id: string): Promise<SystemdTimer[]> => {
    console.log(`Simulating: Skipping timer ${id} for today.`);
    await delay(500);
    mockTimers = mockTimers.map(t => {
        if (t.id === id) {
            return { ...t, active: false };
        }
        return t;
    });
    // Simulate it being re-enabled later
    setTimeout(() => {
        mockTimers = mockTimers.map(t => {
            if (t.id === id) {
                return { ...t, active: true };
            }
            return t;
        });
        console.log(`Timer ${id} has been re-enabled automatically.`);
    }, 1000 * 30); // Re-enable after 30 seconds for demo
    return [...mockTimers];
}

const generateMockLogLine = (serverName: string): string => {
    const levels = ['INFO', 'WARN', 'ERROR', 'DEBUG'];
    const actions = [
        'Player connected', 'Player disconnected', 'Saving world', 'Loading chunk',
        'Entity spawned', 'Server tick', 'Memory usage check', 'High ping detected'
    ];
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const level = levels[Math.floor(Math.random() * levels.length)];
    const action = actions[Math.floor(Math.random() * actions.length)];
    const player = `player_${Math.floor(Math.random() * 10)}`;
    return `[${timestamp}] [${serverName}-thread/${level}]: ${action}: ${player}`;
};

const streamLogs = (serverId: string, onNewLine: (line: string) => void): (() => void) => {
    // In a real app, this would establish a WebSocket or SSE connection.
    const serverName = mockGameServers.find(s => s.id === serverId)?.name || 'UnknownServer';

    // Send some initial logs immediately
    setTimeout(() => {
        onNewLine(generateMockLogLine(serverName));
        setTimeout(() => onNewLine(generateMockLogLine(serverName)), 200);
        setTimeout(() => onNewLine(generateMockLogLine(serverName)), 450);
    }, 800);

    const intervalId = setInterval(() => {
        onNewLine(generateMockLogLine(serverName));
    }, 2500);

    // Return a cleanup function to be called on component unmount
    return () => {
        console.log(`Stopping log stream for ${serverId}`);
        clearInterval(intervalId);
    };
};


// NOTE FOR USER: Replace the mock functions above with `fetch` calls to your actual backend API endpoints.
export const mockApi = {
  getSystemStats,
  getGameServers,
  getShutdownTimers,
  performPowerAction,
  toggleGameServer,
  addOrUpdateTimer,
  removeTimer,
  skipTimer,
  streamLogs,
};
