import { describe, expect, it } from "vitest";
import { card, makeView } from "../../test/factories";
import {
  didMyTeamWin,
  formatComboType,
  getCardRank,
  getSeatIndex,
  isValidBombGroup,
  isWildcard,
  selectTeams,
  sortBombsToEnd,
  sortCardsLowToHigh,
} from "./rules";

const STAGE = 5;
const ids = (cards: { id: string }[]) => cards.map((c) => c.id);

describe("isWildcard", () => {
  it("is only the heart of the current stage", () => {
    expect(isWildcard(card("a", 1, STAGE), STAGE)).toBe(true);
    expect(isWildcard(card("b", 0, STAGE), STAGE)).toBe(false);
    expect(isWildcard(card("c", 1, 6), STAGE)).toBe(false);
  });
});

describe("getCardRank", () => {
  it("orders 2..K < Ace < stage card < small joker < big joker", () => {
    const rank = (c: ReturnType<typeof card>) => getCardRank(c, STAGE);
    expect(rank(card("a", 0, 13))).toBe(13);
    expect(rank(card("b", 0, 1))).toBe(14);
    expect(rank(card("c", 0, STAGE))).toBe(15);
    expect(rank(card("d", -1, 0))).toBe(16);
    expect(rank(card("e", -2, 0))).toBe(17);
  });
  it("treats an Ace stage as the stage card, not an ordinary Ace", () => {
    expect(getCardRank(card("a", 0, 1), 1)).toBe(15);
  });
});

describe("formatComboType", () => {
  it("returns readable labels", () => {
    expect(formatComboType("FULL_HOUSE")).toBe("Full House (3+2)");
    expect(formatComboType("FOUR_JOKERS")).toBe("Four Jokers (Max Bomb)");
  });
});

describe("sortCardsLowToHigh", () => {
  it("sorts by rank with the stage cards, then jokers, last", () => {
    const hand = [
      card("big", -2, 0),
      card("stage", 0, STAGE),
      card("ace", 0, 1),
      card("three", 0, 3),
      card("small", -1, 0),
      card("king", 0, 13),
    ];
    expect(ids(sortCardsLowToHigh(hand, STAGE))).toEqual([
      "three",
      "king",
      "ace",
      "stage",
      "small",
      "big",
    ]);
  });

  it("puts the wildcard to the right of other stage-rank cards, then orders by suit", () => {
    const hand = [card("wild", 1, STAGE), card("club", 3, STAGE), card("spade", 0, STAGE)];
    expect(ids(sortCardsLowToHigh(hand, STAGE))).toEqual(["spade", "club", "wild"]);
  });

  it("does not mutate the input and handles an empty hand", () => {
    const hand = [card("b", 0, 9), card("a", 0, 3)];
    sortCardsLowToHigh(hand, STAGE);
    expect(ids(hand)).toEqual(["b", "a"]);
    expect(sortCardsLowToHigh([], STAGE)).toEqual([]);
  });
});

describe("sortBombsToEnd", () => {
  it("returns plain sorted cards and no groups when there are no bombs", () => {
    const hand = [card("a", 0, 9), card("b", 1, 3)];
    const { sorted, bombGroupMap } = sortBombsToEnd(hand, STAGE);
    expect(ids(sorted)).toEqual(["b", "a"]);
    expect(bombGroupMap.size).toBe(0);
  });

  it("handles an empty hand", () => {
    const { sorted, bombGroupMap } = sortBombsToEnd([], STAGE);
    expect(sorted).toEqual([]);
    expect(bombGroupMap.size).toBe(0);
  });

  it("moves a four-of-a-kind to the end and groups it", () => {
    const hand = [
      card("k1", 0, 13),
      card("k2", 1, 13),
      card("k3", 2, 13),
      card("k4", 3, 13),
      card("three", 0, 3),
      card("nine", 0, 9),
    ];
    const { sorted, bombGroupMap } = sortBombsToEnd(hand, STAGE);
    expect(ids(sorted).slice(0, 2)).toEqual(["three", "nine"]);
    expect(new Set(ids(sorted).slice(2))).toEqual(new Set(["k1", "k2", "k3", "k4"]));
    expect([...bombGroupMap.values()]).toEqual([0, 0, 0, 0]);
  });

  it("orders bombs by size, then rank", () => {
    const four9 = [0, 1, 2, 3].map((s) => card(`n${s}`, s, 9));
    const five3 = [0, 1, 2, 3, 0].map((s, i) => card(`t${i}`, s, 3));
    const four7 = [0, 1, 2, 3].map((s) => card(`s${s}`, s, 7));
    const { sorted, bombGroupMap } = sortBombsToEnd([...five3, ...four9, ...four7], STAGE);
    expect(ids(sorted).map((id) => id[0]).join("")).toBe("ssssnnnnttttt");
    expect(bombGroupMap.get("s0")).toBe(0);
    expect(bombGroupMap.get("n0")).toBe(1);
    expect(bombGroupMap.get("t0")).toBe(2);
  });

  it("finds a five-card straight flush", () => {
    const flush = [3, 4, 5, 6, 7].map((v) => card(`f${v}`, 2, v));
    const { bombGroupMap, sorted } = sortBombsToEnd([...flush, card("x", 0, 9)], 13);
    expect(ids(sorted)[0]).toBe("x");
    expect([...bombGroupMap.keys()].sort()).toEqual(["f3", "f4", "f5", "f6", "f7"]);
  });

  it("finds an ace-high and an ace-low straight flush", () => {
    const high = [10, 11, 12, 13, 1].map((v) => card(`h${v}`, 0, v));
    const low = [1, 2, 3, 4, 5].map((v) => card(`l${v}`, 3, v));
    expect(sortBombsToEnd(high, 7).bombGroupMap.size).toBe(5);
    expect(sortBombsToEnd(low, 7).bombGroupMap.size).toBe(5);
  });

  it("does not use the wildcard in a straight flush", () => {
    const flush = [3, 4, 5, 6].map((v) => card(`f${v}`, 1, v));
    const wild = card("wild", 1, 7);
    expect(sortBombsToEnd([...flush, wild], 7).bombGroupMap.size).toBe(0);
  });

  it("recognizes four jokers as the strongest bomb", () => {
    const jokers = [card("j1", -1, 0), card("j2", -1, 0), card("j3", -2, 0), card("j4", -2, 0)];
    const four2 = [0, 1, 2, 3].map((s) => card(`b${s}`, s, 2));
    const { sorted, bombGroupMap } = sortBombsToEnd([...jokers, ...four2], STAGE);
    expect(ids(sorted).slice(-4).sort()).toEqual(["j1", "j2", "j3", "j4"]);
    expect(bombGroupMap.get("b0")).toBe(0);
    expect(bombGroupMap.get("j1")).toBe(1);
  });

  it("does not treat three jokers as a bomb", () => {
    const jokers = [card("j1", -1, 0), card("j2", -1, 0), card("j3", -2, 0)];
    expect(sortBombsToEnd(jokers, STAGE).bombGroupMap.size).toBe(0);
  });
});

