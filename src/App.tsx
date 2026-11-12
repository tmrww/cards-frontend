import React, { useState } from "react";
import { BasicLobbyView } from "./components/BasicLobbyView";
import { getGameModule } from "./games/registry";
import { useGameSocket } from "./hooks/useGameSocket";
import type { GameAction } from "./types";

const PLAYER_ID_KEY = "cardgame_player_id";
const PLAYER_NAME_KEY = "cardgame_player_name";
// Keys used before the app supported multiple games; still read so sessions survive.
const LEGACY_KEYS: Record<string, string> = {
  [PLAYER_ID_KEY]: "guandan_player_id",
  [PLAYER_NAME_KEY]: "guandan_player_name",
};

function getOrCreate(key: string, create: () => string): string {
  const existing = sessionStorage.getItem(key) ?? sessionStorage.getItem(LEGACY_KEYS[key]);
  const value = existing || create();
  sessionStorage.setItem(key, value);
  return value;
}

const randomSuffix = () => Math.random().toString(36).substring(2, 7).toUpperCase();

export const App: React.FC = () => {
  const [playerId] = useState(() => getOrCreate(PLAYER_ID_KEY, () => `P_${randomSuffix()}`));
  const [playerName, setPlayerName] = useState(() =>
    getOrCreate(PLAYER_NAME_KEY, () => `Player_${playerId.slice(2)}`)
  );
  const { connected, roomId, gameType, view, chat, error, send, dispatch } = useGameSocket();

  const displayName = playerName.trim() || playerId;
  const clearError = () => dispatch({ type: "SET_ERROR", error: null });

  const handlePlayerNameChange = (name: string) => {
    setPlayerName(name);
    sessionStorage.setItem(PLAYER_NAME_KEY, name);
  };

  const handleCreateRoom = (type: string) => {
    clearError();
    send({ type: "CREATE_ROOM", gameType: type, playerId, playerName: displayName });
  };

  const handleJoinRoom = (targetRoomId: string) => {
    clearError();
    send({ type: "JOIN_ROOM", roomId: targetRoomId, playerId, playerName: displayName });
  };

  const handleLeaveRoom = () => {
    send({ type: "LEAVE_ROOM" });
    dispatch({ type: "LEFT_LOCALLY" });
  };

  const handleSendAction = (action: GameAction) => {
    clearError();
    send({ type: "GAME_ACTION", action });
  };

  const handleSendChat = (message: string) => {
    clearError();
    send({ type: "SEND_MESSAGE", roomId: roomId ?? undefined, playerId, playerName: displayName, message });
  };

  if (!roomId) {
    return (
      <BasicLobbyView
        connected={connected}
        playerName={playerName}
        onPlayerNameChange={handlePlayerNameChange}
        error={error}
        onCreateRoom={handleCreateRoom}
        onJoinRoom={handleJoinRoom}
      />
    );
  }

  const game = getGameModule(gameType);
  if (!game) {
    return (
      <div>
        <p className="lobby-error">Unsupported game type: {gameType ?? "unknown"}</p>
        <button type="button" onClick={handleLeaveRoom}>
          Leave Room
        </button>
      </div>
    );
  }

  return (
    <game.View
      roomId={roomId}
      playerId={playerId}
      view={view}
      error={error}
      chatMessages={chat}
      clearError={clearError}
      sendAction={handleSendAction}
      sendChat={handleSendChat}
      leaveRoom={handleLeaveRoom}
    />
  );
};
