import React, { useEffect, useMemo, useRef, useState } from "react";
import { GameShell } from "../../components/common/GameShell";
import { CardDecoration, HandRow } from "../../components/common/HandRow";
import { MiniCard } from "../../components/common/CardView";
import { PlayerSeat } from "../../components/common/PlayerSeat";
import { Direction, seatsFor, SeatPlacement, TableLayout } from "../../components/common/TableLayout";
import { useHandOrder } from "../../hooks/useHandOrder";
import type { Card } from "../../types";
import { formatStageRank } from "../../utils/cards";
import { playGameSound } from "../../utils/sound";
import type { GameModule, GameViewProps } from "../types";
import { isNewDeal, reconcileBombGroups, reconcileHand } from "./reconcileHand";
import {
  formatComboType,
  getSeatIndex,
  isWildcard,
  selectTeams,
  sortBombsToEnd,
  sortCardsLowToHigh,
} from "./rules";
import type { GuanDanAction, GuanDanCombination, GuanDanPlayerView } from "./types";
import { useGuanDanSounds } from "./useGuanDanSounds";

type Props = GameViewProps<GuanDanPlayerView, GuanDanAction>;

const PLAYER_COUNT = 4;

const BOMB_GROUP_PALETTE: { text: string; bg: string; border: string }[] = [
  { text: "#6d28d9", bg: "#ede9fe", border: "#7c3aed" }, // Violet
  { text: "#1d4ed8", bg: "#dbeafe", border: "#2563eb" }, // Blue
  { text: "#047857", bg: "#d1fae5", border: "#059669" }, // Emerald
  { text: "#b45309", bg: "#fef3c7", border: "#d97706" }, // Amber
  { text: "#be185d", bg: "#fce7f3", border: "#db2777" }, // Pink / Magenta
  { text: "#0e7490", bg: "#cffafe", border: "#0891b2" }, // Cyan / Teal
  { text: "#4338ca", bg: "#e0e7ff", border: "#4f46e5" }, // Indigo
];

const InfoRow: React.FC<{ label: string; valueClass?: string; children: React.ReactNode }> = ({
  label,
  valueClass = "",
  children,
}) => (
  <div className="info-row">
    <span className="info-label">{label}:</span>
    <span className={`info-val ${valueClass}`}>{children}</span>
  </div>
);

