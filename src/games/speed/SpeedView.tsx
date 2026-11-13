import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CardView } from "../../components/common/CardView";
import { GameShell } from "../../components/common/GameShell";
import { PlayerSeat } from "../../components/common/PlayerSeat";
import { Direction, seatsFor, SeatPlacement, TableLayout } from "../../components/common/TableLayout";
import { useHandOrder } from "../../hooks/useHandOrder";
import type { Card } from "../../types";
import { playGameSound } from "../../utils/sound";
import type { GameModule, GameViewProps } from "../types";
import type { SpeedAction, SpeedPlayerView } from "./types";

type Props = GameViewProps<SpeedPlayerView, SpeedAction>;

const PLAYER_COUNT = 2;
const DRAG_ACTIVATION_PX = 5;
const DRAG_OUT_OVERLAP_THRESHOLD = 0.1;

type SpeedControlMode = "absolute" | "dual-cards-pile" | "dual-pile-cards";

interface DragState {
  card: Card;
  startX: number;
  startY: number;
  cardRect: DOMRect;
  lastSlotLeft: number;
  lastSlotTop: number;
}

function topCardsSomePresent(topCards?: (Card | null | undefined)[]): boolean {
  return Boolean(topCards?.some((c) => Boolean(c)));
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function isCardOutsideHand(cardRect: DOMRect, dx: number, dy: number, handRect: DOMRect): boolean {
  const cardArea = cardRect.width * cardRect.height;
  if (cardArea <= 0) return false;

  const finalLeft = cardRect.left + dx;
  const finalRight = cardRect.right + dx;
  const finalTop = cardRect.top + dy;
  const finalBottom = cardRect.bottom + dy;

  const overlapX = Math.max(0, Math.min(finalRight, handRect.right) - Math.max(finalLeft, handRect.left));
  const overlapY = Math.max(0, Math.min(finalBottom, handRect.bottom) - Math.max(finalTop, handRect.top));
  const overlapArea = overlapX * overlapY;

  return overlapArea / cardArea <= DRAG_OUT_OVERLAP_THRESHOLD;
}

function getDiscardMidline(
  pile0El: HTMLElement | null,
  pile1El: HTMLElement | null,
  handRect?: DOMRect
): number {
  const r0 = pile0El?.getBoundingClientRect();
  const r1 = pile1El?.getBoundingClientRect();
  if (r0 && r1 && r0.width > 0 && r1.width > 0) {
    return (r0.right + r1.left) / 2;
  }
  if (handRect && handRect.width > 0) {
    return handRect.left + handRect.width / 2;
  }
  return (window.innerWidth || 0) / 2;
}

function reconcileSpeedHand(current: Card[], serverHand: Card[]): Card[] {
  if (serverHand.length === 0) return [];
  const serverById = new Map(serverHand.map((c) => [c.id, c]));
  const kept: Card[] = [];
  const keptIds = new Set<string>();
  for (const c of current) {
    const updated = serverById.get(c.id);
    if (updated) {
      kept.push(updated);
      keptIds.add(c.id);
    }
  }
  for (const c of serverHand) {
    if (!keptIds.has(c.id)) {
      kept.push(c);
    }
  }
  return kept;
}

function findReorderTargetIndex(
  wrappers: HTMLElement[],
  fromIndex: number,
  clientX: number
): number {
  for (let i = 0; i < fromIndex; i++) {
    const rect = wrappers[i].getBoundingClientRect();
    if (clientX < rect.left + rect.width / 2) {
      return i;
    }
  }
  for (let i = wrappers.length - 1; i > fromIndex; i--) {
    const rect = wrappers[i].getBoundingClientRect();
    if (clientX > rect.left + rect.width / 2) {
      return i;
    }
  }
  return fromIndex;
}

export const SpeedView: React.FC<Props> = ({
  roomId,
  playerId,
  view,
  chatMessages,
  error,
  sendAction,
  sendChat,
  clearError,
  leaveRoom,
}) => {
  const {
    order: orderedHand,
    orderRef: orderedHandRef,
    setOrder: setOrderedHand,
    move: moveHandCard,
  } = useHandOrder<Card>();
  const [selectedPile, setSelectedPile] = useState<0 | 1 | null>(null);
  const [controlMode, setControlMode] = useState<SpeedControlMode>("absolute");
  const [selectedCardIndex, setSelectedCardIndex] = useState<number>(0);
  const [dragHoverPile, setDragHoverPile] = useState<0 | 1 | null>(null);
  const [hasClickedReady, setHasClickedReady] = useState(false);
  const [requestedUnstuckPile, setRequestedUnstuckPile] = useState<0 | 1 | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [infoMinimized, setInfoMinimized] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ cardId: string; dx: number; dy: number } | null>(null);

  const handAreaRef = useRef<HTMLDivElement>(null);
  const discardPile0Ref = useRef<HTMLButtonElement>(null);
  const discardPile1Ref = useRef<HTMLButtonElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const prevWinnerRef = useRef<string | undefined>(undefined);
  const prevTopCardsKeyRef = useRef<string>("");
  const prevStuckLenRef = useRef<number>(0);

  const gameState: "WAITING" | "COUNTDOWN" | "PLAYING" | "ENDED" =
    view?.state ??
    (view?.winner ? "ENDED" : topCardsSomePresent(view?.topCards) ? "PLAYING" : "WAITING");

  useEffect(() => {
    if (gameState !== "WAITING") {
      setHasClickedReady(false);
    }
  }, [gameState]);

  useEffect(() => {
    const prevWinner = prevWinnerRef.current;
    prevWinnerRef.current = view?.winner;
    if (!prevWinner && view?.winner) {
      playGameSound(view.winner === playerId ? "round_win" : "round_lose", playerId);
    }
  }, [view?.winner, playerId]);

  const foundSeat = view?.players.findIndex((p) => p.id === playerId) ?? -1;
  const mySeat = foundSeat >= 0 ? foundSeat : 0;
  const serverHand = useMemo(() => view?.hand ?? [], [view?.hand]);
  const topCards = useMemo(() => view?.topCards ?? [], [view?.topCards]);
  const stuckPiles = view?.stuckPiles ?? [];
  const topCardsKey = useMemo(() => topCards.map((c) => c?.id ?? "").join(","), [topCards]);

  // Keep local hand order synced with server hand, preserving user's drag order.
  useEffect(() => {
    setOrderedHand((prev) => reconcileSpeedHand(prev, serverHand));
  }, [serverHand, setOrderedHand]);

  const effectiveSelectedCardIndex =
    orderedHand.length === 0 ? 0 : Math.min(selectedCardIndex, orderedHand.length - 1);

  useEffect(() => {
    setSelectedCardIndex((prev) => {
      if (orderedHand.length === 0) return 0;
      return Math.min(prev, orderedHand.length - 1);
    });
  }, [orderedHand.length]);

  // Clear unstuck request when leaving PLAYING, when topCards change, or when server clears stuck.
  useEffect(() => {
    const stuckLen = view?.stuck?.length ?? 0;
    const topCardsChanged =
      prevTopCardsKeyRef.current !== "" && prevTopCardsKeyRef.current !== topCardsKey;
    const stuckCleared = prevStuckLenRef.current > 0 && stuckLen === 0;
    prevTopCardsKeyRef.current = topCardsKey;
    prevStuckLenRef.current = stuckLen;

    if (gameState !== "PLAYING" || topCardsChanged || stuckCleared) {
      setRequestedUnstuckPile(null);
    }
  }, [gameState, topCardsKey, view?.stuck]);

  // Tick countdown every 100ms while in COUNTDOWN state.
  useEffect(() => {
    if (gameState !== "COUNTDOWN" || !view?.countdownEndsAt) {
      setCountdownSeconds(null);
      return;
    }
    const endsAt = view.countdownEndsAt;
    const update = () => {
      setCountdownSeconds(Math.max(1, Math.ceil((endsAt - Date.now()) / 1000)));
    };
    update();
    const id = window.setInterval(update, 100);
    return () => window.clearInterval(id);
  }, [gameState, view?.countdownEndsAt]);

  const isUnstuckRequested =
    requestedUnstuckPile !== null || Boolean(view?.stuck?.includes(playerId));

  const playCardToPile = useCallback(
    (card: Card, pile: 0 | 1) => {
      if (gameState !== "PLAYING") return;
      playGameSound("card_play", playerId);
      sendAction({ type: "PLAY", payload: { cardId: card.id, pile } });
    },
    [gameState, playerId, sendAction]
  );

  const playCard = useCallback(
    (card: Card) => {
      if (selectedPile === null) return;
      playCardToPile(card, selectedPile);
    },
    [selectedPile, playCardToPile]
  );

  const handleDraw = useCallback(() => {
    if (gameState !== "PLAYING") return;
    sendAction({ type: "DRAW" });
  }, [gameState, sendAction]);

  const handlePlayAreaClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (gameState !== "PLAYING") return;
      const target = e.target;
      if (target instanceof HTMLElement && target.closest("button, a, input, textarea, select")) {
        return;
      }
      handleDraw();
    },
    [gameState, handleDraw]
  );

  const handleUnstuck = useCallback(
    (pileIndex: 0 | 1 = 0) => {
      if (gameState !== "PLAYING") return;
      setRequestedUnstuckPile(pileIndex);
      sendAction({ type: "UNSTUCK" });
    },
    [gameState, sendAction]
  );

  const handleReady = useCallback(() => {
    setHasClickedReady(true);
    sendAction({ type: "READY" });
  }, [sendAction]);

  // Global keyboard controls: Space (draw), plus mode-specific pile/card selection and play.
  useEffect(() => {
    const moveCardSelection = (delta: -1 | 1) => {
      setSelectedCardIndex((prev) => {
        if (orderedHand.length === 0) return 0;
        const clamped = Math.min(prev, orderedHand.length - 1);
        return Math.max(0, Math.min(orderedHand.length - 1, clamped + delta));
      });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target) || isEditableTarget(document.activeElement)) return;

      if (e.key === " " || e.code === "Space") {
        if (gameState === "PLAYING") {
          e.preventDefault();
          handleDraw();
        }
        return;
      }

      if (controlMode === "absolute") {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          setSelectedPile(0);
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          setSelectedPile(1);
          return;
        }
        if (e.key >= "1" && e.key <= "5") {
          const idx = Number(e.key) - 1;
          if (idx < orderedHand.length) {
            playCard(orderedHand[idx]);
          }
        }
        return;
      }

      const pileLeftKey = controlMode === "dual-pile-cards" ? "a" : "ArrowLeft";
      const pileRightKey = controlMode === "dual-pile-cards" ? "d" : "ArrowRight";
      const cardLeftKey = controlMode === "dual-pile-cards" ? "ArrowLeft" : "a";
      const cardRightKey = controlMode === "dual-pile-cards" ? "ArrowRight" : "d";
      const normalizedKey = e.key.length === 1 ? e.key.toLowerCase() : e.key;

      if (normalizedKey === pileLeftKey) {
        e.preventDefault();
        setSelectedPile(0);
        return;
      }
      if (normalizedKey === pileRightKey) {
        e.preventDefault();
        setSelectedPile(1);
        return;
      }
      if (normalizedKey === cardLeftKey) {
        e.preventDefault();
        moveCardSelection(-1);
        return;
      }
      if (normalizedKey === cardRightKey) {
        e.preventDefault();
        moveCardSelection(1);
        return;
      }

      if (e.key === "ArrowUp" || normalizedKey === "w") {
        e.preventDefault();
        if (orderedHand.length > 0) {
          playCard(orderedHand[effectiveSelectedCardIndex]);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [gameState, controlMode, orderedHand, effectiveSelectedCardIndex, playCard, handleDraw]);

  // Compensate drag origin when flex reordering shifts the dragged card's slot so offset isn't added twice.
  useLayoutEffect(() => {
    const drag = dragStateRef.current;
    const handArea = handAreaRef.current;
    if (!drag || !handArea) return;
    const wrapper = handArea.querySelector<HTMLElement>(`[data-card-id="${drag.card.id}"]`);
    if (!wrapper) return;
    const deltaSlotX = wrapper.offsetLeft - drag.lastSlotLeft;
    const deltaSlotY = wrapper.offsetTop - drag.lastSlotTop;
    if (deltaSlotX === 0 && deltaSlotY === 0) return;

    drag.startX += deltaSlotX;
    drag.startY += deltaSlotY;
    drag.lastSlotLeft = wrapper.offsetLeft;
    drag.lastSlotTop = wrapper.offsetTop;
    drag.cardRect = new DOMRect(
      drag.cardRect.left + deltaSlotX,
      drag.cardRect.top + deltaSlotY,
      drag.cardRect.width,
      drag.cardRect.height
    );
    setDragOffset((prev) =>
      prev && prev.cardId === drag.card.id
        ? { ...prev, dx: prev.dx - deltaSlotX, dy: prev.dy - deltaSlotY }
        : prev
    );
  }, [orderedHand]);

  // Pointer drag-in-hand (reorder) and drag-out-of-hand (play) handling.
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      setDragOffset({ cardId: drag.card.id, dx, dy });

      if (Math.hypot(dx, dy) <= DRAG_ACTIVATION_PX) {
        setDragHoverPile(null);
        return;
      }

      const handArea = handAreaRef.current;
      const handRect = handArea?.getBoundingClientRect();
      if (handRect && isCardOutsideHand(drag.cardRect, dx, dy, handRect)) {
        const midline = getDiscardMidline(discardPile0Ref.current, discardPile1Ref.current, handRect);
        setDragHoverPile(e.clientX < midline ? 0 : 1);
        return;
      }

      setDragHoverPile(null);
      if (handArea && handRect) {
        const wrappers = Array.from(handArea.querySelectorAll<HTMLElement>(".speed-card-wrapper"));
        const currentOrder = orderedHandRef.current;
        const fromIndex = currentOrder.findIndex((c) => c.id === drag.card.id);
        if (fromIndex !== -1 && wrappers.length === currentOrder.length) {
          const targetIndex = findReorderTargetIndex(wrappers, fromIndex, e.clientX);
          if (targetIndex !== fromIndex) {
            moveHandCard(fromIndex, targetIndex);
          }
        }
      }
    };

    const finishDrag = (e: PointerEvent, shouldCheckPlay: boolean) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      dragStateRef.current = null;
      setDragOffset(null);
      setDragHoverPile(null);

      if (!shouldCheckPlay) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (Math.hypot(dx, dy) <= DRAG_ACTIVATION_PX) return;

      const handRect = handAreaRef.current?.getBoundingClientRect();
      if (handRect && isCardOutsideHand(drag.cardRect, dx, dy, handRect)) {
        const midline = getDiscardMidline(discardPile0Ref.current, discardPile1Ref.current, handRect);
        const hoverPile: 0 | 1 = e.clientX < midline ? 0 : 1;
        playCardToPile(drag.card, hoverPile);
      }
    };

    const onPointerUp = (e: PointerEvent) => finishDrag(e, true);
    const onPointerCancel = (e: PointerEvent) => finishDrag(e, false);

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [playCardToPile, orderedHandRef, moveHandCard]);

  const handleCardPointerDown = (e: React.PointerEvent<HTMLDivElement>, card: Card) => {
    if (e.button !== 0 && e.button !== undefined) return;
    dragStateRef.current = {
      card,
      startX: e.clientX,
      startY: e.clientY,
      cardRect: e.currentTarget.getBoundingClientRect(),
      lastSlotLeft: e.currentTarget.offsetLeft,
      lastSlotTop: e.currentTarget.offsetTop,
    };
    setDragOffset({ cardId: card.id, dx: 0, dy: 0 });
  };

  const renderDeck = (deckSize: number, isMine: boolean) => (
    <div
      className={`speed-deck ${isMine ? "speed-my-deck" : "speed-opponent-deck"}`}
      data-testid={isMine ? "my-deck" : "opponent-deck"}
    >
      <div className="speed-deck-card">
        <span className="speed-deck-count">{deckSize}</span>
      </div>
      <span className="speed-deck-label">{isMine ? "Your Deck" : "Their Deck"}</span>
    </div>
  );

  const renderSeat = ({ direction, seatIndex, offset }: SeatPlacement) => {
    const p = view?.players[seatIndex];
    const isMe = offset === 0 && p?.id === playerId;
    const deckEl = renderDeck(p?.deckSize ?? 0, isMe);

    const seatEl = (
      <PlayerSeat direction={direction} name={p?.name} isTurn={false} isMe={isMe}>
        <span>Hand: {p?.handSize ?? 0}</span>
      </PlayerSeat>
    );

    // Your draw deck is on your left (S left); opponent's draw deck is on their left (N right).
    if (direction === "S") {
      return (
        <div className="speed-seat-row speed-seat-south">
          {deckEl}
          {seatEl}
        </div>
      );
    }
    return (
      <div className="speed-seat-row speed-seat-north">
        {seatEl}
        {deckEl}
      </div>
    );
  };

  const seats = Object.fromEntries(
    seatsFor(PLAYER_COUNT, mySeat, true).map((s) => [s.direction, renderSeat(s)])
  ) as Record<Direction, React.ReactNode>;

  const winnerName =
    view?.winner && (view.players.find((p) => p.id === view.winner)?.name ?? view.winner);

  const renderStuckPile = (index: 0 | 1) => {
    const count = stuckPiles[index] ?? 0;
    const isRequested = isUnstuckRequested && (requestedUnstuckPile ?? 0) === index;
    return (
      <button
        type="button"
        className={`speed-pile speed-stuck-pile ${count === 0 ? "speed-stuck-pile--empty" : ""} ${
          isRequested ? "speed-stuck-pile--requested" : ""
        }`}
        data-testid={`stuck-pile-${index}`}
        aria-pressed={isRequested}
        disabled={gameState !== "PLAYING"}
        onClick={() => handleUnstuck(index)}
      >
        <span className="speed-pile-count">{count}</span>
        <span className="speed-pile-label">Stuck</span>
      </button>
    );
  };

  const renderDiscardPile = (index: 0 | 1) => {
    const card = topCards[index];
    const isSelected = dragHoverPile !== null ? dragHoverPile === index : selectedPile === index;
    return (
      <button
        ref={index === 0 ? discardPile0Ref : discardPile1Ref}
        type="button"
        className={`speed-pile speed-discard-pile ${isSelected ? "speed-discard-pile--selected" : ""} ${!card ? "speed-discard-pile--empty" : ""
          }`}
        data-testid={`discard-pile-${index}`}
        aria-pressed={isSelected}
        onClick={() => setSelectedPile(index)}
      >
        {card ? <CardView card={card} /> : <span className="speed-pile-label">Pile {index + 1}</span>}
      </button>
    );
  };

  const topRight = (
    <div className={`top-right-info ${infoMinimized ? "info-minimized" : ""}`}>
      <div className="info-header">
        <span className="info-title">Speed Info</span>
        <button
          type="button"
          className="info-toggle-btn"
          onClick={() => setInfoMinimized((prev) => !prev)}
          title={infoMinimized ? "Expand Game Info" : "Minimize Game Info"}
        >
          {infoMinimized ? "+" : "−"}
        </button>
      </div>
      <div className="info-body">
        <div className="info-row">
          <span className="info-label">Status:</span>
          <span className="info-val">{view ? gameState : "CONNECTING"}</span>
        </div>
        <div className="info-row">
          <label className="info-label" htmlFor="speed-control-mode-select">
            Controls:
          </label>
          <select
            id="speed-control-mode-select"
            className="info-select"
            data-testid="speed-control-mode"
            value={controlMode}
            onChange={(e) => {
              setControlMode(e.target.value as SpeedControlMode);
              e.currentTarget.blur();
            }}
          >
            <option value="absolute">Absolute</option>
            <option value="dual-cards-pile">Dual (Cards/Pile)</option>
            <option value="dual-pile-cards">Dual (Pile/Cards)</option>
          </select>
        </div>
        <div className="info-row">
          <span className="info-label">Select Pile:</span>
          <span className="info-val">
            {controlMode === "dual-pile-cards" ? "A / D or Click" : "← / → or Click"}
          </span>
        </div>
        {controlMode !== "absolute" && (
          <div className="info-row">
            <span className="info-label">Select Card:</span>
            <span className="info-val">
              {controlMode === "dual-pile-cards" ? "← / →" : "A / D"}
            </span>
          </div>
        )}
        <div className="info-row">
          <span className="info-label">Play Card:</span>
          <span className="info-val">
            {controlMode !== "absolute"
              ? "↑ or W / Double-click / Drag out (left/right)"
              : "1-5 / Double-click / Drag out (left/right)"}
          </span>
        </div>
        <div className="info-row">
          <span className="info-label">Draw Card:</span>
          <span className="info-val">Space / Tap play area</span>
        </div>
      </div>
    </div>
  );

  const table = (
    <div
      className="speed-play-area"
      data-testid="speed-play-area"
      onClick={handlePlayAreaClick}
    >
      <TableLayout seats={seats}>
        <div className="speed-center">
          {gameState === "WAITING" && (
            <div className="center-status-box speed-waiting-box">
              <h3>Waiting for players to Ready Up</h3>
              <p>
                Players in room: {view?.players.length ?? 0} / {PLAYER_COUNT}
              </p>
            </div>
          )}

          {gameState === "COUNTDOWN" && view?.countdownEndsAt && (
            <div
              className="center-status-box speed-countdown-banner"
              data-testid="speed-countdown-banner"
            >
              <h3>
                {view.countdownKind === "UNSTUCK"
                  ? `Unstucking in ${countdownSeconds ?? Math.max(1, Math.ceil((view.countdownEndsAt - Date.now()) / 1000))}...`
                  : `Game starting in ${countdownSeconds ?? Math.max(1, Math.ceil((view.countdownEndsAt - Date.now()) / 1000))}...`}
              </h3>
            </div>
          )}

          {gameState === "ENDED" && (
            <div className="center-status-box speed-winner-banner" data-testid="speed-winner-banner">
              <h3>Game Over!</h3>
              <p>
                Winner: <strong>{winnerName}</strong>
                {view?.winner === playerId ? " (You!)" : ""}
              </p>
            </div>
          )}

          <div className="speed-piles-row">
            {renderStuckPile(0)}
            {renderDiscardPile(0)}
            {renderDiscardPile(1)}
            {renderStuckPile(1)}
          </div>
        </div>
      </TableLayout>
    </div>
  );

  const footer = (
    <>
      <div className="action-bar speed-action-bar">
        <div className="action-group-left">
          {gameState === "WAITING" && (
            <button
              type="button"
              className="btn-primary"
              data-testid="speed-ready-btn"
              disabled={hasClickedReady}
              onClick={handleReady}
            >
              {hasClickedReady ? "Ready ✓ (Waiting for opponent)" : "Ready Up"}
            </button>
          )}
          {gameState === "PLAYING" && (
            <>
              <button
                type="button"
                className="btn-primary"
                data-testid="speed-draw-btn"
                onClick={handleDraw}
              >
                Draw (Space)
              </button>
              <button
                type="button"
                className="btn-secondary"
                data-testid="speed-unstuck-btn"
                onClick={() => handleUnstuck(0)}
              >
                {isUnstuckRequested ? "Unstuck Requested" : "Unstuck"}
              </button>
            </>
          )}
        </div>

        <div className="action-group-right">
          {gameState === "COUNTDOWN" && (
            <span className="drag-hint">
              Drag cards in your hand to reorder before play begins
            </span>
          )}
          {gameState === "PLAYING" && selectedPile === null && (
            <span className="speed-pile-hint" data-testid="speed-pile-hint">
              Select a discard pile ({controlMode === "dual-pile-cards" ? "A / D" : "← / →"} or click), or drag a card out onto left/right side
            </span>
          )}
          {gameState === "PLAYING" && selectedPile !== null && (
            <span className="drag-hint">
              {controlMode === "dual-cards-pile"
                ? `Playing to Pile ${selectedPile + 1} • A/D select, W/↑ play, double-click, or drag out`
                : controlMode === "dual-pile-cards"
                ? `Playing to Pile ${selectedPile + 1} • ←/→ select, W/↑ play, double-click, or drag out`
                : `Playing to Pile ${selectedPile + 1} • Press 1–5, double-click, or drag out`}
            </span>
          )}
        </div>
      </div>

      <div className="speed-hand-area" data-testid="speed-hand-area" ref={handAreaRef}>
        {orderedHand.length === 0 ? (
          <div className="empty-hand-msg speed-hand-empty">
            {gameState === "WAITING"
              ? "Cards will be dealt once both players Ready Up."
              : "No cards in hand."}
          </div>
        ) : (
          orderedHand.map((card, index) => {
            const isDragging = dragOffset?.cardId === card.id;
            const isCardSelected = controlMode !== "absolute" && index === effectiveSelectedCardIndex;
            const style: React.CSSProperties | undefined = isDragging
              ? { transform: `translate(${dragOffset.dx}px, ${dragOffset.dy}px)` }
              : undefined;
            return (
              <div
                key={card.id}
                className={`speed-card-wrapper ${isDragging ? "speed-card-wrapper--dragging" : ""}`}
                data-testid={`speed-card-${index}`}
                data-card-id={card.id}
                data-selected={isCardSelected ? "true" : undefined}
                style={style}
                onPointerDown={(e) => handleCardPointerDown(e, card)}
                onDoubleClick={() => playCard(card)}
              >
                <CardView
                  card={card}
                  selected={isCardSelected}
                  dragging={isDragging}
                  badges={<span className="speed-card-key-badge">{index + 1}</span>}
                />
              </div>
            );
          })
        )}
      </div>
    </>
  );

  return (
    <GameShell
      roomId={roomId}
      playerId={playerId}
      isMyTurn={false}
      onLeave={leaveRoom}
      chatMessages={chatMessages}
      onSendChat={sendChat}
      error={error}
      onClearError={clearError}
      topRight={topRight}
      table={table}
      footer={footer}
    />
  );
};

export const speedModule: GameModule<SpeedPlayerView, SpeedAction> = {
  id: "speed",
  label: "Speed",
  View: SpeedView,
};
