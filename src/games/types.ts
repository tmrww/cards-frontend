import type React from "react";
import type { ChatMessage } from "../types";

/** Props every game view receives from the app shell. `V` is the view, `A` the action union. */
export interface GameViewProps<V, A> {
  roomId: string;
  playerId: string;
  /** Latest state from the server; null until the first update arrives. */
  view: V | null;
  chatMessages: ChatMessage[];
  error: string | null;
  sendAction: (action: A) => void;
  sendChat: (text: string) => void;
  clearError: () => void;
  leaveRoom: () => void;
}

/** A game plugged into the app. `id` must equal the backend game type. */
export interface GameModule<V = unknown, A = unknown> {
  id: string;
  label: string;
  /** Only offered in the lobby dropdown during development. */
  devOnly?: boolean;
  View: React.ComponentType<GameViewProps<V, A>>;
}

