import type { Card } from "../../types";
import { isJokerCard } from "../../utils/cards";
import type { GuanDanCombinationType, GuanDanPlayerView } from "./types";

const HEARTS = 1;
const SMALL_JOKER_RANK = 16;
const BIG_JOKER_RANK = 17;
const STAGE_CARD_RANK = 15;
const ACE_RANK = 14;
const FOUR_JOKERS_POWER = 9;
const STRAIGHT_FLUSH_POWER = 5.5;

/** The heart of the current stage is the wildcard. */
export const isWildcard = (card: Card, currentStage: number): boolean =>
  card.suit.id === HEARTS && card.value.value === currentStage;

/**
 * Single-card power hierarchy matching backend GuanDanGame.ts:
 * 2..K (2..13) < Ace (14) < Stage Card (15) < Small Joker (16) < Big Joker (17)
 */
export function getCardRank(card: Card, currentStage: number): number {
  if (card.suit.id === -2) return BIG_JOKER_RANK;
  if (card.suit.id === -1) return SMALL_JOKER_RANK;
  if (card.value.value === currentStage) return STAGE_CARD_RANK;
  if (card.value.value === 1) return ACE_RANK;
  return card.value.value;
}

const COMBO_LABELS: Record<GuanDanCombinationType, string> = {
  SINGLE: "Single",
  PAIR: "Pair",
  TRIPLE: "Triple",
  FULL_HOUSE: "Full House (3+2)",
  STRAIGHT: "Straight (5)",
  CONSECUTIVE_PAIRS: "Consecutive Pairs (3x2)",
  CONSECUTIVE_TRIPLES: "Consecutive Triples (2x3)",
  BOMB: "Bomb",
  STRAIGHT_BOMB: "Straight Flush Bomb",
  FOUR_JOKERS: "Four Jokers (Max Bomb)",
};

export const formatComboType = (type: GuanDanCombinationType): string =>
  COMBO_LABELS[type] ?? type;

/**
 * Default sort: lowest to highest rank, grouped by value.
 * Within the same value, wildcards go to the right, then suits, then id.
 */
export function sortCardsLowToHigh(cards: Card[], currentStage: number): Card[] {
  return [...cards].sort(
    (a, b) =>
      getCardRank(a, currentStage) - getCardRank(b, currentStage) ||
      Number(isWildcard(a, currentStage)) - Number(isWildcard(b, currentStage)) ||
      a.suit.id - b.suit.id ||
      a.id.localeCompare(b.id)
  );
}

/** Card values of a 5-card straight starting at `start` (an Ace may be high: 10-J-Q-K-A). */
const straightValues = (start: number): number[] =>
  [0, 1, 2, 3, 4].map((offset) => {
    const v = start + offset;
    return v === 14 ? 1 : v;
  });

const STRAIGHT_STARTS_HIGH_TO_LOW = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

interface BombGroup {
  power: number;
  rank: number;
  cards: Card[];
}

/**
 * Auto-sorts out bombs (4+ of a kind, 5-card Straight Flushes, and Four Jokers)
 * and places them at the end of the hand in ascending bomb strength order.
 * Non-bomb cards remain sorted lowest to highest, grouped by value, at the front.
 */
