import { describe, expect, it } from "vitest";
import { card } from "../test/factories";
import {
  formatStageRank,
  getCardShortValue,
  getSuitSymbol,
  isJokerCard,
  isRedCard,
} from "./cards";

describe("formatStageRank", () => {
  it.each([
    [1, "A"],
    [14, "A"],
    [11, "J"],
    [12, "Q"],
    [13, "K"],
    [2, "2"],
    [10, "10"],
  ])("formats %i as %s", (value, label) => {
    expect(formatStageRank(value)).toBe(label);
  });
});

describe("getSuitSymbol", () => {
  it("maps the four suits and both jokers", () => {
    expect([0, 1, 2, 3].map(getSuitSymbol)).toEqual(["♠", "♥", "♦", "♣"]);
    expect(getSuitSymbol(-1)).toBe("★");
    expect(getSuitSymbol(-2)).toBe("★");
  });
  it("returns an empty string for unknown suits", () => {
    expect(getSuitSymbol(99)).toBe("");
  });
});

describe("card predicates", () => {
  it("identifies jokers by negative suit ids", () => {
    expect(isJokerCard(card("a", -1, 0))).toBe(true);
    expect(isJokerCard(card("b", -2, 0))).toBe(true);
    expect(isJokerCard(card("c", 0, 5))).toBe(false);
  });
  it("colors hearts, diamonds and the big joker red", () => {
    expect(isRedCard(card("a", 1, 5))).toBe(true);
    expect(isRedCard(card("b", 2, 5))).toBe(true);
    expect(isRedCard(card("c", -2, 0))).toBe(true);
    expect(isRedCard(card("d", 0, 5))).toBe(false);
    expect(isRedCard(card("e", 3, 5))).toBe(false);
    expect(isRedCard(card("f", -1, 0))).toBe(false);
  });
  it("shows a mask for jokers and the rank otherwise", () => {
    expect(getCardShortValue(card("a", -1, 0))).toBe("🎭");
    expect(getCardShortValue(card("b", 0, 13))).toBe("K");
    expect(getCardShortValue(card("c", 0, 1))).toBe("A");
  });
});

