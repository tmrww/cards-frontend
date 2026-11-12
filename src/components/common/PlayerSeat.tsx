import React from "react";
import type { Direction } from "./TableLayout";

interface PlayerSeatProps {
  direction: Direction;
  /** Undefined for an empty seat. */
  name?: string;
  isTurn: boolean;
  isMe: boolean;
  isTeammate?: boolean;
  /** Status line under the name (card count, ready state...). */
  children?: React.ReactNode;
}

/** Avatar circle with name and a status line. */
export const PlayerSeat: React.FC<PlayerSeatProps> = ({
  direction,
  name,
  isTurn,
  isMe,
  isTeammate = false,
  children,
}) => {
  const circleRole = isMe ? "circle-me" : isTeammate ? "circle-teammate" : "";
  return (
    <div
      className={`player-seat seat-${direction.toLowerCase()} ${isTurn ? "seat-active-turn" : ""}`}
    >
      <div
        className={`player-circle ${isTurn ? "circle-turn" : ""} ${circleRole} ${
          name === undefined ? "circle-empty" : ""
        }`}
      >
        <span className="seat-Initials">
          {name === undefined ? "—" : name.slice(0, 2).toUpperCase()}
        </span>
      </div>

      <div className="player-under-info">
        <div className="player-name-line">
          <strong>{name ?? "Waiting..."}</strong>
          {isMe && <span className="role-tag"> (You)</span>}
          {!isMe && isTeammate && <span className="role-tag"> (Teammate)</span>}
        </div>
        <div className="player-meta-line">{children}</div>
      </div>
    </div>
  );
};

