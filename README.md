# Server Dashboard

A web-based dashboard for monitoring and managing a Linux server running game servers. Built with React and Fastify.

## Features

- **System Monitoring** — Real-time CPU, RAM, disk, and network usage
- **Game Server Management** — Start/stop game servers via systemd, enable/disable at boot
- **Log Streaming** — Live logs via WebSocket
- **Shutdown Timers** — Schedule automatic shutdowns with systemd timers (with backup on delete)
- **Power Controls** — Remote shutdown/restart with confirmation
- **Responsive Design** — Mobile-friendly interface

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                        │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────┐   │
│  │ System    │ │ Game      │ │ Timer     │ │ Power         │   │
│  │ Monitor   │ │ Servers   │ │ Manager   │ │ Controls      │   │
│  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └───────┬───────┘   │
│        │             │             │               │            │
│        └─────────────┴─────────────┴───────────────┘            │
│                              │                                  │
│                      services/api.ts                            │
│                              │                                  │
└──────────────────────────────┼──────────────────────────────────┘
                               │ HTTP/WebSocket
                               ▼
┌──────────────────────────────┼──────────────────────────────────┐
│                      Vite Dev Proxy                             │
│               /api → :3001    /ws → ws://:3001                  │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Backend (Fastify)                         │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────┐   │
│  │ /api/     │ │ /api/     │ │ /api/     │ │ /api/power/   │   │
│  │ system/   │ │ servers/  │ │ timers/   │ │ shutdown|     │   │
│  │ stats     │ │ :id/start │ │ CRUD      │ │ restart       │   │
│  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └───────┬───────┘   │
│        │             │             │               │            │
│        ▼             ▼             ▼               ▼            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Services Layer                        │   │
│  │  systemStats │ gameServers │ timers │ power │ logStreamer│   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Linux System                             │
│  ┌─────────┐ ┌─────────┐ ┌───────────┐ ┌───────────────────┐   │
│  │ top     │ │systemctl│ │ journalctl│ │ /proc/net/dev     │   │
│  │ free    │ │ start   │ │ -f        │ │ /etc/systemd/     │   │
│  │ df      │ │ stop    │ │           │ │ system/           │   │
│  └─────────┘ └─────────┘ └───────────┘ └───────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
ServerDashboard/
├── App.tsx                    # Main React component
├── index.tsx                  # React entry point
├── index.html                 # HTML template
├── types.ts                   # Shared TypeScript types
├── vite.config.ts             # Vite config with proxy
├── package.json               # Frontend dependencies
│
├── components/
│   ├── SystemMonitor.tsx      # CPU/RAM/disk/network cards
│   ├── GameServerManager.tsx  # Server list with start/stop
│   ├── LogViewer.tsx          # Real-time log display
│   ├── TimerManager.tsx       # Shutdown timer CRUD
│   ├── PowerControls.tsx      # Shutdown/restart buttons
│   ├── Modal.tsx              # Reusable modal component
│   ├── StatCard.tsx           # Stat display card
│   └── icons/                 # SVG icon components
│
├── services/
│   ├── api.ts                 # Real API client (fetch/WebSocket)
│   └── mockApi.ts             # Mock API for development
│
└── server/                    # Backend application
    ├── package.json           # Backend dependencies
    ├── tsconfig.json          # TypeScript config
    ├── API.md                 # API documentation
    │
    └── src/
        ├── index.ts           # Fastify server entry
        ├── config.ts          # Configuration & server discovery
        ├── types.ts           # Backend TypeScript types
        │
        ├── routes/
        │   ├── system.ts      # GET /api/system/stats
        │   ├── servers.ts     # Game server endpoints
        │   ├── timers.ts      # Timer CRUD endpoints
        │   ├── power.ts       # Power control endpoints
        │   └── logs.ts        # WebSocket log streaming
        │
        ├── services/
        │   ├── systemStats.ts # Parse top, free, df, /proc/net/dev
        │   ├── gameServers.ts # systemctl status/start/stop
        │   ├── timers.ts      # systemd timer management
        │   ├── power.ts       # shutdown/reboot commands
        │   └── logStreamer.ts # journalctl -f streaming
        │
        └── utils/
            └── exec.ts        # Safe command execution
```

## Quick Start

### Prerequisites

- Node.js 18+ (20+ recommended)
- Linux server with systemd
- sudo access for power controls and service management

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd ServerDashboard

# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

### Configuration

Edit `server/src/config.ts`:

```typescript
// Path to folder containing game server directories
// Each subfolder name = systemd service name
export const GAME_SERVERS_PATH = '/home/youruser/gameservers';

// Network interface to monitor
export const NETWORK_INTERFACE = 'eth0';  // or 'ens33', 'enp0s3', etc.
```

Or use environment variables:

```bash
export GAME_SERVERS_PATH=/opt/gameservers
export NETWORK_INTERFACE=ens192
export PORT=3001
```

### Running

**Development (two terminals):**

```bash
# Terminal 1: Backend
cd server
npm run dev

# Terminal 2: Frontend
npm run dev
```

**Production:**

```bash
# Build frontend
npm run build

# Build backend
cd server
npm run build

# Run backend (serves API, frontend via reverse proxy)
npm start
```

Open http://localhost:3000 in your browser.

## Game Server Setup

The dashboard discovers game servers by scanning `GAME_SERVERS_PATH`. Each subdirectory is treated as a server with a corresponding systemd service.

### Example Structure

```
/home/vvicier/gameservers/
├── palworld/          → palworld.service
├── minecraft/         → minecraft.service
└── valheim/           → valheim.service
```

### Creating a Game Server Service

1. Create the service file:

```bash
sudo nano /etc/systemd/system/palworld.service
```

```ini
[Unit]
Description=Palworld Dedicated Server
After=network.target