export function sortBombsToEnd(
  cards: Card[],
  currentStage: number
): { sorted: Card[]; bombGroupMap: Map<string, number> } {
  const bombGroups: BombGroup[] = [];
  const usedIds = new Set<string>();

  const addGroup = (group: BombGroup) => {
    bombGroups.push(group);
    for (const c of group.cards) usedIds.add(c.id);
  };

  // 1. Four Jokers
  const jokers = cards.filter(isJokerCard);
  if (jokers.length === 4) {
    addGroup({
      power: FOUR_JOKERS_POWER,
      rank: BIG_JOKER_RANK,
      cards: sortCardsLowToHigh(jokers, currentStage),
    });
  }

  // 2. 4+ of a kind (grouped by value)
  const byValue = new Map<number, Card[]>();
  for (const card of cards) {
    if (usedIds.has(card.id) || isJokerCard(card)) continue;
    byValue.set(card.value.value, [...(byValue.get(card.value.value) ?? []), card]);
  }
  for (const group of byValue.values()) {
    if (group.length < 4) continue;
    const sortedGroup = sortCardsLowToHigh(group, currentStage);
    addGroup({
      power: sortedGroup.length,
      rank: getCardRank(sortedGroup[0], currentStage),
      cards: sortedGroup,
    });
  }

  // 3. 5-card Straight Flushes from remaining non-wildcard cards
  for (const suitId of [0, 1, 2, 3]) {
    const valMap = new Map<number, Card[]>();
    for (const c of cards) {
      if (usedIds.has(c.id) || c.suit.id !== suitId || isWildcard(c, currentStage)) continue;
      valMap.set(c.value.value, [...(valMap.get(c.value.value) ?? []), c]);
    }

    for (const start of STRAIGHT_STARTS_HIGH_TO_LOW) {
      const seq = straightValues(start);
      if (!seq.every((v) => (valMap.get(v)?.length ?? 0) >= 1)) continue;
      addGroup({
        power: STRAIGHT_FLUSH_POWER,
        rank: start + 4,
        cards: seq.map((v) => valMap.get(v)!.shift()!),
      });
    }
  }

  bombGroups.sort((a, b) => a.power - b.power || a.rank - b.rank);

  const bombGroupMap = new Map<string, number>();
  bombGroups.forEach((group, groupIdx) => {
    for (const c of group.cards) bombGroupMap.set(c.id, groupIdx);
  });

  const nonBombCards = sortCardsLowToHigh(
    cards.filter((c) => !usedIds.has(c.id)),
    currentStage
  );
  return {
    sorted: [...nonBombCards, ...bombGroups.flatMap((g) => g.cards)],
    bombGroupMap,
  };
}

/**
 * Checks whether a group of cards still forms a valid bomb:
 * - Four Jokers
 * - 4+ of a kind (all non-wildcard cards share the same value)
 * - 5-card Straight Flush (5 natural cards of one suit with consecutive values)
 */
export function isValidBombGroup(groupCards: Card[], currentStage: number): boolean {
  if (groupCards.length < 4) return false;

  if (groupCards.every(isJokerCard)) return groupCards.length === 4;
  if (groupCards.some(isJokerCard)) return false;

  const naturals = groupCards.filter((c) => !isWildcard(c, currentStage));
  if (naturals.every((c) => c.value.value === naturals[0].value.value)) return true;

  if (
    groupCards.length === 5 &&
    naturals.length === 5 &&
    groupCards.every((c) => c.suit.id === groupCards[0].suit.id)
  ) {
    const values = new Set(groupCards.map((c) => c.value.value));
    return STRAIGHT_STARTS_HIGH_TO_LOW.some((start) =>
      straightValues(start).every((v) => values.has(v))
    );
  }
  return false;
}

/** Index of the player's seat in the view, or 0 when not seated. */
export function getSeatIndex(view: GuanDanPlayerView | null, playerId: string): number {
  return Math.max(0, view?.players.findIndex((p) => p.id === playerId) ?? 0);
}

/** Per-team stage and strikes from the viewer's perspective (teams are seat % 2). */
export function selectTeams(view: GuanDanPlayerView | null, mySeat: number) {
  const pick = (team: number) => ({
    stage: view?.stage[team] ?? 2,
    strikes: view?.strikes[team] ?? 0,
  });
  return { mine: pick(mySeat % 2), opp: pick((mySeat + 1) % 2) };
}

/** True if the team of the first player out is the viewer's team. */
export function didMyTeamWin(view: GuanDanPlayerView, mySeat: number): boolean {
  const winnerIdx = view.players.findIndex((p) => p.id === view.won[0]);
  return winnerIdx !== -1 && winnerIdx % 2 === mySeat % 2;
}

