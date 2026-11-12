# Card Game Frontend

React 19 + TypeScript + Vite web client for the multiplayer card game platform featuring **GuanDan (掼蛋)**.

For full architectural documentation, game rules, network protocols, and task backlog, refer to the root [**`README.md`**](../README.md).

---

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run type checks and production build
npm run build

# Preview production build locally
npm run preview
```

---

## Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `VITE_WS_URL` | Explicit full WebSocket server URL (e.g., `wss://cards-api.tmrww.dev`) | None (auto-resolved) |
| `VITE_WS_HOST` or `VITE_HOST` | Hostname for WebSocket server | `localhost` |
| `VITE_WS_PORT` or `VITE_PORT` | Port for WebSocket server | `8080` |
| `VITE_WS_PROTOCOL` | `ws:` or `wss:` | Auto-detected from browser protocol |

---

## Key Components

- **`src/App.tsx`**: WebSocket connection manager, session ID management, and main screen router.
- **`src/components/GameView.tsx`**: 4-seat compass orientation (N/E/S/W), dynamic overlapping hand fan, bomb badges, and action bar (Ready / Play / Pass).
- **`src/components/LobbyView.tsx`**: Polished lobby with room code inputs, room list browser, and connection status pill.
- **`src/components/BasicLobbyView.tsx`**: Minimal fallback join/host form.
- **`src/utils/cards.ts`**: Card ranking math, bomb auto-detectors, and card sorting algorithms.
