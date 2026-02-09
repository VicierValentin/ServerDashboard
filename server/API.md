# Server Dashboard API Documentation

Base URL: `http://localhost:3001`

## Table of Contents

- [System](#system)
  - [GET /api/system/stats](#get-apisystemstats)
  - [GET /api/health](#get-apihealth)
- [Game Servers](#game-servers)
  - [GET /api/servers](#get-apiservers)
  - [POST /api/servers/:id/start](#post-apiserversidstart)
  - [POST /api/servers/:id/stop](#post-apiserversidstop)
  - [POST /api/servers/:id/enable](#post-apiserversidenable)
  - [POST /api/servers/:id/disable](#post-apiserversiddisable)
- [Shutdown Timers](#shutdown-timers)
  - [GET /api/timers](#get-apitimers)
  - [POST /api/timers](#post-apitimers)
  - [PUT /api/timers/:id](#put-apitimersid)
  - [DELETE /api/timers/:id](#delete-apitimersid)
  - [POST /api/timers/:id/skip](#post-apitimersidskip)
  - [POST /api/timers/:id/unskip](#post-apitimersidunsk)
- [Power Control](#power-control)
  - [POST /api/power/shutdown](#post-apipowershutdown)
  - [POST /api/power/restart](#post-apipowerrestart)
  - [POST /api/power/cancel](#post-apipowercancel)
- [WebSocket](#websocket)
  - [WS /ws/logs/:serverId](#ws-wslogsserverid)
  - [WS /ws/console/:serverId](#ws-wsconsoleserverid)
  - [WS /ws/chat/:serverId](#ws-wschatserverid)

---

## System

### GET /api/system/stats

Get current system statistics including CPU, RAM, disk, and network usage.

**Response**

```json
{
  "cpu": {
    "usage": 12.5
  },
  "ram": {
    "used": 8.24,
    "total": 16.0,
    "usage": 51.5
  },
  "disk": {
    "used": 456.78,
    "total": 1024.0,
    "usage": 44.6
  },
  "network": {
    "upload": 2.45,
    "download": 15.32
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `cpu.usage` | number | CPU usage percentage (0-100) |
| `ram.used` | number | RAM used in GB |
| `ram.total` | number | Total RAM in GB |
| `ram.usage` | number | RAM usage percentage (0-100) |
| `disk.used` | number | Disk used in GB |
| `disk.total` | number | Total disk in GB |
| `disk.usage` | number | Disk usage percentage (0-100) |
| `network.upload` | number | Upload speed in Mbps |
| `network.download` | number | Download speed in Mbps |

---

### GET /api/health

Health check endpoint.

**Response**

```json
{
  "status": "ok",
  "timestamp": "2026-01-27T10:30:00.000Z"
}
```

---

## Game Servers

Game servers are discovered automatically by scanning the configured `GAME_SERVERS_PATH` directory. Each subdirectory name corresponds to a systemd service (e.g., folder `palworld` → `palworld.service`).

### GET /api/servers

List all game servers with their current status.

**Response**

```json
[
  {
    "id": "palworld",
    "name": "Palworld",
    "status": "running",
    "enabled": true
  },
  {
    "id": "minecraft",
    "name": "Minecraft",
    "status": "stopped",
    "enabled": true
  },
  {
    "id": "valheim",
    "name": "Valheim",
    "status": "crashed",
    "enabled": false
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Server identifier (folder name) |
| `name` | string | Display name (auto-formatted from id) |
| `status` | string | One of: `running`, `stopped`, `crashed` |
| `enabled` | boolean | Whether the service is enabled to start at boot |

---

### POST /api/servers/:id/start

Start a game server.

**Parameters**

| Parameter | Location | Description |
|-----------|----------|-------------|
| `id` | path | Server identifier |

**Response**

Returns the updated list of all servers (same format as `GET /api/servers`).

**Errors**

| Status | Description |
|--------|-------------|
| 500 | Unknown game server or systemctl failed |

---

### POST /api/servers/:id/stop

Stop a game server.

**Parameters**

| Parameter | Location | Description |
|-----------|----------|-------------|
| `id` | path | Server identifier |

**Response**

Returns the updated list of all servers (same format as `GET /api/servers`).

**Errors**

| Status | Description |
|--------|-------------|
| 500 | Unknown game server or systemctl failed |

---

### POST /api/servers/:id/enable

Enable a game server to start at boot.

**Parameters**

| Parameter | Location | Description |
|-----------|----------|-------------|
| `id` | path | Server identifier |

**Response**

Returns the updated list of all servers (same format as `GET /api/servers`).

**Errors**

| Status | Description |
|--------|-------------|
| 500 | Unknown game server or systemctl failed |

---

### POST /api/servers/:id/disable

Disable a game server from starting at boot.

**Parameters**

| Parameter | Location | Description |
|-----------|----------|-------------|
| `id` | path | Server identifier |

**Response**

Returns the updated list of all servers (same format as `GET /api/servers`).

**Errors**

| Status | Description |
|--------|-------------|
| 500 | Unknown game server or systemctl failed |

---

## Shutdown Timers

Manage systemd timers for scheduled system shutdowns.

### GET /api/timers

List all shutdown timers.

**Response**

```json
[
  {
    "id": "dashboard-shutdown-daily",
    "name": "Daily Shutdown",
    "onCalendar": "*-*-* 02:00:00",
    "nextElapse": "2026-01-28T02:00:00.000Z",
    "lastTriggered": "2026-01-27T02:00:00.000Z",
    "active": true,
    "persistent": true
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Timer identifier |
| `name` | string | Display name |
| `onCalendar` | string | systemd.time calendar expression |
| `nextElapse` | string | ISO 8601 timestamp of next trigger |
| `lastTriggered` | string \| null | ISO 8601 timestamp of last trigger |
| `active` | boolean | Whether the timer is currently running |
| `persistent` | boolean | Run immediately if last scheduled time was missed |

---

### POST /api/timers

Create a new shutdown timer.

**Request Body**

```json
{
  "name": "Weekend Late Shutdown",
  "onCalendar": "Sat,Sun *-*-* 04:00:00",
  "active": true,
  "persistent": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Display name for the timer |
| `onCalendar` | string | Yes | systemd.time calendar expression |
| `active` | boolean | No | Enable timer immediately (default: true) |
| `persistent` | boolean | No | Run if missed (default: true) |

**Response**

Returns the updated list of all timers.

**Errors**

| Status | Description |
|--------|-------------|
| 400 | Missing required fields |
| 500 | Failed to create timer |

---

### PUT /api/timers/:id

Update an existing timer.

**Parameters**

| Parameter | Location | Description |
|-----------|----------|-------------|
| `id` | path | Timer identifier |

**Request Body**

```json
{
  "name": "Updated Timer Name",
  "onCalendar": "*-*-* 03:00:00",
  "active": true,
  "persistent": true
}
```

**Response**

Returns the updated list of all timers.

**Note:** When editing, only `name`, `onCalendar`, and `persistent` values are updated. The service file and other settings are preserved.

**Errors**

| Status | Description |
|--------|-------------|
| 400 | Missing required fields |
| 500 | Failed to update timer |

---

### DELETE /api/timers/:id

Remove a shutdown timer.

**Note:** Timer files are backed up to `/home/vvicier/timersBackup` before deletion with a timestamp suffix.

**Parameters**

| Parameter | Location | Description |
|-----------|----------|-------------|
| `id` | path | Timer identifier |

**Response**

Returns the updated list of all timers.

---

### POST /api/timers/:id/skip

Skip a timer temporarily (stops it without removing).

**Parameters**

| Parameter | Location | Description |
|-----------|----------|-------------|
| `id` | path | Timer identifier |

**Response**

Returns the updated list of all timers.

---

### POST /api/timers/:id/unskip

Re-enable a skipped timer (starts it again).

**Parameters**

| Parameter | Location | Description |
|-----------|----------|-------------|
| `id` | path | Timer identifier |

**Response**

Returns the updated list of all timers.

---

## Power Control

Control system power state. All power actions are scheduled with a 1-minute delay to allow the API response to be sent.

### POST /api/power/shutdown

Schedule a system shutdown.

**Response**

```json
{
  "success": true,
  "message": "Shutdown scheduled in 1 minute"
}
```

---

### POST /api/power/restart

Schedule a system restart.

**Response**

```json
{
  "success": true,
  "message": "Restart scheduled in 1 minute"
}
```

---

### POST /api/power/cancel

Cancel a pending shutdown or restart.

**Response**

```json
{
  "success": true,
  "message": "Pending power action cancelled"
}
```

---

## WebSocket

### WS /ws/logs/:serverId

Stream real-time logs from a game server via WebSocket.

**URL**

```
ws://localhost:3001/ws/logs/:serverId
```

**Parameters**

| Parameter | Location | Description |
|-----------|----------|-------------|
| `serverId` | path | Server identifier |

**Messages (Server → Client)**

Each message is a single log line as plain text:

```
Jan 27 10:30:45 server palworld[1234]: Player connected: user123
```

**Error Message**

If an error occurs, a JSON message is sent:

```json
{
  "error": "Unknown server: invalid-id"
}
```

**Example (JavaScript)**

```javascript
const ws = new WebSocket('ws://localhost:3001/ws/logs/palworld');

ws.onmessage = (event) => {
  console.log('Log:', event.data);
};

ws.onclose = () => {
  console.log('Disconnected');
};

// Close when done
ws.close();
```

---

### WS /ws/console/:serverId

Interactive RCON console for Minecraft servers via WebSocket.

**URL**

```
ws://localhost:3001/ws/console/:serverId
```

**Parameters**

| Parameter | Location | Description |
|-----------|----------|-------------|
| `serverId` | path | Minecraft server identifier |

**Messages (Client → Server)**

```json
{
  "type": "command",
  "command": "say Hello World"
}
```

**Messages (Server → Client)**

```json
{
  "type": "ready"
}
```

```json
{
  "type": "output",
  "data": "Command response text"
}
```

```json
{
  "type": "error",
  "data": "Error message"
}
```

---

### WS /ws/chat/:serverId

In-game chat interface for Minecraft servers via WebSocket.

**URL**

```
ws://localhost:3001/ws/chat/:serverId
```

**Parameters**

| Parameter | Location | Description |
|-----------|----------|-------------|
| `serverId` | path | Minecraft server identifier |

**Messages (Client → Server)**

Send a chat message:

```json
{
  "type": "message",
  "message": "Hello players!",
  "username": "Admin"
}
```

Request player count update:

```json
{
  "type": "requestPlayerCount"
}
```

**Messages (Server → Client)**

Chat message from player:

```json
{
  "type": "chat",
  "timestamp": "14:30:45",
  "playerName": "Steve",
  "message": "Thanks!"
}
```

Player count update (sent automatically every 10 seconds):

```json
{
  "type": "playerCount",
  "count": 3,
  "max": 20,
  "players": ["Steve", "Alex", "Herobrine"]
}
```

Message sent confirmation:

```json
{
  "type": "sent",
  "success": true
}
```

Error message:

```json
{
  "type": "error",
  "data": "Connection failed"
}
```

**Example (JavaScript)**

```javascript
const ws = new WebSocket('ws://localhost:3001/ws/chat/minecraft');

ws.onopen = () => {
  console.log('Connected to chat');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'chat') {
    console.log(`[${data.timestamp}] <${data.playerName}> ${data.message}`);
  } else if (data.type === 'playerCount') {
    console.log(`Players online: ${data.count}/${data.max}`);
  }
};

// Send a message
ws.send(JSON.stringify({
  type: 'message',
  message: 'Hello from the dashboard!',
  username: 'Admin'
}));

// Close when done
ws.close();
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Description of what went wrong"
}
```

| Status Code | Description |
|-------------|-------------|
| 400 | Bad Request - Invalid or missing parameters |
| 500 | Internal Server Error - Command execution failed |

---

## Configuration

Environment variables (or defaults in `src/config.ts`):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Server port |
| `HOST` | 0.0.0.0 | Bind address |
| `FRONTEND_ORIGIN` | http://localhost:3000 | CORS allowed origin |
| `GAME_SERVERS_PATH` | /home/vvicier/gameservers | Path to scan for game server folders |
| `SYSTEMD_USER_DIR` | /etc/systemd/system | Directory for timer unit files |
| `NETWORK_INTERFACE` | eth0 | Network interface to monitor |

---

## systemd.time Calendar Format

The `onCalendar` field uses systemd's calendar event syntax. Examples:

| Expression | Description |
|------------|-------------|
| `*-*-* 02:00:00` | Daily at 2:00 AM |
| `Mon *-*-* 09:00:00` | Every Monday at 9:00 AM |
| `Sat,Sun *-*-* 04:00:00` | Weekends at 4:00 AM |
| `*-*-01 00:00:00` | First day of every month at midnight |
| `hourly` | Every hour |
| `daily` | Every day at midnight |
| `weekly` | Every Monday at midnight |

For more details, see: `man systemd.time`
