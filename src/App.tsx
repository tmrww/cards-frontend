import React, { useCallback, useEffect, useRef, useState } from "react";
import { BasicLobbyView } from "./components/BasicLobbyView";
import { LobbyView } from "./components/LobbyView";
import { GameView } from "./components/GameView";
import {
  ClientMessage,
  GuanDanAction,
  GuanDanPlayerView,
  RoomSummary,
  ServerMessage,
} from "./types";

const WS_URL =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_WS_URL ||
  `ws://${window.location.hostname || "localhost"}:8080`;

function getOrCreatePlayerId(): string {
  const existing = sessionStorage.getItem("guandan_player_id");
  if (existing) return existing;
  const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
  const created = `P_${randomSuffix}`;
  sessionStorage.setItem("guandan_player_id", created);
  return created;
}

function getInitialPlayerName(playerId: string): string {
  const existing = sessionStorage.getItem("guandan_player_name");
  if (existing) return existing;
  const fallback = `Player_${playerId.slice(2)}`;
  sessionStorage.setItem("guandan_player_name", fallback);
  return fallback;
}

export const App: React.FC = () => {
  const [playerId] = useState<string>(() => getOrCreatePlayerId());
  const [playerName, setPlayerName] = useState<string>(() =>
    getInitialPlayerName(getOrCreatePlayerId())
  );

  const [connected, setConnected] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [gameView, setGameView] = useState<GuanDanPlayerView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  const sendMessage = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    } else {
      setError("Not connected to WebSocket server.");
    }
  }, []);

  const connectWebSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return;
    }
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setError(null);
      ws.send(JSON.stringify({ type: "LIST_ROOMS" } satisfies ClientMessage));
    };

    ws.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data);
        switch (msg.type) {
          case "ROOM_CREATED":
          case "ROOM_JOINED":
            setRoomId(msg.roomId);
            setError(null);
            break;

          case "ROOM_LEFT":
            setRoomId(null);
            setGameView(null);
            setError(null);
            ws.send(JSON.stringify({ type: "LIST_ROOMS" } satisfies ClientMessage));
            break;

          case "ROOM_LIST":
            setRooms(msg.rooms);
            break;

          case "STATE_UPDATE":
            setRoomId(msg.roomId);
            setGameView(msg.view);
            break;

          case "ERROR":
            setError(msg.error);
            break;
        }
      } catch {
        setError("Received malformed server message.");
      }
    };

    ws.onclose = () => {
      setConnected(false);
    };

    ws.onerror = () => {
      setConnected(false);
    };
  }, []);

  useEffect(() => {
    connectWebSocket();
    return () => {
      wsRef.current?.close();
    };
  }, [connectWebSocket]);

  const handlePlayerNameChange = (name: string) => {
    setPlayerName(name);
    sessionStorage.setItem("guandan_player_name", name);
  };

  const handleCreateRoom = () => {
    setError(null);
    sendMessage({
      type: "CREATE_ROOM",
      gameType: "guandan",
      playerId,
      playerName: playerName.trim() || playerId,
    });
  };

  const handleJoinRoom = (targetRoomId: string) => {
    setError(null);
    sendMessage({
      type: "JOIN_ROOM",
      roomId: targetRoomId,
      playerId,
      playerName: playerName.trim() || playerId,
    });
  };

  const handleLeaveRoom = () => {
    sendMessage({ type: "LEAVE_ROOM" });
    setRoomId(null);
    setGameView(null);
  };

  const handleRefreshRooms = () => {
    sendMessage({ type: "LIST_ROOMS" });
  };

  const handleSendAction = (action: GuanDanAction) => {
    setError(null);
    sendMessage({
      type: "GAME_ACTION",
      action,
    });
  };

  if (!roomId) {
    return (
      <BasicLobbyView
        connected={connected}
        playerId={playerId}
        playerName={playerName}
        onPlayerNameChange={handlePlayerNameChange}
        rooms={rooms}
        error={error}
        onClearError={() => setError(null)}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
        onRefreshRooms={handleRefreshRooms}
        onReconnect={connectWebSocket}
      />
    );
  }

  return (
    <GameView
      roomId={roomId}
      playerId={playerId}
      view={gameView}
      error={error}
      onClearError={() => setError(null)}
      onSendAction={handleSendAction}
      onLeaveRoom={handleLeaveRoom}
    />
  );
};

