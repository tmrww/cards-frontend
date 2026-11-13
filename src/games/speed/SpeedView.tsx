import React, { useCallback, useEffect, useRef, useState } from "react";
import { CardView } from "../../components/common/CardView";
import { GameShell } from "../../components/common/GameShell";
import { PlayerSeat } from "../../components/common/PlayerSeat";
import { Direction, seatsFor, SeatPlacement, TableLayout } from "../../components/common/TableLayout";
import type { Card } from "../../types";
import { playGameSound } from "../../utils/sound";
import type { GameModule, GameViewProps } from "../types";
import type { SpeedAction, SpeedPlayerView } from "./types";

type Props = GameViewProps<SpeedPlayerView, SpeedAction>;

const PLAYER_COUNT = 2;
const DRAG_ACTIVATION_PX = 5;

interface DragState {
  card: Card;
  startX: number;
  startY: number;
  cardRect: DOMRect;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function isCardHalfOutsideHand(cardRect: DOMRect, dx: number, dy: number, handRect: DOMRect): boolean {
  const cardArea = cardRect.width * cardRect.height;
  if (cardArea <= 0) return false;

  const finalLeft = cardRect.left + dx;
  const finalRight = cardRect.right + dx;
  const finalTop = cardRect.top + dy;
  const finalBottom = cardRect.bottom + dy;

  const overlapX = Math.max(0, Math.min(finalRight, handRect.right) - Math.max(finalLeft, handRect.left));
  const overlapY = Math.max(0, Math.min(finalBottom, handRect.bottom) - Math.max(finalTop, handRect.top));
  const overlapArea = overlapX * overlapY;

  return overlapArea / cardArea <= 0.5;
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
  const [selectedPile, setSelectedPile] = useState<0 | 1 | null>(null);
  const [hasClickedReady, setHasClickedReady] = useState(false);
  const [infoMinimized, setInfoMinimized] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ cardId: string; dx: number; dy: number } | null>(null);

  const handAreaRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const prevWinnerRef = useRef<string | undefined>(undefined);

  const gameState: "WAITING" | "PLAYING" | "ENDED" =
    view?.state ??
    (view?.winner ? "ENDED" : (view?.topCards?.length ?? 0) > 0 ? "PLAYING" : "WAITING");

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
  const hand = view?.hand ?? [];
  const topCards = view?.topCards ?? [];
  const stuckPiles = view?.stuckPiles ?? [];

  const playCard = useCallback(
    (card: Card) => {
      if (gameState !== "PLAYING" || selectedPile === null) return;
      playGameSound("card_play", playerId);
      sendAction({ type: "PLAY", payload: { cardId: card.id, pile: selectedPile } });
    },
    [gameState, selectedPile, playerId, sendAction]
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

  const handleUnstuck = useCallback(() => {
    if (gameState !== "PLAYING") return;
    sendAction({ type: "UNSTUCK" });
  }, [gameState, sendAction]);

  const handleReady = useCallback(() => {
    setHasClickedReady(true);
    sendAction({ type: "READY" });
  }, [sendAction]);

  // Global keyboard controls: ArrowLeft/ArrowRight (pile), 1-5 (play), Space (draw).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target) || isEditableTarget(document.activeElement)) return;

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

      if (e.key === " " || e.code === "Space") {
        if (gameState === "PLAYING") {
          e.preventDefault();
          handleDraw();
        }
        return;
      }

      if (e.key >= "1" && e.key <= "5") {
        const idx = Number(e.key) - 1;
        if (idx < hand.length) {
          playCard(hand[idx]);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [gameState, hand, playCard, handleDraw]);

  // Pointer drag-out-of-hand handling.
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      setDragOffset({ cardId: drag.card.id, dx, dy });
    };

    const finishDrag = (e: PointerEvent, shouldCheckPlay: boolean) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      dragStateRef.current = null;
      setDragOffset(null);

      if (!shouldCheckPlay) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (Math.hypot(dx, dy) <= DRAG_ACTIVATION_PX) return;

      const handRect = handAreaRef.current?.getBoundingClientRect();
      if (handRect && isCardHalfOutsideHand(drag.cardRect, dx, dy, handRect)) {
        playCard(drag.card);
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
  }, [playCard]);

  const handleCardPointerDown = (e: React.PointerEvent<HTMLDivElement>, card: Card) => {
    if (e.button !== 0 && e.button !== undefined) return;
    dragStateRef.current = {
      card,
      startX: e.clientX,
      startY: e.clientY,
      cardRect: e.currentTarget.getBoundingClientRect(),
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
        <span>Deck: {p?.deckSize ?? 0}</span>
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
    return (
      <div
        className={`speed-pile speed-stuck-pile ${count === 0 ? "speed-stuck-pile--empty" : ""}`}
        data-testid={`stuck-pile-${index}`}
      >
        <span className="speed-pile-count">{count}</span>
        <span className="speed-pile-label">Stuck</span>
      </div>
    );
  };

  const renderDiscardPile = (index: 0 | 1) => {
    const card = topCards[index];
    const isSelected = selectedPile === index;
    return (
      <button
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
        {/* <div className="info-row">
          <span className="info-label">Selected Pile:</span>
          <span className="info-val">
            {selectedPile === null ? "None" : selectedPile === 0 ? "Left (1)" : "Right (2)"}
          </span>
        </div> */}
        <div className="info-row">
          <span className="info-label">Select Pile:</span>
          <span className="info-val">Arrow keys / Click</span>
        </div>
        <div className="info-row">
          <span className="info-label">Play Card:</span>
          <span className="info-val">1-5 / Double click / Drag</span>
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
                onClick={handleUnstuck}
              >
                Unstuck
              </button>
            </>
          )}
        </div>

        <div className="action-group-right">
          {gameState === "PLAYING" && selectedPile === null && (
            <span className="speed-pile-hint" data-testid="speed-pile-hint">
              Select a discard pile (← / → or click) to play
            </span>
          )}
          {gameState === "PLAYING" && selectedPile !== null && (
            <span className="drag-hint">
              Playing to Pile {selectedPile + 1} • Double-click, drag out, or press 1–5
            </span>
          )}
        </div>
      </div>

      <div className="speed-hand-area" data-testid="speed-hand-area" ref={handAreaRef}>
        {hand.length === 0 ? (
          <div className="empty-hand-msg speed-hand-empty">
            {gameState === "WAITING"
              ? "Cards will be dealt once both players Ready Up."
              : "No cards in hand."}
          </div>
        ) : (
          hand.map((card, index) => {
            const isDragging = dragOffset?.cardId === card.id;
            const style: React.CSSProperties | undefined = isDragging
              ? { transform: `translate(${dragOffset.dx}px, ${dragOffset.dy}px)` }
              : undefined;
            return (
              <div
                key={card.id}
                className={`speed-card-wrapper ${isDragging ? "speed-card-wrapper--dragging" : ""}`}
                data-testid={`speed-card-${index}`}
                style={style}
                onPointerDown={(e) => handleCardPointerDown(e, card)}
                onDoubleClick={() => playCard(card)}
              >
                <CardView
                  card={card}
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
