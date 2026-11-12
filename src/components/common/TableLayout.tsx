import React from "react";

export type Direction = "N" | "E" | "S" | "W";

export interface SeatPlacement {
  direction: Direction;
  /** Index into the game's player list. */
  seatIndex: number;
  /** Seats clockwise/counterclockwise from the viewer (0 = viewer). */
  offset: number;
}

/** Which table edges are used for a given player count, clockwise from the viewer (S). */
const CLOCKWISE_DIRECTIONS: Record<number, Direction[]> = {
  2: ["S", "N"],
  3: ["S", "W", "E"],
  4: ["S", "W", "N", "E"],
};

export const MIN_TABLE_PLAYERS = 2;
export const MAX_TABLE_PLAYERS = 4;

/**
 * Places `playerCount` seats around the table with the viewer at the bottom (S).
 * Clockwise order is S → W → N → E; counterclockwise reverses the other seats.
 */
export function seatsFor(
  playerCount: number,
  mySeatIndex: number,
  clockwise = true
): SeatPlacement[] {
  const base = CLOCKWISE_DIRECTIONS[playerCount];
  if (!base) {
    throw new RangeError(
      `Table supports ${MIN_TABLE_PLAYERS}-${MAX_TABLE_PLAYERS} players, got ${playerCount}`
    );
  }
  const [me, ...others] = base;
  const directions = clockwise ? base : [me, ...others.reverse()];
  return directions.map((direction, offset) => ({
    direction,
    seatIndex: (mySeatIndex + offset) % playerCount,
    offset,
  }));
}

interface TableLayoutProps {
  /** Content for each used edge. Unused edges are left empty. */
  seats: Partial<Record<Direction, React.ReactNode>>;
  /** Center of the table (status boxes etc.). */
  children?: React.ReactNode;
}

/** The N / (W, center, E) / S table grid. */
export const TableLayout: React.FC<TableLayoutProps> = ({ seats, children }) => (
  <>
    <div className="table-north">{seats.N}</div>
    <div className="table-middle-row">
      <div className="table-west">{seats.W}</div>
      <div className="table-center">{children}</div>
      <div className="table-east">{seats.E}</div>
    </div>
    <div className="table-south">{seats.S}</div>
  </>
);

