import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  ChatMessage,
  GuanDanAction,
  GuanDanCombination,
  GuanDanPlayerInfo,
  GuanDanPlayerView,
} from "../types";
import {
  formatComboType,
  formatMainRank,
  formatStageRank,
  getCardShortValue,
  getSuitSymbol,
  isRedCard,
  isValidBombGroup,
  isWildcard,
  sortBombsToEnd,
  sortCardsLowToHigh,
} from "../utils/cards";

interface GameViewProps {
  roomId: string;
  playerId: string;
  view: GuanDanPlayerView | null;
  error: string | null;
  chatMessages: ChatMessage[];
  onClearError: () => void;
  onSendAction: (action: GuanDanAction) => void;
  onSendMessage: (message: string) => void;
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
  chatMessages,
  onClearError,
  onSendAction,
  onSendMessage,
  onLeaveRoom,
}) => {
  const [orderedHand, setOrderedHand] = useState<Card[]>([]);
  const orderedHandRef = useRef<Card[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [bombGroupMap, setBombGroupMap] = useState<Map<string, number>>(new Map());
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const handContainerRef = useRef<HTMLDivElement>(null);
  const [handRowWidth, setHandRowWidth] = useState<number>(1000);

  // Seat visual turn order around the table (default: clockwise)
  const [turnOrder, setTurnOrder] = useState<"clockwise" | "counterclockwise">("clockwise");

  // Chat input and collapse state
  const [chatInput, setChatInput] = useState<string>("");
  const [isChatCollapsed, setIsChatCollapsed] = useState<boolean>(false);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);

  // "Your Turn" pop-up animation state
  const [showTurnPopup, setShowTurnPopup] = useState<boolean>(false);
  const [turnPopupFast, setTurnPopupFast] = useState<boolean>(false);
  const prevIsMyTurnRef = useRef<boolean>(false);
  const turnPopupTimerRef = useRef<number | null>(null);
  const turnPopupStartRef = useRef<number>(0);
  const turnPopupFastRef = useRef<boolean>(false);

  useEffect(() => {
    const updateWidth = () => {
      if (handContainerRef.current) {
        setHandRowWidth(handContainerRef.current.clientWidth);
      }
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  // Compute dynamic overlap so all cards fit without clipping even in tiled windows
  const cardMarginLeft = useMemo(() => {
    const count = orderedHand.length;
    if (count <= 1) return 0;
    const cardWidth = 62;
    const available = Math.max(300, handRowWidth - 40);
    // If natural width exceeds available width, increase negative margin
    const neededWidth = count * cardWidth;
    if (neededWidth > available) {
      const overlapPerCard = (neededWidth - available) / (count - 1);
      const margin = -Math.min(46, Math.max(18, Math.ceil(overlapPerCard)));
      return margin;
    }
    return -20;
  }, [orderedHand.length, handRowWidth]);

  // Track which team won the previous stage so we know whose stage is active
  const lastWinningTeamRef = useRef<number>(0);
  const prevStagesRef = useRef<[number, number]>([2, 2]);
  const prevGameStateRef = useRef<string | undefined>(undefined);
  const lastPlayedIdsRef = useRef<Set<string>>(new Set());

  // Compute active stage number (2..13, or 1 for Ace)
  // Uses authoritative view.currentStage from the backend, with fallback to stage inference
  const activeStage = useMemo(() => {
    if (!view) return 2;
    if (view.currentStage !== undefined) {
      return view.currentStage;
    }
    const [stage0 = 2, stage1 = 2] = view.stage ?? [2, 2];
    const [prev0, prev1] = prevStagesRef.current;

    if (view.state !== "PLAYING" && view.won && view.won.length > 0) {
      const firstWinnerIdx = view.players.findIndex((p) => p.id === view.won[0]);
      if (firstWinnerIdx !== -1) {
        lastWinningTeamRef.current = firstWinnerIdx % 2;
      }
    } else if (stage0 !== prev0 || stage1 !== prev1) {
      if (stage0 !== prev0 && stage1 === prev1) {
        lastWinningTeamRef.current = 0;
      } else if (stage1 !== prev1 && stage0 === prev0) {
        lastWinningTeamRef.current = 1;
      }
    }
    prevStagesRef.current = [stage0, stage1];

    if (stage0 === stage1) return stage0;
    return view.stage[lastWinningTeamRef.current] ?? stage0;
  }, [view]);

  // Synchronize local orderedHand and bombGroupMap with server view.hand
  useEffect(() => {
    if (!view) {
      orderedHandRef.current = [];
      setOrderedHand([]);
      setSelectedCardIds(new Set());
      setBombGroupMap(new Map());
      return;
    }

    const serverHand = view.hand ?? [];
    const prevState = prevGameStateRef.current;
    prevGameStateRef.current = view.state;

    if (serverHand.length === 0) {
      orderedHandRef.current = [];
      setOrderedHand([]);
      setSelectedCardIds(new Set());
      setBombGroupMap(new Map());
      return;
    }

    const prevHand = orderedHandRef.current;
    const isNewDeal =
      prevHand.length === 0 ||
      serverHand.length > prevHand.length ||
      (prevState === "WAITING" && view.state === "PLAYING");

    if (isNewDeal) {
      const sorted = sortCardsLowToHigh(serverHand, activeStage);
      orderedHandRef.current = sorted;
      setOrderedHand(sorted);
      setBombGroupMap(new Map());
      setSelectedCardIds(new Set());
      return;
    }

    // Preserve existing custom drag/sort order for remaining cards
    const serverById = new Map<string, Card>();
    for (const c of serverHand) {
      serverById.set(c.id, c);
    }

    // Handle duplicate cards across the 2 decks: if a played card ID is still in serverHand
    // because backend Deck.removeCard removed an identical twin first, swap it into the twin's slot
    const adjustedPrev = [...prevHand];
    const playedIds = lastPlayedIdsRef.current;
    const twinReplacementMap = new Map<string, string>();
    const swappedPlayedTwinIds = new Set<string>();

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
            const other = adjustedPrev[swapIdx];
            twinReplacementMap.set(c.id, other.id);
            swappedPlayedTwinIds.add(other.id);
            adjustedPrev[i] = other;
            adjustedPrev[swapIdx] = c;
            playedIds.delete(other.id);
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

    const added = serverHand.filter((c) => !keptIds.has(c.id));
    const nextHand =
      added.length > 0 ? [...kept, ...sortCardsLowToHigh(added, activeStage)] : kept;
    orderedHandRef.current = nextHand;
    setOrderedHand(nextHand);

    // Clean up selected IDs that are no longer in hand
    const validIds = new Set(serverHand.map((c) => c.id));
    setSelectedCardIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (validIds.has(id)) next.add(id);
      }
      return next;
    });

    // Re-validate bomb groups so broken bombs immediately lose their bomb badge/border
    setBombGroupMap((prev) => {
      if (prev.size === 0) return prev;
      const candidateMap = new Map<string, number>();
      for (const [id, groupIdx] of prev.entries()) {
        if (swappedPlayedTwinIds.has(id)) {
          // This twin ID was actually played by the user; its slot was removed
          continue;
        }
        const replacementId = twinReplacementMap.get(id);
        if (replacementId && serverById.has(replacementId)) {
          candidateMap.set(replacementId, groupIdx);
        } else if (serverById.has(id)) {
          candidateMap.set(id, groupIdx);
        }
      }

      const groups = new Map<number, Card[]>();
      for (const [cardId, groupIdx] of candidateMap.entries()) {
        const cardObj = serverById.get(cardId);
        if (cardObj) {
          const list = groups.get(groupIdx) ?? [];
          list.push(cardObj);
          groups.set(groupIdx, list);
        }
      }

      const validated = new Map<string, number>();
      for (const [groupIdx, groupCards] of groups.entries()) {
        if (isValidBombGroup(groupCards, activeStage)) {
          for (const cardObj of groupCards) {
            validated.set(cardObj.id, groupIdx);
          }
        }
      }
      return validated;
    });
  }, [view, activeStage]);

  // Determine seat index of current user
  const mySeatIndex = useMemo(() => {
    if (!view) return 0;
    const idx = view.players.findIndex((p) => p.id === playerId);
    return idx >= 0 ? idx : 0;
  }, [view, playerId]);

  // Build NESW seats with S = You, N = Teammate ((mySeatIndex + 2) % 4)
  // Clockwise (Bottom -> Left -> Top -> Right): W is +1, E is +3
  // Counterclockwise (Bottom -> Right -> Top -> Left): E is +1, W is +3
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

    const westOffset = turnOrder === "clockwise" ? 1 : 3;
    const eastOffset = turnOrder === "clockwise" ? 3 : 1;

    return {
      S: makeSlot("S", 0, "South (You)"),
      W: makeSlot("W", westOffset, "West (Opponent)"),
      N: makeSlot("N", 2, "North (Teammate)"),
      E: makeSlot("E", eastOffset, "East (Opponent)"),
    };
  }, [view, mySeatIndex, playerId, turnOrder]);

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

  // Trigger "Your Turn" animated pop-up when transitioning into player's turn (max 1000ms)
  useEffect(() => {
    const wasMyTurn = prevIsMyTurnRef.current;
    prevIsMyTurnRef.current = isMyTurn;

    if (isMyTurn && !wasMyTurn) {
      if (turnPopupTimerRef.current !== null) {
        window.clearTimeout(turnPopupTimerRef.current);
      }
      turnPopupStartRef.current = Date.now();
      turnPopupFastRef.current = false;
      setTurnPopupFast(false);
      setShowTurnPopup(true);
      turnPopupTimerRef.current = window.setTimeout(() => {
        setShowTurnPopup(false);
        turnPopupTimerRef.current = null;
      }, 1000);
    } else if (!isMyTurn && showTurnPopup) {
      if (turnPopupTimerRef.current !== null) {
        window.clearTimeout(turnPopupTimerRef.current);
        turnPopupTimerRef.current = null;
      }
      setShowTurnPopup(false);
    }
  }, [isMyTurn, showTurnPopup]);

  useEffect(() => {
    return () => {
      if (turnPopupTimerRef.current !== null) {
        window.clearTimeout(turnPopupTimerRef.current);
      }
    };
  }, []);

  // Speed up "Your Turn" pop-up to 2x speed (500ms total / halves remaining time) on mouse movement
  const speedUpTurnPopupOnMouseMove = () => {
    if (!showTurnPopup || turnPopupFastRef.current) return;
    turnPopupFastRef.current = true;
    setTurnPopupFast(true);

    const elapsed = Date.now() - turnPopupStartRef.current;
    const remainingFast = Math.min(500, Math.max(0, Math.ceil((1000 - elapsed) / 2)));

    if (turnPopupTimerRef.current !== null) {
      window.clearTimeout(turnPopupTimerRef.current);
    }
    turnPopupTimerRef.current = window.setTimeout(() => {
      setShowTurnPopup(false);
      turnPopupTimerRef.current = null;
    }, remainingFast);
  };

  useEffect(() => {
    if (!showTurnPopup) return;
    const onMove = () => speedUpTurnPopupOnMouseMove();
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [showTurnPopup]);

  // Auto-scroll chat messages when a new message is added
  useEffect(() => {
    if (!isChatCollapsed) {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, isChatCollapsed]);

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
      orderedHandRef.current = updated;
      return updated;
    });
    setDraggedIdx(targetIndex);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
  };

  // Sort handlers
  const handleSortDefault = () => {
    setOrderedHand((prev) => {
      const sorted = sortCardsLowToHigh(prev, activeStage);
      orderedHandRef.current = sorted;
      return sorted;
    });
    setBombGroupMap(new Map());
  };

  const handleSortBombsToEnd = () => {
    setOrderedHand((prev) => {
      const { sorted, bombGroupMap: nextGroupMap } = sortBombsToEnd(prev, activeStage);
      orderedHandRef.current = sorted;
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

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setChatInput("");
  };

  const renderMiniCard = (card: Card) => {
    const red = isRedCard(card);
    const wild = isWildcard(card, activeStage);
    return (
      <span
        key={card.id}
        className={`mini-card ${red ? "card-red" : "card-black"} ${wild ? "card-wild" : ""
          }`}
      >
        {getSuitSymbol(card.suit.id)}
        {getCardShortValue(card)}
      </span>
    );
  };

  // Render a single player's seat node + their adjacent played cards / PASSED status area
  // S: play area ABOVE seat; N: play area BELOW seat; E: play area LEFT of seat; W: play area RIGHT of seat
  const renderPlayerNode = (slot: SeatSlot) => {
    const p = slot.player;
    const playerReady = p ? view?.ready?.includes(p.id) : false;
    const finishOrder = p && view?.won ? view.won.indexOf(p.id) : -1;
    const combo =
      view?.state === "PLAYING" && p ? latestPlayByPlayer.get(p.id) : undefined;
    const isLatest = Boolean(combo && lastCombo && combo === lastCombo);
    const dirLower = slot.direction.toLowerCase();

    const playAreaNode = (
      <div
        className={`player-play-area ${isLatest ? "latest-play-highlight" : ""}`}
      >
        {view?.state === "PLAYING" && p?.status === "passed" ? (
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

    const seatNode = (
      <div
        className={`player-seat seat-${dirLower} ${slot.isTurn ? "seat-active-turn" : ""
          }`}
      >
        <div
          className={`player-circle ${slot.isTurn ? "circle-turn" : ""} ${slot.isMe ? "circle-me" : slot.isTeammate ? "circle-teammate" : ""
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

    const playFirst = slot.direction === "S" || slot.direction === "E";

    return (
      <div className={`seat-with-play seat-with-play-${dirLower}`}>
        {playFirst ? (
          <>
            {playAreaNode}
            {seatNode}
          </>
        ) : (
          <>
            {seatNode}
            {playAreaNode}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="game-screen" onMouseMove={speedUpTurnPopupOnMouseMove}>
      {/* Non-blocking "Your Turn" Animated Pop-up (max 1s, 2x speed on mouse move) */}
      {showTurnPopup && (
        <div
          className={`turn-popup-overlay ${turnPopupFast ? "turn-popup-fast" : ""
            }`}
        >
          <div
            className={`turn-popup-badge ${turnPopupFast ? "turn-popup-fast" : ""
              }`}
          >
            Your Turn!
          </div>
        </div>
      )}

      {/* Top-Left Room Banner */}
      <div className="top-left-bar">
        <div className="room-badge">
          Room: <strong>{roomId}</strong>
        </div>
        <button type="button" className="btn-secondary btn-small" onClick={onLeaveRoom}>
          Leave Room
        </button>
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
        <div className="info-row">
          <span className="info-label">Turn Order:</span>
          <select
            className="turn-order-select"
            value={turnOrder}
            onChange={(e) =>
              setTurnOrder(e.target.value as "clockwise" | "counterclockwise")
            }
          >
            <option value="clockwise">Clockwise</option>
            <option value="counterclockwise">Counterclockwise</option>
          </select>
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

        {/* Middle Row: West, Center Table Felt (Status + Chat-Box), East */}
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

            {/* Center Scrollable & Togglable Chat-Box */}
            <div
              className={`chat-box-container ${isChatCollapsed ? "chat-collapsed" : ""
                }`}
            >
              <div className="chat-header">
                <span>Table Chat ({chatMessages.length})</span>
                <button
                  type="button"
                  className="btn-secondary btn-small chat-toggle-btn"
                  onClick={() => setIsChatCollapsed((prev) => !prev)}
                >
                  {isChatCollapsed ? "Expand ▲" : "Hide ▼"}
                </button>
              </div>
              {!isChatCollapsed && (
                <>
                  <div className="chat-messages">
                    {chatMessages.length === 0 ? (
                      <div className="chat-empty">blub blub blub</div>
                    ) : (
                      chatMessages.map((msg) => (
                        <div key={msg.id} className="chat-message-item">
                          <span className="chat-msg-sender">{msg.sender}:</span>
                          <span>{msg.text}</span>
                        </div>
                      ))
                    )}
                    <div ref={chatMessagesEndRef} />
                  </div>
                  <form className="chat-input-row" onSubmit={handleSendChat}>
                    <input
                      type="text"
                      className="chat-input"
                      placeholder="Type a message..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                    />
                    <button
                      type="submit"
                      className="chat-send-btn"
                      disabled={!chatInput.trim()}
                    >
                      Send
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>

          <div className="table-east">{renderPlayerNode(seats.E)}</div>
        </div>

        {/* South (You) */}
        <div className="table-south">{renderPlayerNode(seats.S)}</div>
      </div>

      {/* Bottom Controls + Error Banner Right Above Hand + Player Hand */}
      <div className="bottom-hand-dock">
        {error && (
          <div className="hand-error-banner">
            <span>{error}</span>
            <button type="button" className="btn-clear" onClick={onClearError}>
              ✕
            </button>
          </div>
        )}

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

        <div className="hand-row" ref={handContainerRef}>
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
                  style={{
                    marginLeft: index === 0 ? 0 : `${cardMarginLeft}px`,
                    ...(bombColor ? { borderBottom: `3px solid ${bombColor.border}` } : {}),
                  }}
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
                  title={`${card.value.name} of ${card.suit.name}${wild ? " (Wildcard)" : ""
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
