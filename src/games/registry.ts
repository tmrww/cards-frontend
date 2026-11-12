import { guandanModule } from "./guandan/GuanDanView";
import { placeholderModule } from "./placeholder/PlaceholderView";
import type { GameModule } from "./types";

// Each game narrows its own view/action types; the registry only needs the shell contract.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGameModule = GameModule<any, any>;

/** Register new games here. The first entry is the lobby default. */
export const GAME_MODULES: AnyGameModule[] = [guandanModule, placeholderModule];

export const getGameModule = (id: string | null): AnyGameModule | undefined =>
  GAME_MODULES.find((m) => m.id === id);

/** Games offered in the lobby dropdown. Dev-only games are hidden in production builds. */
export const listLobbyGames = (includeDevOnly: boolean = import.meta.env.DEV): AnyGameModule[] =>
  GAME_MODULES.filter((m) => includeDevOnly || !m.devOnly);

