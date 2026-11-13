import { describe, expect, it } from "vitest";
import { GAME_MODULES, getGameModule, listLobbyGames } from "./registry";

describe("game registry", () => {
  it("has unique ids, labels and a View for every module", () => {
    const ids = GAME_MODULES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of GAME_MODULES) {
      expect(m.label).toBeTruthy();
      expect(m.View).toBeTypeOf("function");
    }
  });

  it("registers guandan and the dev-only placeholder", () => {
    expect(getGameModule("guandan")?.devOnly).toBeFalsy();
    expect(getGameModule("placeholder")?.devOnly).toBe(true);
  });

  it("returns undefined for unknown or missing ids", () => {
    expect(getGameModule("nope")).toBeUndefined();
    expect(getGameModule(null)).toBeUndefined();
  });

  it("hides dev-only games from the lobby unless requested, with guandan first", () => {
    expect(listLobbyGames(false).map((m) => m.id)).toEqual(["guandan", "speed"]);
    expect(listLobbyGames(true).map((m) => m.id)).toEqual(["guandan", "speed", "placeholder"]);
  });
});