[Service]
Type=simple
User=gameuser
WorkingDirectory=/home/vvicier/gameservers/palworld
ExecStart=/home/vvicier/gameservers/palworld/start.sh
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

2. Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable palworld.service
sudo systemctl start palworld.service
```

## Sudo Configuration

The backend needs sudo access for certain operations. Create a sudoers file:

```bash
sudo visudo -f /etc/sudoers.d/serverdashboard
```

```sudoers
# Allow dashboard user to manage game servers
dashboard ALL=(ALL) NOPASSWD: /bin/systemctl start palworld.service
dashboard ALL=(ALL) NOPASSWD: /bin/systemctl stop palworld.service
dashboard ALL=(ALL) NOPASSWD: /bin/systemctl start minecraft.service
dashboard ALL=(ALL) NOPASSWD: /bin/systemctl stop minecraft.service
dashboard ALL=(ALL) NOPASSWD: /bin/systemctl start valheim.service
dashboard ALL=(ALL) NOPASSWD: /bin/systemctl stop valheim.service

# Power controls
dashboard ALL=(ALL) NOPASSWD: /sbin/shutdown
dashboard ALL=(ALL) NOPASSWD: /sbin/poweroff
dashboard ALL=(ALL) NOPASSWD: /sbin/reboot
dashboard ALL=(ALL) NOPASSWD: /bin/systemctl daemon-reload
dashboard ALL=(ALL) NOPASSWD: /bin/systemctl enable *
dashboard ALL=(ALL) NOPASSWD: /bin/systemctl disable *
dashboard ALL=(ALL) NOPASSWD: /bin/systemctl start *
dashboard ALL=(ALL) NOPASSWD: /bin/systemctl stop *
```

## API Reference

See [server/API.md](server/API.md) for complete API documentation.

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/system/stats` | System resource usage |
| GET | `/api/servers` | List game servers |
| POST | `/api/servers/:id/start` | Start a server |
| POST | `/api/servers/:id/stop` | Stop a server |
| POST | `/api/servers/:id/enable` | Enable server at boot |
| POST | `/api/servers/:id/disable` | Disable server at boot |
| GET | `/api/timers` | List shutdown timers |
| PUT | `/api/timers/:id` | Update timer |
| POST | `/api/timers/:id/skip` | Skip timer temporarily |
| POST | `/api/timers/:id/unskip` | Re-enable skipped timer |
| POST | `/api/power/shutdown` | Schedule shutdown |
| POST | `/api/power/restart` | Schedule restart |
| WS | `/ws/logs/:serverId` | Stream server logs |

## Frontend Components

### SystemMonitor

Displays real-time system statistics in card format:
- CPU usage percentage
- RAM used/total with percentage
- Disk used/total with percentage
- Network upload/download speeds

Polls `/api/system/stats` every 3 seconds.

### GameServerManager

Lists discovered game servers with:
- Status indicator (running/stopped/crashed)
- Enabled/Disabled badge (shows if service starts at boot)
- Enable/Disable at boot toggle button
- Start/Stop toggle button
- View Logs button (opens modal with LogViewer)
- Download/Upload files buttons

### LogViewer

Real-time log streaming via WebSocket:
- Connects to `/ws/logs/:serverId`
- Auto-scrolls to latest logs
- Displays last 50 lines initially, then streams new lines

### TimerManager

Interface for systemd shutdown timers:
- Edit existing timers (name, schedule, persistent setting)
- Skip timer (temporary disable)
- Re-enable skipped timer
- Status badges (Active/Skipped, Persistent)

Uses systemd.time calendar format (e.g., `*-*-* 02:00:00`).

**Note:** Timer creation/deletion is managed via systemd directly. Deleted timers are backed up to `/home/vvicier/timersBackup`.

### PowerControls

Shutdown and restart buttons with confirmation dialogs. Actions are scheduled with 1-minute delay.

## Development

### Mock API

For frontend development without the backend, import from `mockApi`:

```typescript
// services/api.ts
import { mockApi as api } from './mockApi';
export { api };
```

### TypeScript

Both frontend and backend use TypeScript with strict mode enabled.

```bash
# Check frontend types
npx tsc --noEmit

# Check backend types
cd server && npx tsc --noEmit
```

### Adding a New Endpoint

1. Create service function in `server/src/services/`
2. Create route handler in `server/src/routes/`
3. Register route in `server/src/index.ts`
4. Add API function in `services/api.ts`
5. Update API documentation

## Deployment

### With nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name dashboard.example.com;

    # Frontend static files
    location / {
        root /var/www/serverdashboard/dist;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket proxy
    location /ws/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

### With systemd

```bash
sudo nano /etc/systemd/system/serverdashboard.service
```

```ini
[Unit]
Description=Server Dashboard Backend
After=network.target

[Service]
Type=simple
User=dashboard
WorkingDirectory=/opt/serverdashboard/server
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
Environment=NODE_ENV=production
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable serverdashboard
sudo systemctl start serverdashboard
```

## Security Considerations

⚠️ **This dashboard controls system power and services. Deploy carefully.**

- **No authentication** — Add authentication before exposing to untrusted networks
- **Sudo access** — Limit sudoers to specific commands only
- **HTTPS** — Use TLS in production (via reverse proxy)
- **Firewall** — Restrict access to trusted IPs
- **Input validation** — All user input is validated before execution

## License

MIT
