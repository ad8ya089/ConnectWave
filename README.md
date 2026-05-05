# ConnectWave

Peer-to-peer video chat with seamless room-based communication powered by WebRTC, Socket.io, and a modern React UI.

## Features

- 🎥 Real-time peer-to-peer video/audio via WebRTC
- 🏠 Shareable room IDs — no account needed
- 💬 In-call live chat
- 🖥️ Screen sharing
- 🔇 Mute/unmute audio & video
- ⚡ Low-latency direct peer connections
- 🎨 Sleek dark UI

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite, CSS Modules |
| Signaling | Node.js, Socket.io |
| P2P | WebRTC (RTCPeerConnection) |
| Routing | React Router v6 |

## Project Structure

```
connectwave/
├── client/             # React frontend (Vite)
│   └── src/
│       ├── components/ # VideoGrid, Controls, Chat, RoomHeader
│       ├── hooks/      # useWebRTC, useMedia, useChat
│       ├── context/    # SocketContext
│       └── pages/      # LandingPage, RoomPage
└── server/             # Node.js signaling server
    └── index.js
```

## Getting Started

### 1. Install dependencies

```bash
npm run install:all
```

### 2. Start development servers

```bash
npm run dev
```

This starts:
- Signaling server on `http://localhost:4000`
- React frontend on `http://localhost:5173`

### 3. Open in browser

Go to `http://localhost:5173`, enter your name, and create or join a room.

## Environment Variables

### Client (`client/.env`)
```
VITE_SERVER_URL=http://localhost:4000
```

### Server (optional)
```
PORT=4000
CLIENT_URL=http://localhost:5173
```

## Deployment

Build the client:
```bash
npm run build
```

Deploy the `client/dist` folder to any static host (Vercel, Netlify, etc.), and deploy the `server/` to Railway, Render, or any Node.js host. Make sure `VITE_SERVER_URL` points to your deployed server.
