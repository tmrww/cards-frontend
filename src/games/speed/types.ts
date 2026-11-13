import type { Card } from "../../types";

export type SpeedAction =
  | { type: "READY" }
  | { type: "PLAY"; payload: { cardId: string; pile: number } }
  | { type: "DRAW" }
  | { type: "UNSTUCK" };

export interface SpeedPlayerInfo {
  id: string;
  name: string;
  handSize: number;
  deckSize: number;
}

export interface SpeedPlayerView {
  hand: Card[];
  players: SpeedPlayerInfo[];
  state?: "WAITING" | "PLAYING" | "ENDED";
  topCards: Card[];
  stuckPiles: number[];
  winner?: string;
}
