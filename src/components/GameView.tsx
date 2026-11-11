import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, GuanDanAction, GuanDanCombination, GuanDanPlayerInfo, GuanDanPlayerView } from "../types";
import {
  formatComboType,
  formatMainRank,
  formatStageRank,
  getCardShortValue,
  getSuitSymbol,
  isRedCard,
  isWildcard,
  sortBombsToEnd,
  sortCardsLowToHigh,
} from "../utils/cards";

interface GameViewProps {
  roomId: string;
  playerId: string;
  view: GuanDanPlayerView | null;
  error: string | null;
  onClearError: () => void;
  onSendAction: (action: GuanDanAction) => void;
  onLeaveRoom: () => void;
}

interface SeatSlot {
  direction: "N" | "E" | "S" | "W";
  label: string;
  seatIndex: number;
  player?: GuanDanPlayerInfo;
  isMe: boolean;
  isTeammate: boolean;
  isTurn: boolean;
}

const BOMB_GROUP_PALETTE: { text: string; bg: string; border: string }[] = [
  { text: "#6d28d9", bg: "#ede9fe", border: "#7c3aed" }, // Violet
  { text: "#1d4ed8", bg: "#dbeafe", border: "#2563eb" }, // Blue
  { text: "#047857", bg: "#d1fae5", border: "#059669" }, // Emerald
  { text: "#b45309", bg: "#fef3c7", border: "#d97706" }, // Amber
  { text: "#be185d", bg: "#fce7f3", border: "#db2777" }, // Pink / Magenta
  { text: "#0e7490", bg: "#cffafe", border: "#0891b2" }, // Cyan / Teal
  { text: "#4338ca", bg: "#e0e7ff", border: "#4f46e5" }, // Indigo
];

