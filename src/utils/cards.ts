import type { Card } from "../types";

/** Rank label used for stages and card faces: A, 2..10, J, Q, K. */
export function formatStageRank(value: number): string {
  switch (value) {
    case 1:
    case 14:
      return "A";
    case 11:
      return "J";
    case 12:
      return "Q";
    case 13:
      return "K";
    default:
      return String(value);
  }
}

const SUIT_SYMBOLS: Record<number, string> = {
  0: "♠",
  1: "♥",
  2: "♦",
  3: "♣",
  [-1]: "★",
  [-2]: "★",
};

export const getSuitSymbol = (suitId: number): string => SUIT_SYMBOLS[suitId] ?? "";

/** Black (-1) and red (-2) jokers use suit ids below zero. */
export const isJokerCard = (card: Card): boolean => card.suit.id < 0;

export const getCardShortValue = (card: Card): string =>
  isJokerCard(card) ? "🎭" : formatStageRank(card.value.value);

/** Hearts, diamonds and the red (big) joker. */
export const isRedCard = (card: Card): boolean => [1, 2, -2].includes(card.suit.id);
