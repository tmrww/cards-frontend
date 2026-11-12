import React from "react";
import { useTurnPopup } from "../../hooks/useTurnPopup";

type TurnBannerProps = ReturnType<typeof useTurnPopup>;

/** Non-blocking "Your Turn!" overlay driven by `useTurnPopup`. */
export const TurnBanner: React.FC<TurnBannerProps> = ({ show, fast, leaving }) =>
  show ? (
    <div className={`turn-popup-overlay ${fast ? "turn-popup-fast" : ""}`}>
      <div
        className={`turn-popup-badge ${fast ? "turn-popup-fast" : ""} ${
          leaving ? "turn-popup-leaving" : ""
        }`}
      >
        Your Turn!
      </div>
    </div>
  ) : null;

