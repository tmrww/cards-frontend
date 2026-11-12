import React, { useState } from "react";
import { listLobbyGames } from "../games/registry";

export interface BasicLobbyViewProps {
  connected: boolean;
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  error: string | null;
  onCreateRoom: (gameType: string) => void;
  onJoinRoom: (roomId: string) => void;
}

export const BasicLobbyView: React.FC<BasicLobbyViewProps> = ({
  connected,
  playerName,
  onPlayerNameChange,
  error,
  onCreateRoom,
  onJoinRoom,
}) => {
  const games = listLobbyGames();
  const [code, setCode] = useState("");
  const [gameType, setGameType] = useState(games[0].id);

  const hasName = playerName.trim() !== "";

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed && hasName) onJoinRoom(trimmed);
  };

  return (
    <div>
      {error && <p className="lobby-error">{error}</p>}
      {!connected && <p className="lobby-muted">Connecting to server...</p>}

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
          <label htmlFor="game-type">Game: </label>
          <select id="game-type" value={gameType} onChange={(e) => setGameType(e.target.value)}>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <button type="submit" disabled={!connected || !hasName || !code.trim()}>
            Join
          </button>
          <button
            type="button"
            disabled={!connected || !hasName}
            onClick={() => onCreateRoom(gameType)}
          >
            Host
          </button>
        </div>
      </form>
    </div>
  );
};
