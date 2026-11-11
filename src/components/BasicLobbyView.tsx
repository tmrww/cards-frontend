import React, { useState } from "react";
import { RoomSummary } from "../types";

export interface BasicLobbyViewProps {
  connected: boolean;
  playerId: string;
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  rooms?: RoomSummary[];
  error: string | null;
  onClearError?: () => void;
  onCreateRoom: () => void;
  onJoinRoom: (roomId: string) => void;
  onRefreshRooms?: () => void;
  onReconnect?: () => void;
}

export const BasicLobbyView: React.FC<BasicLobbyViewProps> = ({
  connected,
  playerName,
  onPlayerNameChange,
  error,
  onCreateRoom,
  onJoinRoom,
}) => {
  const [code, setCode] = useState("");

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || !playerName.trim()) return;
    onJoinRoom(trimmed);
  };

  const handleHost = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    onCreateRoom();
  };

  return (
    <div>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {!connected && <p style={{ color: "gray" }}>Connecting to server...</p>}

      <form onSubmit={handleJoin}>
        <div>
          <label htmlFor="username">Username: </label>
          <input
            id="username"
            type="text"
            value={playerName}
            onChange={(e) => onPlayerNameChange(e.target.value)}
            placeholder="Username"
          />
        </div>

        <div>
          <label htmlFor="room-code">Code: </label>
          <input
            id="room-code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Code"
            maxLength={5}
          />
        </div>

        <div>
          <button type="submit" disabled={!connected || !playerName.trim() || !code.trim()}>
            Join
          </button>
          <button
            type="button"
            disabled={!connected || !playerName.trim()}
            onClick={handleHost}
          >
            Host
          </button>
        </div>
      </form>
    </div>
  );
};

