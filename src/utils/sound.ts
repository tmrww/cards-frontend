export interface SoundConfig {
  gameSounds: Record<string, string>;
  textSounds: Record<string, string>;
}

const DEFAULT_SOUND_CONFIG: SoundConfig = {
  gameSounds: {
    your_turn: "/sounds/your_turn.wav",
    card_play: "/sounds/card_play.wav",
    pass: "/sounds/pass.wav",
    round_win: "/sounds/round_win.wav",
    round_lose: "/sounds/round_lose.mp3",
  },
  textSounds: {
    mi_bomba: "/sounds/mi_bomba.mp3",
    well_done: "/sounds/well_done.wav",
  },
};

export const SOUND_COOLDOWN_MS = 5000;

let cachedConfig: SoundConfig | null = null;
let configPromise: Promise<SoundConfig> | null = null;
let activeAudio: HTMLAudioElement | null = null;
const lastSoundTimeBySource = new Map<string, number>();

export async function loadSoundConfig(): Promise<SoundConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }
  if (configPromise) {
    return configPromise;
  }

  configPromise = fetch("/sounds/sounds.json")
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`Failed to fetch sounds.json: ${res.status}`);
      }
      const data = (await res.json()) as Partial<SoundConfig>;
      cachedConfig = {
        gameSounds: {
          ...DEFAULT_SOUND_CONFIG.gameSounds,
          ...(data.gameSounds ?? {}),
        },
        textSounds: {
          ...DEFAULT_SOUND_CONFIG.textSounds,
          ...(data.textSounds ?? {}),
        },
      };
      return cachedConfig;
    })
    .catch(() => {
      cachedConfig = DEFAULT_SOUND_CONFIG;
      return cachedConfig;
    });

  return configPromise;
}

function isOnCooldown(sourceId: string, now: number): boolean {
  const lastTime = lastSoundTimeBySource.get(sourceId);
  return lastTime !== undefined && now - lastTime < SOUND_COOLDOWN_MS;
}

function playAudioFile(filePath: string): void {
  if (typeof Audio === "undefined") {
    return;
  }

  try {
    if (activeAudio) {
      activeAudio.pause();
      activeAudio.currentTime = 0;
      activeAudio = null;
    }

    const audio = new Audio(filePath);
    activeAudio = audio;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch((err: unknown) => {
        console.warn(`[Audio] Failed to play "${filePath}":`, err);
      });
    }
  } catch (err: unknown) {
    console.warn(`[Audio] Error creating audio for "${filePath}":`, err);
  }
}

export function playGameSound(soundKey: string, sourceId?: string): void {
  const config = cachedConfig ?? DEFAULT_SOUND_CONFIG;
  const filePath = config.gameSounds[soundKey];
  if (!filePath) {
    return;
  }

  const effectiveSource = sourceId || `game:${soundKey}`;
  const now = Date.now();
  if (isOnCooldown(effectiveSource, now)) {
    return;
  }

  lastSoundTimeBySource.set(effectiveSource, now);
  playAudioFile(filePath);
}

export function triggerTextSound(
  messageText: string,
  senderIdOrName: string
): boolean {
  const text = messageText.trim().toLowerCase();
  if (!text) {
    return false;
  }

  const { textSounds } = cachedConfig ?? DEFAULT_SOUND_CONFIG;
  // Exact key ("mi_bomba"), then the message as a snake_case key ("Mi bomba!"),
  // then the first key found anywhere in the message, as written or with spaces.
  const underscored = text.split(/[^a-z0-9_]+/).filter(Boolean).join("_");
  const matchedPath =
    textSounds[text] ||
    textSounds[underscored] ||
    Object.entries(textSounds).find(([key]) => {
      const k = key.toLowerCase();
      return text.includes(k) || text.includes(k.replace(/_/g, " "));
    })?.[1];

  if (!matchedPath) {
    return false;
  }

  const sourceId = `text:${senderIdOrName || "local"}`;
  const now = Date.now();
  if (isOnCooldown(sourceId, now)) {
    return false;
  }

  lastSoundTimeBySource.set(sourceId, now);
  playAudioFile(matchedPath);
  return true;
}
