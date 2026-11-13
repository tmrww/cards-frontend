import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// sound.ts keeps module-level cooldown state, so each test gets a fresh module.
const played: string[] = [];

class FakeAudio {
  currentTime = 0;
  constructor(public src: string) {
    played.push(src);
  }
  play() {
    return Promise.resolve();
  }
  pause() {}
}

async function loadSound() {
  vi.resetModules();
  return import("./sound");
}

beforeEach(() => {
  played.length = 0;
  vi.stubGlobal("Audio", FakeAudio);
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("triggerTextSound", () => {
  it("matches an exact key", async () => {
    const { triggerTextSound } = await loadSound();
    expect(triggerTextSound("mi_bomba", "ann")).toBe(true);
    expect(played).toEqual(["/sounds/mi_bomba.mp3"]);
  });

  it("matches a message written as spaced words with punctuation", async () => {
    const { triggerTextSound } = await loadSound();
    expect(triggerTextSound("Well, Done!", "ann")).toBe(true);
    expect(played).toEqual(["/sounds/well_done.wav"]);
  });

  it("matches a key inside a longer message, with spaces or underscores", async () => {
    const { triggerTextSound } = await loadSound();
    expect(triggerTextSound("wow mi bomba is coming", "ann")).toBe(true);
    expect(triggerTextSound("say well_done to him", "bob")).toBe(true);
    expect(played).toEqual(["/sounds/mi_bomba.mp3", "/sounds/well_done.wav"]);
  });

  it("is case-insensitive", async () => {
    const { triggerTextSound } = await loadSound();
    expect(triggerTextSound("MI BOMBA", "ann")).toBe(true);
  });

  it("ignores blank and unmatched messages", async () => {
    const { triggerTextSound } = await loadSound();
    expect(triggerTextSound("   ", "ann")).toBe(false);
    expect(triggerTextSound("hello there", "ann")).toBe(false);
    expect(played).toEqual([]);
  });

  it("applies a per-sender cooldown", async () => {
    const { triggerTextSound, SOUND_COOLDOWN_MS } = await loadSound();
    expect(triggerTextSound("mi_bomba", "ann")).toBe(true);
    expect(triggerTextSound("mi_bomba", "ann")).toBe(false);
    expect(triggerTextSound("mi_bomba", "bob")).toBe(true);
    vi.advanceTimersByTime(SOUND_COOLDOWN_MS);
    expect(triggerTextSound("mi_bomba", "ann")).toBe(true);
  });
});

describe("playGameSound", () => {
  it("plays a configured sound and ignores unknown keys", async () => {
    const { playGameSound } = await loadSound();
    playGameSound("card_play", "p1");
    playGameSound("nope", "p1");
    expect(played).toEqual(["/sounds/card_play.wav"]);
  });

  it("has no cooldown and plays repeatedly within 5000ms", async () => {
    const { playGameSound, SOUND_COOLDOWN_MS } = await loadSound();
    expect(SOUND_COOLDOWN_MS).toBe(5000);
    playGameSound("pass", "p1");
    vi.advanceTimersByTime(100);
    playGameSound("pass", "p1");
    playGameSound("pass", "p2");
    playGameSound("round_win");
    playGameSound("round_win");
    expect(played).toEqual([
      "/sounds/pass.wav",
      "/sounds/pass.wav",
      "/sounds/pass.wav",
      "/sounds/round_win.wav",
      "/sounds/round_win.wav",
    ]);
  });

  it("respects game and chat sound toggles independently", async () => {
    const { playGameSound, triggerTextSound, setGameSoundsEnabled, setChatSoundsEnabled } =
      await loadSound();
    setGameSoundsEnabled(false);
    playGameSound("card_play", "p1");
    expect(triggerTextSound("mi_bomba", "ann")).toBe(true);
    expect(played).toEqual(["/sounds/mi_bomba.mp3"]);

    setGameSoundsEnabled(true);
    setChatSoundsEnabled(false);
    expect(triggerTextSound("well_done", "bob")).toBe(false);
    playGameSound("pass", "p2");
    expect(played).toEqual(["/sounds/mi_bomba.mp3", "/sounds/pass.wav"]);
  });
});

