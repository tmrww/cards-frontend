import React, { useEffect, useState } from "react";
import { useTurnPopup } from "../../hooks/useTurnPopup";
import type { ChatMessage } from "../../types";
import {
  isChatSoundsEnabled,
  isGameSoundsEnabled,
  loadSoundConfig,
  playGameSound,
  setChatSoundsEnabled,
  setGameSoundsEnabled,
} from "../../utils/sound";
import { ChatPanel } from "./ChatPanel";
import { ErrorBanner } from "./ErrorBanner";
import { TurnBanner } from "./TurnBanner";

interface GameShellProps {
  roomId: string;
  playerId: string;
  isMyTurn: boolean;
  onLeave: () => void;
  chatMessages: ChatMessage[];
  onSendChat: (text: string) => void;
  error: string | null;
  onClearError: () => void;
  /** Info panel pinned to the top right. */
  topRight?: React.ReactNode;
  /** The table: seats and center. */
  table: React.ReactNode;
  /** Actions and hand, shown at the bottom under the error banner. */
  footer: React.ReactNode;
}

/** Page frame shared by every game: room bar, turn pop-up, chat, error banner. */
export const GameShell: React.FC<GameShellProps> = ({
  roomId,
  playerId,
  isMyTurn,
  onLeave,
  chatMessages,
  onSendChat,
  error,
  onClearError,
  topRight,
  table,
  footer,
}) => {
  useEffect(() => {
    void loadSoundConfig();
  }, []);

  const [gameSoundsOn, setGameSoundsOn] = useState(isGameSoundsEnabled);
  const [chatSoundsOn, setChatSoundsOn] = useState(isChatSoundsEnabled);

  const toggleGameSounds = () => {
    const next = !gameSoundsOn;
    setGameSoundsEnabled(next);
    setGameSoundsOn(next);
  };

  const toggleChatSounds = () => {
    const next = !chatSoundsOn;
    setChatSoundsEnabled(next);
    setChatSoundsOn(next);
  };

  const popup = useTurnPopup(isMyTurn, () => playGameSound("your_turn", playerId));

  return (
    <div className="game-screen">
      <TurnBanner {...popup} />

      <div className="top-left-bar">
        <div className="room-badge">
          Room: <strong>{roomId}</strong>
        </div>
        <button type="button" className="btn-secondary btn-small" onClick={onLeave}>
          Leave Room
        </button>
      </div>

      {topRight}

      <div className="table-area">
        {table}
        <div className="sound-toggles-bar">
          <button
            type="button"
            className={`btn-secondary btn-small ${gameSoundsOn ? "" : "sound-toggle-off"}`}
            aria-pressed={gameSoundsOn}
            onClick={toggleGameSounds}
          >
            Game Sounds: {gameSoundsOn ? "On" : "Off"}
          </button>
          <button
            type="button"
            className={`btn-secondary btn-small ${chatSoundsOn ? "" : "sound-toggle-off"}`}
            aria-pressed={chatSoundsOn}
            onClick={toggleChatSounds}
          >
            Chat Sounds: {chatSoundsOn ? "On" : "Off"}
          </button>
        </div>
        <ChatPanel messages={chatMessages} onSend={onSendChat} />
      </div>

      <div className="bottom-hand-dock">
        <ErrorBanner error={error} onClear={onClearError} />
        {footer}
      </div>
    </div>
  );
};