export const GameView: React.FC<GameViewProps> = ({
  roomId,
  playerId,
  view,
  error,
  onClearError,
  onSendAction,
  onLeaveRoom,
}) => {
  const [orderedHand, setOrderedHand] = useState<Card[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [bombGroupMap, setBombGroupMap] = useState<Map<string, number>>(new Map());
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  // Track which team won the previous stage so we know whose stage is active
  const lastWinningTeamRef = useRef<number>(0);
  const prevGameStateRef = useRef<string | undefined>(undefined);
  const lastPlayedIdsRef = useRef<Set<string>>(new Set());

  // Compute active stage number (2..13, or 1 for Ace)
  const activeStage = useMemo(() => {
    if (!view) return 2;
    const [stage0 = 2, stage1 = 2] = view.stage ?? [2, 2];
    if (stage0 === stage1) return stage0;

    if (view.won && view.won.length > 0) {
      const firstWinnerIdx = view.players.findIndex((p) => p.id === view.won[0]);
      if (firstWinnerIdx !== -1) {
        const winTeam = firstWinnerIdx % 2;
        lastWinningTeamRef.current = winTeam;
        return view.stage[winTeam] ?? stage0;
      }
    }
    return view.stage[lastWinningTeamRef.current] ?? stage0;
  }, [view]);

  // Synchronize local orderedHand with server view.hand
  useEffect(() => {
    if (!view) {
      setOrderedHand([]);
      setSelectedCardIds(new Set());
      setBombGroupMap(new Map());
      return;
    }

    const serverHand = view.hand ?? [];
    const prevState = prevGameStateRef.current;
    prevGameStateRef.current = view.state;

    setOrderedHand((prevHand) => {
      if (serverHand.length === 0) {
        return [];
      }

      // If transitioning into PLAYING or hand grew (new deal), sort lowest to highest grouped by value
      const isNewDeal =
        prevHand.length === 0 ||
        serverHand.length > prevHand.length ||
        (prevState === "WAITING" && view.state === "PLAYING");

      if (isNewDeal) {
        setBombGroupMap(new Map());
        setSelectedCardIds(new Set());
        return sortCardsLowToHigh(serverHand, activeStage);
      }

      // Otherwise preserve existing custom drag/sort order for remaining cards
      const serverById = new Map<string, Card>();
      for (const c of serverHand) {
        serverById.set(c.id, c);
      }

      // Handle duplicate cards across the 2 decks: if a played card ID is still in serverHand
      // because backend Deck.removeCard removed an identical twin first, swap it into the twin's slot
      const adjustedPrev = [...prevHand];
      const playedIds = lastPlayedIdsRef.current;
      if (playedIds.size > 0) {
        for (let i = 0; i < adjustedPrev.length; i++) {
          const c = adjustedPrev[i];
          if (!serverById.has(c.id) && !playedIds.has(c.id)) {
            const swapIdx = adjustedPrev.findIndex(
              (other, idx) =>
                idx !== i &&
                playedIds.has(other.id) &&
                serverById.has(other.id) &&
                other.suit.id === c.suit.id &&
                other.value.value === c.value.value
            );
            if (swapIdx !== -1) {
              const temp = adjustedPrev[i];
              adjustedPrev[i] = adjustedPrev[swapIdx];
              adjustedPrev[swapIdx] = temp;
              playedIds.delete(adjustedPrev[i].id);
            }
          }
        }
        lastPlayedIdsRef.current = new Set();
      }

      const kept: Card[] = [];
      const keptIds = new Set<string>();
      for (const oldCard of adjustedPrev) {
        const match = serverById.get(oldCard.id);
        if (match) {
          kept.push(match);
          keptIds.add(match.id);
        }
      }

      // In case any card in serverHand wasn't in prevHand, append it sorted
      const added = serverHand.filter((c) => !keptIds.has(c.id));
      if (added.length > 0) {
        return [...kept, ...sortCardsLowToHigh(added, activeStage)];
      }
      return kept;
    });

    // Clean up selected IDs and bomb highlights that are no longer in hand
    const validIds = new Set(serverHand.map((c) => c.id));
    setSelectedCardIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (validIds.has(id)) next.add(id);
      }
      return next;
    });
    setBombGroupMap((prev) => {
      if (prev.size === 0) return prev;
      const next = new Map<string, number>();
      for (const [id, groupIdx] of prev.entries()) {
        if (validIds.has(id)) next.set(id, groupIdx);
      }
      return next;
    });
  }, [view, activeStage]);

  // Determine seat index of current user
  const mySeatIndex = useMemo(() => {
    if (!view) return 0;
    const idx = view.players.findIndex((p) => p.id === playerId);
    return idx >= 0 ? idx : 0;
  }, [view, playerId]);

  // Build NESW seats with S = You, N = Teammate ((mySeatIndex + 2) % 4)
  const seats: Record<"N" | "E" | "S" | "W", SeatSlot> = useMemo(() => {
    const players = view?.players ?? [];
    const makeSlot = (
      direction: "N" | "E" | "S" | "W",
      offset: number,
      label: string
    ): SeatSlot => {
      const seatIndex = (mySeatIndex + offset) % 4;
      const player = players[seatIndex];
      return {
        direction,
        label,
        seatIndex,
        player,
        isMe: offset === 0 && !!player && player.id === playerId,
        isTeammate: offset === 2,
        isTurn: view?.state === "PLAYING" && view.turn === seatIndex,
      };
    };

    return {
      S: makeSlot("S", 0, "South (You)"),
      E: makeSlot("E", 1, "East (Opponent)"),
      N: makeSlot("N", 2, "North (Teammate)"),
      W: makeSlot("W", 3, "West (Opponent)"),
    };
  }, [view, mySeatIndex, playerId]);

  const myTeamIndex = mySeatIndex % 2;
  const oppTeamIndex = (mySeatIndex + 1) % 2;
  const myTeamStage = view?.stage?.[myTeamIndex] ?? 2;
  const oppTeamStage = view?.stage?.[oppTeamIndex] ?? 2;

  const lastCombo: GuanDanCombination | undefined =
    view && view.currentRound.length > 0
      ? view.currentRound[view.currentRound.length - 1]
      : undefined;

  const isMyTurn =
    view?.state === "PLAYING" && view.players[view.turn]?.id === playerId;
  const isReady = view?.ready?.includes(playerId) ?? false;

  const getPlayerName = (id: string): string => {
    const found = view?.players.find((p) => p.id === id);
    return found ? found.name : id;
  };

  // Find each player's latest played combination in the current round
  const latestPlayByPlayer = useMemo(() => {
    const map = new Map<string, GuanDanCombination>();
    if (!view) return map;
    for (const combo of view.currentRound) {
      map.set(combo.player, combo);
    }
    return map;
  }, [view]);

  // Card selection toggle
  const toggleCardSelection = (cardId: string) => {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  // Drag-and-drop handlers for reordering cards in hand
  const handleDragStart = (index: number) => {
    setDraggedIdx(index);
  };

  const handleDragOver = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIndex) return;

    setOrderedHand((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(draggedIdx, 1);
      updated.splice(targetIndex, 0, moved);
      return updated;
    });
    setDraggedIdx(targetIndex);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
  };

  // Sort handlers
  const handleSortDefault = () => {
    setOrderedHand((prev) => sortCardsLowToHigh(prev, activeStage));
    setBombGroupMap(new Map());
  };

  const handleSortBombsToEnd = () => {
    setOrderedHand((prev) => {
      const { sorted, bombGroupMap: nextGroupMap } = sortBombsToEnd(prev, activeStage);
      setBombGroupMap(nextGroupMap);
      return sorted;
    });
  };

  // Game actions
  const handleReady = () => {
    onSendAction({ type: "READY" });
  };

  const handlePlaySelected = () => {
    if (selectedCardIds.size === 0) return;
    // Preserve hand order for selected cards
    const cardIds = orderedHand
      .filter((c) => selectedCardIds.has(c.id))
      .map((c) => c.id);
    lastPlayedIdsRef.current = new Set(cardIds);
    onSendAction({ type: "PLAY", payload: { cardIds } });
    setSelectedCardIds(new Set());
  };

  const handlePass = () => {
    onSendAction({ type: "PASS" });
    setSelectedCardIds(new Set());
  };

  // Render a single player seat (circle + info underneath)
  const renderPlayerNode = (slot: SeatSlot) => {
    const p = slot.player;
    const playerReady = p ? view?.ready?.includes(p.id) : false;
    const finishOrder = p && view?.won ? view.won.indexOf(p.id) : -1;

    return (
      <div
        className={`player-seat seat-${slot.direction.toLowerCase()} ${
          slot.isTurn ? "seat-active-turn" : ""
        }`}
      >
        <div
          className={`player-circle ${slot.isTurn ? "circle-turn" : ""} ${
            slot.isMe ? "circle-me" : slot.isTeammate ? "circle-teammate" : ""
          } ${!p ? "circle-empty" : ""}`}
        >
          <span className="seat-compass">{slot.direction}</span>
          <span className="seat-Initials">
            {p ? p.name.slice(0, 2).toUpperCase() : "—"}
          </span>
        </div>

        <div className="player-under-info">
          <div className="player-name-line">
            <strong>{p ? p.name : "Waiting..."}</strong>
            {slot.isMe && <span className="role-tag"> (You)</span>}
            {!slot.isMe && slot.isTeammate && (
              <span className="role-tag"> (Teammate)</span>
            )}
          </div>

          <div className="player-meta-line">
            <span>Cards: {p ? p.cardCount : 0}</span>
            {p && view?.state === "WAITING" && (
              <span className={`status-pill ${playerReady ? "ready" : "wait"}`}>
                {playerReady ? "Ready" : "Not Ready"}
              </span>
            )}
            {p && view?.state !== "WAITING" && (
              <span className={`status-pill status-${p.status ?? "waiting"}`}>
                {finishOrder >= 0
                  ? `Out (#${finishOrder + 1})`
                  : p.status
                  ? p.status.toUpperCase()
                  : slot.isTurn
                  ? "THINKING"
                  : "WAITING"}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderMiniCard = (card: Card) => {
    const red = isRedCard(card);
    const wild = isWildcard(card, activeStage);
    return (
      <span
        key={card.id}
        className={`mini-card ${red ? "card-red" : "card-black"} ${
          wild ? "card-wild" : ""
        }`}
      >
        {getSuitSymbol(card.suit.id)}
        {getCardShortValue(card)}
      </span>
    );
  };

  return (
    <div className="game-screen">
      {/* Top-Left Error & Room Banner */}
      <div className="top-left-bar">
        <div className="room-badge">
          Room: <strong>{roomId}</strong>
        </div>
        <button type="button" className="btn-secondary btn-small" onClick={onLeaveRoom}>
          Leave Room
        </button>
        {error && (
          <div className="game-error-toast">
            <span>{error}</span>
            <button type="button" className="btn-clear" onClick={onClearError}>
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Top-Right Game Information Panel */}
      <div className="top-right-info">
        <div className="info-title">Game Info</div>
        <div className="info-row">
          <span className="info-label">Status:</span>
          <span className="info-val">
            {view?.state ?? "CONNECTING"}
            {view?.state === "WAITING" && ` (${view.players.length}/4 Joined)`}
          </span>
        </div>
        <div className="info-row">
          <span className="info-label">Current Stage:</span>
          <span className="info-val highlight-stage">
            {formatStageRank(activeStage)} (Wild: ♥{formatStageRank(activeStage)})
          </span>
        </div>
        <div className="info-row">
          <span className="info-label">Team Stages:</span>
          <span className="info-val">
            Us: {formatStageRank(myTeamStage)} | Them: {formatStageRank(oppTeamStage)}
          </span>
        </div>
        <div className="info-row">
          <span className="info-label">Current Turn:</span>
          <span className="info-val">
            {view?.state === "PLAYING"
              ? view.players[view.turn]?.name ?? "—"
              : "—"}
          </span>
        </div>

        <hr className="info-divider" />

        <div className="info-subtitle">Hand to Match</div>
        {lastCombo ? (
          <div className="match-box">
            <div className="info-row">
              <span className="info-label">Type:</span>
              <span className="info-val">{formatComboType(lastCombo.type)}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Rank:</span>
              <span className="info-val">
                {formatMainRank(lastCombo.mainRank, activeStage)}
                {lastCombo.bombSize !== undefined && ` (Bomb ${lastCombo.bombSize})`}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">Played By:</span>
              <span className="info-val">{getPlayerName(lastCombo.player)}</span>
            </div>
            <div className="match-cards-row">
              {lastCombo.cards.map((c) => renderMiniCard(c))}
            </div>
          </div>
        ) : (
          <div className="match-empty">
            {view?.state === "PLAYING"
              ? "Free Lead — Play any combination"
              : "No active trick"}
          </div>
        )}
      </div>

      {/* Main NESW Table Area */}
      <div className="table-area">
        {/* North (Teammate) */}
        <div className="table-north">{renderPlayerNode(seats.N)}</div>

        {/* Middle Row: West, Center Table Felt, East */}
        <div className="table-middle-row">
          <div className="table-west">{renderPlayerNode(seats.W)}</div>

          <div className="table-center">
            {view?.state === "WAITING" && (
              <div className="center-status-box">
                <h3>Waiting for all 4 players to Ready Up</h3>
                <p>
                  Players in room: {view.players.length} / 4 | Ready:{" "}
                  {view.ready.length} / 4
                </p>
                {view.won && view.won.length > 0 && (
                  <p className="last-round-summary">
                    Previous Round Finish Order:{" "}
                    {view.won.map((id, idx) => `#${idx + 1} ${getPlayerName(id)}`).join(", ")}
                  </p>
                )}
              </div>
            )}

            {view?.state === "ENDED" && (
              <div className="center-status-box">
                <h3>Game Over!</h3>
                <p>
                  Winners:{" "}
                  {view.winnerIds.map((id) => getPlayerName(id)).join(" & ")}
                </p>
              </div>
            )}

            {view?.state === "PLAYING" && (
              <div className="center-plays-grid">
                {(["N", "W", "E", "S"] as const).map((dir) => {
                  const slot = seats[dir];
                  const p = slot.player;
                  const combo = p ? latestPlayByPlayer.get(p.id) : undefined;
                  const isLatest =
                    combo && lastCombo && combo === lastCombo;

                  return (
                    <div
                      key={dir}
                      className={`played-slot played-slot-${dir.toLowerCase()} ${
                        isLatest ? "latest-play-highlight" : ""
                      }`}
                    >
                      <div className="played-slot-header">
                        {p ? p.name : dir}:
                      </div>
                      {p?.status === "passed" ? (
                        <div className="passed-label">PASSED</div>
                      ) : combo ? (
                        <div className="played-combo-cards">
                          {combo.cards.map((c) => renderMiniCard(c))}
                        </div>
                      ) : (
                        <div className="no-play-label">—</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="table-east">{renderPlayerNode(seats.E)}</div>
        </div>

        {/* South (You) */}
        <div className="table-south">{renderPlayerNode(seats.S)}</div>
      </div>

      {/* Bottom Controls + Player Hand */}
      <div className="bottom-hand-dock">
        <div className="action-bar">
          <div className="action-group-left">
            {view?.state === "WAITING" && (
              <button
                type="button"
                className="btn-primary"
                disabled={isReady}
                onClick={handleReady}
              >
                {isReady ? "Ready ✓ (Waiting for others)" : "Ready Up"}
              </button>
            )}

            {view?.state === "PLAYING" && (
              <>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!isMyTurn || selectedCardIds.size === 0}
                  onClick={handlePlaySelected}
                >
                  Play Selected ({selectedCardIds.size})
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!isMyTurn || (view?.currentRound.length ?? 0) === 0}
                  onClick={handlePass}
                >
                  Pass
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-small"
                  disabled={selectedCardIds.size === 0}
                  onClick={() => setSelectedCardIds(new Set())}
                >
                  Clear Selection
                </button>
              </>
            )}
          </div>

          <div className="action-group-right">
            <span className="drag-hint">Drag cards to reorder • Click to select</span>
            <button
              type="button"
              className="btn-secondary btn-small"
              disabled={orderedHand.length === 0}
              onClick={handleSortDefault}
            >
              Sort (Low → High)
            </button>
            <button
              type="button"
              className="btn-secondary btn-small"
              disabled={orderedHand.length === 0}
              onClick={handleSortBombsToEnd}
            >
              Sort Bombs to End
            </button>
          </div>
        </div>

        <div className="hand-row">
          {orderedHand.length === 0 ? (
            <div className="empty-hand-msg">
              {view?.state === "WAITING"
                ? "Cards will be dealt once all 4 players Ready Up."
                : "No cards in hand."}
            </div>
          ) : (
            orderedHand.map((card, index) => {
              const selected = selectedCardIds.has(card.id);
              const bombGroupIdx = bombGroupMap.get(card.id);
              const bombColor =
                bombGroupIdx !== undefined
                  ? BOMB_GROUP_PALETTE[bombGroupIdx % BOMB_GROUP_PALETTE.length]
                  : undefined;
              const red = isRedCard(card);
              const wild = isWildcard(card, activeStage);
              const shortVal = getCardShortValue(card);
              const suitSym = getSuitSymbol(card.suit.id);

              return (
                <div
                  key={card.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  onClick={() => toggleCardSelection(card.id)}
                  style={
                    bombColor
                      ? { borderBottom: `3px solid ${bombColor.border}` }
                      : undefined
                  }
                  className={[
                    "hand-card",
                    red ? "card-red" : "card-black",
                    selected ? "card-selected" : "",
                    wild ? "card-wildcard" : "",
                    bombColor ? "card-bomb-sorted" : "",
                    draggedIdx === index ? "card-dragging" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  title={`${card.value.name} of ${card.suit.name}${
                    wild ? " (Wildcard)" : ""
                  }`}
                >
                  <div className="card-corner-top">
                    <span className="card-rank">{shortVal}</span>
                    <span className="card-suit-small">{suitSym}</span>
                  </div>

                  <div className="card-center-suit">{suitSym}</div>

                  <div className="card-badges">
                    {wild && <span className="badge-wild">WILD</span>}
                    {bombColor && (
                      <span
                        className="badge-bomb"
                        style={{
                          color: bombColor.text,
                          backgroundColor: bombColor.bg,
                        }}
                      >
                        BOMB
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

