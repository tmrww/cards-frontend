import { useEffect, useRef } from "react";
import { playGameSound } from "../../utils/sound";
import { didMyTeamWin } from "./rules";
import type { GuanDanPlayerView } from "./types";

/** Plays sounds for card plays and round results as the view changes. */
export function useGuanDanSounds(view: GuanDanPlayerView | null, mySeat: number) {
  const prevStateRef = useRef<string | undefined>(undefined);
  const prevRoundLenRef = useRef(0);

  useEffect(() => {
    if (!view) {
      prevRoundLenRef.current = 0;
      prevStateRef.current = undefined;
      return;
    }

    const prevState = prevStateRef.current;
    const prevRoundLen = prevRoundLenRef.current;
    const roundLen = view.currentRound.length;
    prevStateRef.current = view.state;
    prevRoundLenRef.current = roundLen;

    const gameEnded = view.state === "ENDED" && prevState !== "ENDED";
    const roundEnded =
      prevState === "PLAYING" && view.state === "WAITING" && view.won.length > 0;

    if (gameEnded || roundEnded) {
      const result = didMyTeamWin(view, mySeat) ? "round_win" : "round_lose";
      playGameSound(result, `game:${result}`);
    } else if (view.state === "PLAYING" && roundLen > prevRoundLen) {
      playGameSound("card_play", view.currentRound[roundLen - 1].player);
    }
  }, [view, mySeat]);
}

