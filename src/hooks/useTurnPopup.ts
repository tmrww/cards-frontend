import { useCallback, useEffect, useRef, useState } from "react";

const SHOW_MS = 5000;
const FAST_MAX_MS = 2500;
const LEAVE_MS = 200;

interface PopupState {
  show: boolean;
  /** Sped up after the mouse moves. */
  fast: boolean;
  /** Playing the exit animation after a click. */
  leaving: boolean;
}

const HIDDEN: PopupState = { show: false, fast: false, leaving: false };

/**
 * "Your Turn" pop-up. Shows for up to 5s when the turn starts, halves its remaining time
 * (max 2.5s) when the mouse moves, exits quickly on click, and hides when the turn ends.
 */
export function useTurnPopup(isMyTurn: boolean, onTurnStart?: () => void) {
  const [state, setStateRaw] = useState<PopupState>(HIDDEN);
  const stateRef = useRef<PopupState>(HIDDEN);
  const timerRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const wasMyTurnRef = useRef(false);
  const onTurnStartRef = useRef(onTurnStart);
  onTurnStartRef.current = onTurnStart;

  const setState = useCallback((next: PopupState) => {
    stateRef.current = next;
    setStateRaw(next);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  /** Hide after `ms`, replacing any pending timer. */
  const hideAfter = useCallback(
    (ms: number) => {
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        setState(HIDDEN);
      }, ms);
    },
    [clearTimer, setState]
  );

  useEffect(() => {
    const wasMyTurn = wasMyTurnRef.current;
    wasMyTurnRef.current = isMyTurn;
    if (isMyTurn && !wasMyTurn) {
      onTurnStartRef.current?.();
      startRef.current = Date.now();
      setState({ show: true, fast: false, leaving: false });
      hideAfter(SHOW_MS);
    } else if (!isMyTurn && stateRef.current.show) {
      clearTimer();
      setState(HIDDEN);
    }
  }, [isMyTurn, hideAfter, clearTimer, setState]);

  useEffect(() => clearTimer, [clearTimer]);

  const speedUp = useCallback(() => {
    const s = stateRef.current;
    if (!s.show || s.fast || s.leaving) return;
    setState({ ...s, fast: true });
    const remaining = Math.ceil((SHOW_MS - (Date.now() - startRef.current)) / 2);
    hideAfter(Math.min(FAST_MAX_MS, Math.max(0, remaining)));
  }, [hideAfter, setState]);

  const dismiss = useCallback(() => {
    const s = stateRef.current;
    if (!s.show || s.leaving) return;
    setState({ ...s, leaving: true });
    hideAfter(LEAVE_MS);
  }, [hideAfter, setState]);

  useEffect(() => {
    if (!state.show) return;
    window.addEventListener("mousemove", speedUp);
    window.addEventListener("mousedown", dismiss);
    window.addEventListener("click", dismiss);
    return () => {
      window.removeEventListener("mousemove", speedUp);
      window.removeEventListener("mousedown", dismiss);
      window.removeEventListener("click", dismiss);
    };
  }, [state.show, speedUp, dismiss]);

  return state;
}

