import React, { useState } from "react";
import { RoomSummary } from "../types";

interface LobbyViewProps {
  connected: boolean;
  playerId: string;
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  rooms: RoomSummary[];
  error: string | null;
  onClearError: () => void;
  onCreateRoom: () => void;
  onJoinRoom: (roomId: string) => void;
  onRefreshRooms: () => void;
  onReconnect: () => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  connected,
  playerId,
  playerName,
  onPlayerNameChange,
  rooms,
  error,
  onClearError,
  onCreateRoom,
  onJoinRoom,
  onRefreshRooms,
  onReconnect,
}) => {
  const [roomCodeInput, setRoomCodeInput] = useState("");

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = roomCodeInput.trim().toUpperCase();
    if (!trimmed) return;
    onJoinRoom(trimmed);
  };

  return (
    <div className="lobby-screen">
      <div className="lobby-container">
        <div className="lobby-header">
          <h1>GuanDan</h1>
          <div className="conn-status">
            <span className={`status-dot ${connected ? "online" : "offline"}`} />
            <span>{connected ? "Connected to Server" : "Disconnected"}</span>
            {!connected && (
              <button type="button" className="btn-small" onClick={onReconnect}>
                Reconnect
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="error-banner">
            <span>{error}</span>
            <button type="button" className="btn-clear" onClick={onClearError}>
              ✕
            </button>
          </div>
        )}

        <div className="lobby-section">
          <label className="field-label" htmlFor="player-name-input">
            Your Player Name
          </label>
          <div className="player-id-row">
            <input
              id="player-name-input"
              type="text"
              className="text-input"
              value={playerName}
              onChange={(e) => onPlayerNameChange(e.target.value)}
              placeholder="Enter your name..."
              maxLength={24}
            />
            <span className="player-id-tag" title="Your unique session Player ID">
              ID: {playerId}
            </span>
          </div>
        </div>

        <div className="lobby-actions-grid">
          <div className="lobby-box">
            <h2>Create Room</h2>
            <p className="helper-text">Start a new 4-player GuanDan table and get a 5-character room code.</p>
            <button
              type="button"
              className="btn-primary"
              disabled={!connected || !playerName.trim()}
              onClick={onCreateRoom}
            >
              Create GuanDan Room
            </button>
          </div>

          <div className="lobby-box">
            <h2>Join Room by Code</h2>
            <form onSubmit={handleJoinSubmit} className="join-form">
              <input
                type="text"
                className="text-input code-input"
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                placeholder="5-CHAR CODE"
                maxLength={5}
              />
              <button
                type="submit"
                className="btn-primary"
                disabled={!connected || !playerName.trim() || !roomCodeInput.trim()}
              >
                Join Room
              </button>
            </form>
          </div>
        </div>

        <div className="lobby-section rooms-list-section">
          <div className="section-title-row">
            <h2>Active Rooms ({rooms.length})</h2>
            <button
              type="button"
              className="btn-secondary btn-small"
              disabled={!connected}
              onClick={onRefreshRooms}
            >
              Refresh
            </button>
          </div>

          <div className="rooms-list">
            {rooms.length === 0 ? (
              <div className="empty-rooms">No active rooms found. Create one above!</div>
            ) : (
              rooms.map((r) => (
                <div key={r.roomId} className="room-item">
                  <div className="room-item-info">
                    <strong>{r.roomId}</strong>
                    <span className="room-meta">
                      Game: {r.gameType} | Players: {r.playerCount} / 4
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary btn-small"
                    disabled={!connected || !playerName.trim() || r.playerCount >= 4}
                    onClick={() => onJoinRoom(r.roomId)}
                  >
                    {r.playerCount >= 4 ? "Full" : "Join"}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

