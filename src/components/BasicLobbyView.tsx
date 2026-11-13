import React, { useEffect, useState } from "react";
import { listLobbyGames } from "../games/registry";

export interface BasicLobbyViewProps {
  connected: boolean;
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  error: string | null;
  onCreateRoom: (gameType: string) => void;
  onJoinRoom: (roomId: string) => void;
}

function getInitialCode(): string {
  if (typeof window === "undefined") return "";
  const param = new URLSearchParams(window.location.search).get("code");
  return param ? param.trim().toUpperCase().slice(0, 5) : "";
}

type LobbyTab = "host" | "join";

export const BasicLobbyView: React.FC<BasicLobbyViewProps> = ({
  connected,
  playerName,
  onPlayerNameChange,
  error,
  onCreateRoom,
  onJoinRoom,
}) => {
  const games = listLobbyGames();
  const [code, setCode] = useState(getInitialCode);
  const [tab, setTab] = useState<LobbyTab>(() => (getInitialCode() ? "join" : "host"));
  const [gameType, setGameType] = useState(games[0].id);

  useEffect(() => {
    if (!error || !/room not found|not found|invalid.*code|invalid.*room/i.test(error)) {
      return;
    }
    setCode("");
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.has("code")) {
        url.searchParams.delete("code");
        const nextSearch = url.searchParams.toString();
        const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ""}${url.hash}`;
        window.history.replaceState(null, "", nextUrl);
      }
    }
  }, [error]);

  const hasName = playerName.trim() !== "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!connected || !hasName) return;
    if (tab === "host") {
      onCreateRoom(gameType);
      return;
    }
    const trimmed = code.trim().toUpperCase();
    if (trimmed) onJoinRoom(trimmed);
  };

  return (
    <div className="lobby-screen">
      <div className="lobby-card">
        <h2 className="lobby-title">Card Games</h2>
        {error && <p className="lobby-error">{error}</p>}
        {!connected && <p className="lobby-muted">Connecting to server...</p>}

        <div className="lobby-tabs" role="tablist" aria-label="Lobby mode">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "host"}
            data-testid="lobby-tab-host"
            className={`lobby-tab ${tab === "host" ? "lobby-tab--active" : ""}`}
            onClick={() => setTab("host")}
          >
            Host Game
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "join"}
            data-testid="lobby-tab-join"
            className={`lobby-tab ${tab === "join" ? "lobby-tab--active" : ""}`}
            onClick={() => setTab("join")}
          >
            Join Game
          </button>
        </div>

        <form onSubmit={handleSubmit}>
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

          {tab === "join" ? (
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
          ) : (
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
          )}

          <div>
            {tab === "join" ? (
              <button type="submit" disabled={!connected || !hasName || !code.trim()}>
                Join
              </button>
            ) : (
              <button type="submit" disabled={!connected || !hasName}>
                Host
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
