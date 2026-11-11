import { Card, GuanDanCombinationType } from "../types";

export function isJokerCard(card: Card): boolean {
  return card.suit.id === -1 || card.suit.id === -2;
}

export function isWildcard(card: Card, currentStage: number): boolean {
  return card.suit.id === 1 && card.value.value === currentStage;
}

/**
 * Single-card power hierarchy matching backend GuanDanGame.ts:
 * 2..K (2..13) < Ace (14) < Stage Card (15) < Small Joker (16) < Big Joker (17)
 */
export function getCardRank(card: Card, currentStage: number): number {
  if (card.suit.id === -2) return 17; // Red / Big Joker
  if (card.suit.id === -1) return 16; // Black / Small Joker
  if (card.value.value === currentStage) return 15; // Stage rank
  if (card.value.value === 1) return 14; // Ace
  return card.value.value; // 2..13
}

export function formatStageRank(stageValue: number): string {
  switch (stageValue) {
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
      return String(stageValue);
  }
}

export function formatMainRank(mainRank: number, currentStage: number): string {
  if (mainRank === 17) return "Big Joker";
  if (mainRank === 16) return "Small Joker";
  if (mainRank === 15) return `${formatStageRank(currentStage)} (Stage)`;
  if (mainRank === 14) return "A";
  return formatStageRank(mainRank);
}

export function formatComboType(type: GuanDanCombinationType): string {
  switch (type) {
    case "SINGLE":
      return "Single";
    case "PAIR":
      return "Pair";
    case "TRIPLE":
      return "Triple";
    case "FULL_HOUSE":
      return "Full House (3+2)";
    case "STRAIGHT":
      return "Straight (5)";
    case "CONSECUTIVE_PAIRS":
      return "Consecutive Pairs (3x2)";
    case "CONSECUTIVE_TRIPLES":
      return "Consecutive Triples (2x3)";
    case "BOMB":
      return "Bomb";
    case "STRAIGHT_BOMB":
      return "Straight Flush Bomb";
    case "FOUR_JOKERS":
      return "Four Jokers (Max Bomb)";
    default:
      return type;
  }
}

export function getSuitSymbol(suitId: number): string {
  switch (suitId) {
    case 0:
      return "♠";
    case 1:
      return "♥";
    case 2:
      return "♦";
    case 3:
      return "♣";
    case -1:
      return "★";
    case -2:
      return "★";
    default:
      return "";
  }
}

export function getCardShortValue(card: Card): string {
  if (card.suit.id === -2) return "🎭";
  if (card.suit.id === -1) return "🎭";
  return formatStageRank(card.value.value);
}

export function isRedCard(card: Card): boolean {
  return card.suit.id === 1 || card.suit.id === 2 || card.suit.id === -2;
}

/**
 * Default sort: lowest to highest rank, grouped by value.
 * Within the same value, suits are ordered consistently (and wildcards placed at the right of the stage group).
 */
export function sortCardsLowToHigh(cards: Card[], currentStage: number): Card[] {
  return [...cards].sort((a, b) => {
    const rankA = getCardRank(a, currentStage);
    const rankB = getCardRank(b, currentStage);
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    const wildA = isWildcard(a, currentStage) ? 1 : 0;
    const wildB = isWildcard(b, currentStage) ? 1 : 0;
    if (wildA !== wildB) {
      return wildA - wildB;
    }
    if (a.suit.id !== b.suit.id) {
      return a.suit.id - b.suit.id;
    }
    return a.id.localeCompare(b.id);
  });
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
  const bombGroups: { power: number; rank: number; cards: Card[] }[] = [];
  const usedIds = new Set<string>();

  // 1. Check for Four Jokers bomb (all 4 jokers present)
  const jokers = cards.filter((c) => isJokerCard(c));
  if (jokers.length === 4) {
    const sortedJokers = sortCardsLowToHigh(jokers, currentStage);
    bombGroups.push({
      power: 9,
      rank: 17,
      cards: sortedJokers,
    });
    for (const c of sortedJokers) usedIds.add(c.id);
  }

  // 2. Check for 4+ of a kind natural bombs (grouped by value.value)
  const byValue = new Map<number, Card[]>();
  for (const card of cards) {
    if (usedIds.has(card.id) || isJokerCard(card)) continue;
    const list = byValue.get(card.value.value) ?? [];
    list.push(card);
    byValue.set(card.value.value, list);
  }

  for (const [val, group] of byValue.entries()) {
    if (group.length >= 4) {
      const sortedGroup = sortCardsLowToHigh(group, currentStage);
      bombGroups.push({
        power: sortedGroup.length,
        rank: getCardRank(sortedGroup[0], currentStage),
        cards: sortedGroup,
      });
      for (const c of sortedGroup) usedIds.add(c.id);
      byValue.delete(val);
    }
  }

  // 3. Check remaining non-wildcard standard cards for 5-card Straight Flush bombs (STRAIGHT_BOMB, power = 5.5)
  for (const suitId of [0, 1, 2, 3]) {
    const suitCards = cards.filter(
      (c) =>
        !usedIds.has(c.id) &&
        c.suit.id === suitId &&
        !isWildcard(c, currentStage)
    );
    if (suitCards.length < 5) continue;

    // Map value -> available cards in this suit
    const valMap = new Map<number, Card[]>();
    for (const c of suitCards) {
      const list = valMap.get(c.value.value) ?? [];
      list.push(c);
      valMap.set(c.value.value, list);
    }

    // Search sequences from Ace-high (10-J-Q-K-A, start=10) down to Ace-low (A-2-3-4-5, start=1)
    for (let start = 10; start >= 1; start--) {
      const seqValues = [0, 1, 2, 3, 4].map((offset) => {
        const v = start + offset;
        return v === 14 ? 1 : v;
      });
      if (seqValues.every((v) => (valMap.get(v)?.length ?? 0) >= 1)) {
        const sfCards: Card[] = [];
        for (const v of seqValues) {
          const picked = valMap.get(v)!.shift()!;
          usedIds.add(picked.id);
          sfCards.push(picked);
        }
        bombGroups.push({
          power: 5.5,
          rank: start + 4,
          cards: sfCards,
        });
      }
    }
  }

  // Sort bomb groups by power ascending, then rank ascending
  bombGroups.sort((a, b) => a.power - b.power || a.rank - b.rank);

  const bombGroupMap = new Map<string, number>();
  bombGroups.forEach((group, groupIdx) => {
    for (const c of group.cards) {
      bombGroupMap.set(c.id, groupIdx);
    }
  });

  const nonBombCards = sortCardsLowToHigh(
    cards.filter((c) => !usedIds.has(c.id)),
    currentStage
  );

  const bombCards = bombGroups.flatMap((g) => g.cards);
  return {
    sorted: [...nonBombCards, ...bombCards],
    bombGroupMap,
  };
}

