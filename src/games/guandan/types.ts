import type { Card } from "../../types";

export type GuanDanCombinationType =
  | "SINGLE"
  | "PAIR"
  | "TRIPLE"
  | "FULL_HOUSE"
  | "CONSECUTIVE_PAIRS"
  | "CONSECUTIVE_TRIPLES"
  | "STRAIGHT"
  | "STRAIGHT_BOMB"
  | "BOMB"
  | "FOUR_JOKERS";

export interface GuanDanCombination {
  player: string;
  cards: Card[];
  type: GuanDanCombinationType;
  mainRank: number;
  bombSize?: number;
}

export interface GuanDanPlayerInfo {
  id: string;
  name: string;
  cardCount: number;
  status?: "played" | "passed" | "out";
}

/** Mirrors backend GuanDanPlayerView. All array fields are always present. */
export interface GuanDanPlayerView {
  turn: number;
  state: "WAITING" | "PLAYING" | "ENDED";
  ready: string[];
  /** Stage whose rank is currently wild/trump. Always sent by the server. */
  currentStage: number;
  /** Per-team stage, indexed by team (seat % 2). */
  stage: number[];
  strikes: number[];
  won: string[];
  hand: Card[];
  currentRound: GuanDanCombination[];
  players: GuanDanPlayerInfo[];
  isFinished: boolean;
  winnerIds: string[];
}

export type GuanDanAction =
  | { type: "READY" }
  | { type: "PLAY"; payload: { cardIds: string[] } }
  | { type: "PASS" };

