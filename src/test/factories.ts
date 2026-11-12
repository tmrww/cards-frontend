import type { Card } from "../types";
import type { GuanDanPlayerView } from "../games/guandan/types";

const SUIT_NAMES: Record<number, string> = {
  0: "Spades",
  1: "Hearts",
  2: "Diamonds",
  3: "Clubs",
  [-1]: "Black Joker",
  [-2]: "Red Joker",
};

/** Test card. Suit ids: 0 ♠, 1 ♥, 2 ♦, 3 ♣, -1 small joker, -2 big joker. Value 1 is the Ace. */
export const card = (id: string, suitId: number, value: number): Card => ({
  id,
  faceUp: true,
  suit: { id: suitId, name: SUIT_NAMES[suitId] },
  value: { value, name: String(value) },
});

export const makeView = (overrides: Partial<GuanDanPlayerView> = {}): GuanDanPlayerView => ({
  turn: 0,
  state: "WAITING",
  ready: [],
  currentStage: 2,
  stage: [2, 2],
  strikes: [0, 0],
  won: [],
  hand: [],
  currentRound: [],
  players: [
    { id: "p0", name: "Ann", cardCount: 0 },
    { id: "p1", name: "Bob", cardCount: 0 },
    { id: "p2", name: "Cy", cardCount: 0 },
    { id: "p3", name: "Di", cardCount: 0 },
  ],
  isFinished: false,
  winnerIds: [],
  ...overrides,
});