export const GuanDanView: React.FC<Props> = ({
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
  const { order, orderRef, setOrder, selected, toggle, clearSelection, pruneSelection, move } =
    useHandOrder<Card>();
  const [bombGroupMap, setBombGroupMap] = useState<Map<string, number>>(new Map());
  const [clockwise, setClockwise] = useState(true);
  const [infoMinimized, setInfoMinimized] = useState(false);
  const prevStateRef = useRef<string | undefined>(undefined);

  const stage = view?.currentStage ?? 2;
  const mySeat = getSeatIndex(view, playerId);
  const isMyTurn = view?.state === "PLAYING" && view.players[view.turn]?.id === playerId;
  const isReady = view?.ready.includes(playerId) ?? false;

  useGuanDanSounds(view, mySeat);

  // Keep the local hand order, selection and bomb colors in step with the server hand.
  useEffect(() => {
    const serverHand = view?.hand ?? [];
    const prevState = prevStateRef.current;
    prevStateRef.current = view?.state;

    if (!view || serverHand.length === 0) {
      setOrder([]);
      clearSelection();
      setBombGroupMap(new Map());
      return;
    }

    if (isNewDeal(orderRef.current, serverHand, prevState, view.state)) {
      setOrder(sortCardsLowToHigh(serverHand, stage));
      clearSelection();
      setBombGroupMap(new Map());
      return;
    }

    const nextHand = reconcileHand(orderRef.current, serverHand, stage);
    setOrder(nextHand);
    pruneSelection(new Set(serverHand.map((c) => c.id)));
    setBombGroupMap((prev) => reconcileBombGroups(prev, serverHand, stage));
  }, [view, stage, setOrder, orderRef, clearSelection, pruneSelection]);

  const playerNames = useMemo(
    () => new Map((view?.players ?? []).map((p) => [p.id, p.name])),
    [view]
  );
  const nameOf = (id: string) => playerNames.get(id) ?? id;

  const latestPlayByPlayer = useMemo(
    () => new Map((view?.currentRound ?? []).map((combo) => [combo.player, combo])),
    [view]
  );
  const lastCombo: GuanDanCombination | undefined = view?.currentRound.at(-1);
  const { mine, opp } = selectTeams(view, mySeat);

  const sortDefault = () => {
    setOrder((prev) => sortCardsLowToHigh(prev, stage));
    setBombGroupMap(new Map());
  };

  const sortBombs = () => {
    const { sorted, bombGroupMap: groups } = sortBombsToEnd(orderRef.current, stage);
    setOrder(sorted);
    setBombGroupMap(groups);
  };

  const playSelected = () => {
    if (selected.size === 0) return;
    // Preserve hand order for selected cards
    const cardIds = order.filter((c) => selected.has(c.id)).map((c) => c.id);
    sendAction({ type: "PLAY", payload: { cardIds } });
    clearSelection();
  };

  const pass = () => {
    playGameSound("pass", playerId);
    sendAction({ type: "PASS" });
    clearSelection();
  };

  const decorateCard = (card: Card): CardDecoration => {
    const groupIdx = bombGroupMap.get(card.id);
    const bomb = groupIdx === undefined ? undefined : BOMB_GROUP_PALETTE[groupIdx % BOMB_GROUP_PALETTE.length];
    const wild = isWildcard(card, stage);
    return {
      extraClass: [wild && "card-wildcard", bomb && "card-bomb-sorted"].filter(Boolean).join(" "),
      style: bomb ? { borderBottom: `3px solid ${bomb.border}` } : undefined,
      title: `${card.value.name} of ${card.suit.name}${wild ? " (Wildcard)" : ""}`,
      badges: (
        <>
          {wild && <span className="badge-wild">WILD</span>}
          {bomb && (
            <span className="badge-bomb" style={{ color: bomb.text, backgroundColor: bomb.bg }}>
              BOMB
            </span>
          )}
        </>
      ),
    };
  };

  /** A seat plus its played cards: S play area above, N below, E left, W right. */
  const renderSeat = ({ direction, seatIndex, offset }: SeatPlacement) => {
    const p = view?.players[seatIndex];
    const isTurn = view?.state === "PLAYING" && view.turn === seatIndex;
    const isMe = offset === 0 && p?.id === playerId;
    const combo = view?.state === "PLAYING" && p ? latestPlayByPlayer.get(p.id) : undefined;
    const finishOrder = p ? view?.won.indexOf(p.id) ?? -1 : -1;

    const playArea = (
      <div className={`player-play-area ${combo && combo === lastCombo ? "latest-play-highlight" : ""}`}>
        {view?.state === "PLAYING" && p?.status === "passed" ? (
          <div className="passed-label">PASSED</div>
        ) : combo ? (
          <>
            <div className="played-combo-cards">
              {combo.cards.map((c) => (
                <MiniCard key={c.id} card={c} wild={isWildcard(c, stage)} />
              ))}
            </div>
            <div className="played-combo-type">{formatComboType(combo.type)}</div>
          </>
        ) : (
          <div className="no-play-label">—</div>
        )}
      </div>
    );

    const statusLabel =
      finishOrder >= 0
        ? `Out (#${finishOrder + 1})`
        : p?.status?.toUpperCase() ?? (isTurn ? "THINKING" : "WAITING");
    const ready = !!p && !!view?.ready.includes(p.id);

    const seat = (
      <PlayerSeat
        direction={direction}
        name={p?.name}
        isTurn={isTurn}
        isMe={isMe}
        isTeammate={offset === 2}
      >
        <span>Cards: {p?.cardCount ?? 0}</span>
        {p && view?.state === "WAITING" && (
          <span className={`status-pill ${ready ? "ready" : "wait"}`}>
            {ready ? "Ready" : "Not Ready"}
          </span>
        )}
        {p && view?.state !== "WAITING" && (
          <span className={`status-pill status-${p.status ?? "waiting"}`}>{statusLabel}</span>
        )}
      </PlayerSeat>
    );

    const playFirst = direction === "S" || direction === "E";
    return (
      <div className={`seat-with-play seat-with-play-${direction.toLowerCase()}`}>
        {playFirst ? playArea : seat}
        {playFirst ? seat : playArea}
      </div>
    );
  };

  const seats = Object.fromEntries(
    seatsFor(PLAYER_COUNT, mySeat, clockwise).map((s) => [s.direction, renderSeat(s)])
  ) as Record<Direction, React.ReactNode>;

  const topRight = (
    <div className={`top-right-info ${infoMinimized ? "info-minimized" : ""}`}>
      <div className="info-header">
        <span className="info-title">Game Info</span>
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
        <InfoRow label="Status">
          {view?.state ?? "CONNECTING"}
          {view?.state === "WAITING" && ` (${view.players.length}/${PLAYER_COUNT} Joined)`}
        </InfoRow>
        <InfoRow label="Current Stage" valueClass="highlight-stage">
          {formatStageRank(stage)} (Wild: ♥{formatStageRank(stage)})
        </InfoRow>
        <InfoRow label="Team Stages">
          You: {formatStageRank(mine.stage)} | Them: {formatStageRank(opp.stage)}
        </InfoRow>
        <InfoRow label="Team Strikes">
          You: {formatStageRank(mine.strikes)} | Them: {formatStageRank(opp.strikes)}
        </InfoRow>
        <InfoRow label="Current Turn">
          {view?.state === "PLAYING" ? view.players[view.turn]?.name ?? "—" : "—"}
        </InfoRow>
        <div className="info-row">
          <span className="info-label">Turn Order:</span>
          <select
            className="turn-order-select"
            value={clockwise ? "clockwise" : "counterclockwise"}
            onChange={(e) => setClockwise(e.target.value === "clockwise")}
          >
            <option value="clockwise">Clockwise</option>
            <option value="counterclockwise">Counterclockwise</option>
          </select>
        </div>
      </div>
    </div>
  );

  const table = (
    <TableLayout seats={seats}>
      {view?.state === "WAITING" && (
        <div className="center-status-box">
          <h3>Waiting for all {PLAYER_COUNT} players to Ready Up</h3>
          <p>
            Players in room: {view.players.length} / {PLAYER_COUNT} | Ready: {view.ready.length} /{" "}
            {PLAYER_COUNT}
          </p>
          {view.won.length > 0 && (
            <p className="last-round-summary">
              Previous Round Finish Order:{" "}
              {view.won.map((id, idx) => `#${idx + 1} ${nameOf(id)}`).join(", ")}
            </p>
          )}
        </div>
      )}
      {view?.state === "ENDED" && (
        <div className="center-status-box">
          <h3>Game Over!</h3>
          <p>Winners: {view.winnerIds.map(nameOf).join(" & ")}</p>
        </div>
      )}
    </TableLayout>
  );

  const footer = (
    <>
      <div className="action-bar">
        <div className="action-group-left">
          {view?.state === "WAITING" && (
            <button
              type="button"
              className="btn-primary"
              disabled={isReady}
              onClick={() => sendAction({ type: "READY" })}
            >
              {isReady ? "Ready ✓ (Waiting for others)" : "Ready Up"}
            </button>
          )}
          {view?.state === "PLAYING" && (
            <>
              <button
                type="button"
                className="btn-primary"
                disabled={!isMyTurn || selected.size === 0}
                onClick={playSelected}
              >
                Play Selected ({selected.size})
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={!isMyTurn || view.currentRound.length === 0}
                onClick={pass}
              >
                Pass
              </button>
              <button
                type="button"
                className="btn-secondary btn-small"
                disabled={selected.size === 0}
                onClick={clearSelection}
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
            disabled={order.length === 0}
            onClick={sortDefault}
          >
            Sort (Low → High)
          </button>
          <button
            type="button"
            className="btn-secondary btn-small"
            disabled={order.length === 0}
            onClick={sortBombs}
          >
            Sort Bombs to End
          </button>
        </div>
      </div>

      <HandRow
        cards={order}
        selectedIds={selected}
        onToggle={toggle}
        onMove={move}
        decorate={decorateCard}
        emptyMessage={
          view?.state === "WAITING"
            ? `Cards will be dealt once all ${PLAYER_COUNT} players Ready Up.`
            : "No cards in hand."
        }
      />
    </>
  );

  return (
    <GameShell
      roomId={roomId}
      playerId={playerId}
      isMyTurn={isMyTurn}
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

export const guandanModule: GameModule<GuanDanPlayerView, GuanDanAction> = {
  id: "guandan",
  label: "Guan Dan",
  View: GuanDanView,
};

