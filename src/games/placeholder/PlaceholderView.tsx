import React from "react";
import type { GameModule, GameViewProps } from "../types";

/**
 * Throwaway game used only to exercise the registry: shows the raw view.
 * Dev-only; the backend has no matching game type.
 */
const PlaceholderView: React.FC<GameViewProps<unknown, unknown>> = ({ roomId, view, leaveRoom }) => (
  <div data-testid="placeholder-view">
    <p>
      Placeholder game in room <strong>{roomId}</strong>
    </p>
    <pre>{JSON.stringify(view, null, 2)}</pre>
    <button type="button" onClick={leaveRoom}>
      Leave Room
    </button>
  </div>
);

export const placeholderModule: GameModule = {
  id: "placeholder",
  label: "Placeholder (dev)",
  devOnly: true,
  View: PlaceholderView,
};

