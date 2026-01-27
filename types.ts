
export interface SystemStats {
  cpu: {
    usage: number; // percentage
  };
  ram: {
    used: number; // in GB
    total: number; // in GB
    usage: number; // percentage
  };
  disk: {
    used: number; // in GB
    total: number; // in GB
    usage: number; // percentage
  };
  network: {
    upload: number; // in Mbps
    download: number; // in Mbps
  };
}

export enum GameServerStatus {
  RUNNING = 'running',
  STOPPED = 'stopped',
  CRASHED = 'crashed',
}

export interface GameServer {
  id: string;
  name: string;
  status: GameServerStatus;
}

export interface SystemdTimer {
  id: string;
  name: string;
  onCalendar: string; // e.g., "*-*-* 02:00:00"
  nextElapse: string; // ISO string date
  lastTriggered: string | null; // ISO string date or null
  active: boolean;
}