describe("isValidBombGroup", () => {
  it("rejects groups smaller than four", () => {
    expect(isValidBombGroup([card("a", 0, 9), card("b", 1, 9), card("c", 2, 9)], STAGE)).toBe(false);
  });
  it("accepts four or more of a kind", () => {
    const four = [0, 1, 2, 3].map((s) => card(`a${s}`, s, 9));
    expect(isValidBombGroup(four, STAGE)).toBe(true);
    expect(isValidBombGroup([...four, card("a4", 0, 9)], STAGE)).toBe(true);
  });
  it("allows the wildcard to stand in for a natural card", () => {
    const group = [card("a", 0, 9), card("b", 1, 9), card("c", 2, 9), card("wild", 1, STAGE)];
    expect(isValidBombGroup(group, STAGE)).toBe(true);
  });
  it("rejects mixed values and mixed jokers", () => {
    expect(isValidBombGroup([card("a", 0, 9), card("b", 1, 9), card("c", 2, 9), card("d", 3, 8)], STAGE)).toBe(false);
    expect(isValidBombGroup([card("a", 0, 9), card("b", 1, 9), card("c", 2, 9), card("j", -1, 0)], STAGE)).toBe(false);
  });
  it("accepts exactly four jokers", () => {
    const jokers = [card("j1", -1, 0), card("j2", -1, 0), card("j3", -2, 0), card("j4", -2, 0)];
    expect(isValidBombGroup(jokers, STAGE)).toBe(true);
  });
  it("accepts a five-card straight flush and rejects a broken one", () => {
    const flush = [3, 4, 5, 6, 7].map((v) => card(`f${v}`, 0, v));
    expect(isValidBombGroup(flush, 13)).toBe(true);
    const broken = [3, 4, 5, 6, 9].map((v) => card(`g${v}`, 0, v));
    expect(isValidBombGroup(broken, 13)).toBe(false);
    const mixedSuit = [3, 4, 5, 6, 7].map((v, i) => card(`m${v}`, i % 2, v));
    expect(isValidBombGroup(mixedSuit, 13)).toBe(false);
  });
});

describe("view helpers", () => {
  it("getSeatIndex finds the seat, or falls back to 0", () => {
    const view = makeView();
    expect(getSeatIndex(view, "p2")).toBe(2);
    expect(getSeatIndex(view, "nobody")).toBe(0);
    expect(getSeatIndex(null, "p2")).toBe(0);
  });

  it("selectTeams orients stage and strikes to the viewer's team", () => {
    const view = makeView({ stage: [5, 9], strikes: [1, 2] });
    expect(selectTeams(view, 0)).toEqual({ mine: { stage: 5, strikes: 1 }, opp: { stage: 9, strikes: 2 } });
    expect(selectTeams(view, 3)).toEqual({ mine: { stage: 9, strikes: 2 }, opp: { stage: 5, strikes: 1 } });
    expect(selectTeams(null, 0)).toEqual({ mine: { stage: 2, strikes: 0 }, opp: { stage: 2, strikes: 0 } });
  });

  it("didMyTeamWin compares the first player out's team (seat % 2)", () => {
    const view = makeView({ won: ["p1", "p0"] });
    expect(didMyTeamWin(view, 1)).toBe(true);
    expect(didMyTeamWin(view, 3)).toBe(true);
    expect(didMyTeamWin(view, 0)).toBe(false);
    expect(didMyTeamWin(makeView({ won: [] }), 0)).toBe(false);
  });
});
