import { describe, expect, it } from "vitest";
import { card } from "../../test/factories";
import { isNewDeal, reconcileBombGroups, reconcileHand } from "./reconcileHand";

const STAGE = 2;
const ids = (cards: { id: string }[]) => cards.map((c) => c.id);

describe("isNewDeal", () => {
  const hand = [card("a", 0, 3)];
  it("is true for an empty previous order", () => {
    expect(isNewDeal([], hand, "PLAYING", "PLAYING")).toBe(true);
  });
  it("is true when the server hand grew", () => {
    expect(isNewDeal(hand, [...hand, card("b", 0, 4)], "PLAYING", "PLAYING")).toBe(true);
  });
  it("is true when the game goes from WAITING to PLAYING", () => {
    expect(isNewDeal(hand, hand, "WAITING", "PLAYING")).toBe(true);
  });
  it("is false when cards were only removed", () => {
    expect(isNewDeal([card("a", 0, 3), card("b", 0, 4)], hand, "PLAYING", "PLAYING")).toBe(false);
  });
});

describe("reconcileHand", () => {
  const a = card("a", 0, 3);
  const b = card("b", 0, 9);
  const c = card("c", 0, 5);

  it("keeps the player's custom order for surviving cards", () => {
    const hand = reconcileHand([c, a, b], [a, b, c], STAGE);
    expect(ids(hand)).toEqual(["c", "a", "b"]);
  });

  it("drops cards the server no longer has", () => {
    expect(ids(reconcileHand([c, a, b], [a, c], STAGE))).toEqual(["c", "a"]);
  });

  it("appends new cards after the existing ones, sorted", () => {
    const d = card("d", 0, 12);
    const e = card("e", 0, 4);
    expect(ids(reconcileHand([b, a], [a, b, d, e], STAGE))).toEqual(["b", "a", "e", "d"]);
  });

  it("removes played cards accurately by exact ID", () => {
    const p = card("p", 0, 7);
    const hand = reconcileHand([a, p, b], [a, b], STAGE);
    expect(ids(hand)).toEqual(["a", "b"]);
  });

  it("does not mutate its inputs", () => {
    const prev = [c, a];
    reconcileHand(prev, [a, c], STAGE);
    expect(ids(prev)).toEqual(["c", "a"]);
  });
});

describe("reconcileBombGroups", () => {
  const four = [0, 1, 2, 3].map((s) => card(`k${s}`, s, 13));

  it("returns the same (empty) map untouched", () => {
    const empty = new Map<string, number>();
    expect(reconcileBombGroups(empty, four, STAGE)).toBe(empty);
  });

  it("keeps groups that are still bombs", () => {
    const prev = new Map(four.map((c) => [c.id, 0]));
    const next = reconcileBombGroups(prev, four, STAGE);
    expect([...next.entries()].sort()).toEqual([...prev.entries()].sort());
  });

  it("drops a group once it is broken", () => {
    const prev = new Map(four.map((c) => [c.id, 0]));
    expect(reconcileBombGroups(prev, four.slice(0, 3), STAGE).size).toBe(0);
  });

  it("ignores cards that are gone and keeps other groups", () => {
    const pair = [card("x1", 0, 3), card("x2", 1, 3), card("x3", 2, 3), card("x4", 3, 3)];
    const prev = new Map<string, number>([
      ...four.map((c) => [c.id, 0] as [string, number]),
      ...pair.map((c) => [c.id, 1] as [string, number]),
    ]);
    const next = reconcileBombGroups(prev, [...four.slice(0, 2), ...pair], STAGE);
    expect([...next.keys()].sort()).toEqual(["x1", "x2", "x3", "x4"]);
  });
});
