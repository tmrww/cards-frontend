import type { Card } from "../../types";
import { isValidBombGroup, sortCardsLowToHigh } from "./rules";

/** True when the server hand should replace the player's custom order (new deal). */
export function isNewDeal(
  prevOrder: Card[],
  serverHand: Card[],
  prevState: string | undefined,
  state: string
): boolean {
  return (
    prevOrder.length === 0 ||
    serverHand.length > prevOrder.length ||
    (prevState === "WAITING" && state === "PLAYING")
  );
}

/**
 * Merges the server's hand into the player's custom order, keeping that order.
 * Since backend Deck.removeCard now removes by exact Card ID, remaining cards
 * keep their exact IDs and positions.
 */
export function reconcileHand(
  prevOrder: Card[],
  serverHand: Card[],
  stage: number
): Card[] {
  const serverById = new Map(serverHand.map((c) => [c.id, c]));
  const kept = prevOrder.flatMap((c) => serverById.get(c.id) ?? []);
  const keptIds = new Set(kept.map((c) => c.id));
  const added = serverHand.filter((c) => !keptIds.has(c.id));
  return added.length > 0 ? [...kept, ...sortCardsLowToHigh(added, stage)] : kept;
}

/** Drops bomb-group colors for groups that were broken by played cards. */
export function reconcileBombGroups(
  prev: Map<string, number>,
  serverHand: Card[],
  stage: number
): Map<string, number> {
  if (prev.size === 0) return prev;
  const serverById = new Map(serverHand.map((c) => [c.id, c]));

  const groups = new Map<number, Card[]>();
  for (const [id, groupIdx] of prev) {
    const card = serverById.get(id);
    if (card) {
      groups.set(groupIdx, [...(groups.get(groupIdx) ?? []), card]);
    }
  }

  const validated = new Map<string, number>();
  for (const [groupIdx, cards] of groups) {
    if (isValidBombGroup(cards, stage)) {
      for (const c of cards) validated.set(c.id, groupIdx);
    }
  }
  return validated;
}
