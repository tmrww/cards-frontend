import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { card } from "../../test/factories";
import type { SpeedPlayerView } from "./types";
import { SpeedView } from "./SpeedView";

vi.mock("../../utils/sound", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../utils/sound")>();
  return {
    ...actual,
    playGameSound: vi.fn(),
    triggerTextSound: vi.fn(),
    loadSoundConfig: vi.fn().mockResolvedValue(undefined),
  };
});

const makeSpeedView = (overrides: Partial<SpeedPlayerView> = {}): SpeedPlayerView => ({
  hand: [
    card("h1", 0, 2),
    card("h2", 1, 5),
    card("h3", 2, 8),
    card("h4", 3, 11),
    card("h5", 0, 1),
  ],
  players: [
    { id: "p0", name: "Alice", handSize: 5, deckSize: 15 },
    { id: "p1", name: "Bob", handSize: 5, deckSize: 14 },
  ],
  topCards: [card("t0", 1, 4), card("t1", 3, 9)],
  stuckPiles: [5, 5],
  ...overrides,
});

const renderSpeed = (
  viewOverrides: Partial<SpeedPlayerView> = {},
  playerId = "p0"
) => {
  const sendAction = vi.fn();
  const sendChat = vi.fn();
  const clearError = vi.fn();
  const leaveRoom = vi.fn();
  const view = makeSpeedView(viewOverrides);

  const utils = render(
    <SpeedView
      roomId="ROOM1"
      playerId={playerId}
      view={view}
      chatMessages={[]}
      error={null}
      sendAction={sendAction}
      sendChat={sendChat}
      clearError={clearError}
      leaveRoom={leaveRoom}
    />
  );

  return { ...utils, sendAction, sendChat, clearError, leaveRoom, view };
};

describe("SpeedView", () => {
  describe("setup rendering", () => {
    it("places opponent at N, you at S, decks on left/right, 4 center piles, and 5-card hand", () => {
      const { container } = renderSpeed();

      const northSeat = container.querySelector(".table-north");
      const southSeat = container.querySelector(".table-south");
      expect(northSeat).toBeInTheDocument();
      expect(southSeat).toBeInTheDocument();
      expect(northSeat).toHaveTextContent("Bob");
      expect(southSeat).toHaveTextContent("Alice");

      // Your draw deck on S left (before PlayerSeat), opponent draw deck on N right (after PlayerSeat)
      const southRow = container.querySelector(".speed-seat-south");
      const northRow = container.querySelector(".speed-seat-north");
      expect(southRow?.firstElementChild).toHaveAttribute("data-testid", "my-deck");
      expect(northRow?.lastElementChild).toHaveAttribute("data-testid", "opponent-deck");
      expect(screen.getByTestId("my-deck")).toHaveTextContent("15");
      expect(screen.getByTestId("opponent-deck")).toHaveTextContent("14");

      // 2 face-down stuck piles with counts and 2 face-up discard piles
      const stuck0 = screen.getByTestId("stuck-pile-0");
      const stuck1 = screen.getByTestId("stuck-pile-1");
      expect(stuck0).toHaveTextContent("5");
      expect(stuck1).toHaveTextContent("5");
      expect(stuck0.querySelector(".card")).toBeNull();
      expect(stuck1.querySelector(".card")).toBeNull();

      const discard0 = screen.getByTestId("discard-pile-0");
      const discard1 = screen.getByTestId("discard-pile-1");
      expect(discard0).toHaveTextContent("4");
      expect(discard1).toHaveTextContent("9");

      // 5-card hand
      for (let i = 0; i < 5; i++) {
        expect(screen.getByTestId(`speed-card-${i}`)).toBeInTheDocument();
      }
      expect(screen.queryByTestId("speed-card-5")).toBeNull();
    });
  });

  describe("discard pile selection", () => {
    it("starts with no pile selected and persists click selection", () => {
      renderSpeed();
      const pile0 = screen.getByTestId("discard-pile-0");
      const pile1 = screen.getByTestId("discard-pile-1");

      expect(pile0).toHaveAttribute("aria-pressed", "false");
      expect(pile1).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByTestId("speed-pile-hint")).toBeInTheDocument();

      fireEvent.click(pile0);
      expect(pile0).toHaveAttribute("aria-pressed", "true");
      expect(pile0).toHaveClass("speed-discard-pile--selected");
      expect(pile1).toHaveAttribute("aria-pressed", "false");

      // Selection persists after another action (e.g. drawing)
      fireEvent.click(screen.getByTestId("speed-draw-btn"));
      expect(pile0).toHaveAttribute("aria-pressed", "true");

      fireEvent.click(pile1);
      expect(pile0).toHaveAttribute("aria-pressed", "false");
      expect(pile1).toHaveAttribute("aria-pressed", "true");
      expect(pile1).toHaveClass("speed-discard-pile--selected");
    });

    it("selects pile 0 with ArrowLeft and pile 1 with ArrowRight", () => {
      renderSpeed();
      const pile0 = screen.getByTestId("discard-pile-0");
      const pile1 = screen.getByTestId("discard-pile-1");

      fireEvent.keyDown(window, { key: "ArrowLeft" });
      expect(pile0).toHaveAttribute("aria-pressed", "true");
      expect(pile1).toHaveAttribute("aria-pressed", "false");

      fireEvent.keyDown(window, { key: "ArrowRight" });
      expect(pile0).toHaveAttribute("aria-pressed", "false");
      expect(pile1).toHaveAttribute("aria-pressed", "true");
    });
  });

  describe("card play guard", () => {
    it("does not send PLAY on double-click, 1-5 keys, or dual W/ArrowUp when no pile is selected", () => {
      const { sendAction } = renderSpeed();
      const card0 = screen.getByTestId("speed-card-0");

      // Double-click
      fireEvent.doubleClick(card0);
      // Number keys 1-5 in absolute mode
      fireEvent.keyDown(window, { key: "1" });
      fireEvent.keyDown(window, { key: "5" });
      // W / ArrowUp in dual mode
      fireEvent.change(screen.getByTestId("speed-control-mode"), { target: { value: "dual-cards-pile" } });
      fireEvent.keyDown(window, { key: "w" });
      fireEvent.keyDown(window, { key: "ArrowUp" });

      expect(sendAction).not.toHaveBeenCalled();
    });
  });

  describe("double-click play", () => {
    it("plays { type: 'PLAY', payload: { cardId, pile } } to the selected pile", () => {
      const { sendAction } = renderSpeed();
      fireEvent.click(screen.getByTestId("discard-pile-1"));
      fireEvent.doubleClick(screen.getByTestId("speed-card-2"));

      expect(sendAction).toHaveBeenCalledTimes(1);
      expect(sendAction).toHaveBeenCalledWith({
        type: "PLAY",
        payload: { cardId: "h3", pile: 1 },
      });
    });
  });

  describe("drag-out play", () => {
    it("does not play when dragged < 90% out (e.g. 50% or 80%) and plays when >= 90% out", () => {
      const { sendAction } = renderSpeed();

      const handArea = screen.getByTestId("speed-hand-area");
      const card0 = screen.getByTestId("speed-card-0");
      const pile0 = screen.getByTestId("discard-pile-0");
      const pile1 = screen.getByTestId("discard-pile-1");

      // Hand area: y from 400 to 520. Card: y from 410 to 500 (height 90, width 62).
      vi.spyOn(handArea, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 400, 500, 120));
      vi.spyOn(card0, "getBoundingClientRect").mockReturnValue(new DOMRect(50, 410, 62, 90));
      // Midline between pile0 (right=260) and pile1 (left=300) is 280.
      vi.spyOn(pile0, "getBoundingClientRect").mockReturnValue(new DOMRect(180, 200, 80, 110));
      vi.spyOn(pile1, "getBoundingClientRect").mockReturnValue(new DOMRect(300, 200, 80, 110));

      // Drag up by 55px -> final top=355, bottom=445 -> overlapY = 45/90 = 50% inside (50% out) -> no play
      fireEvent.pointerDown(card0, { button: 0, clientX: 80, clientY: 450 });
      fireEvent.pointerMove(window, { clientX: 80, clientY: 395 });
      fireEvent.pointerUp(window, { clientX: 80, clientY: 395 });
      expect(sendAction).not.toHaveBeenCalled();

      // Drag up by 81px -> final top=329, bottom=419 -> overlapY = 19/90 = 21.1% inside (~79% out) -> no play
      fireEvent.pointerDown(card0, { button: 0, clientX: 80, clientY: 450 });
      fireEvent.pointerMove(window, { clientX: 80, clientY: 369 });
      fireEvent.pointerUp(window, { clientX: 80, clientY: 369 });
      expect(sendAction).not.toHaveBeenCalled();

      // Drag up by 91px -> final top=319, bottom=409 -> overlapY = 9/90 = 10% inside (90% out) -> plays to pile 0 on left side even with no pile selected
      fireEvent.pointerDown(card0, { button: 0, clientX: 80, clientY: 450 });
      fireEvent.pointerMove(window, { clientX: 200, clientY: 359 });
      fireEvent.pointerUp(window, { clientX: 200, clientY: 359 });
      expect(sendAction).toHaveBeenCalledTimes(1);
      expect(sendAction).toHaveBeenLastCalledWith({
        type: "PLAY",
        payload: { cardId: "h1", pile: 0 },
      });

      // Drag >= 90% out on right side of midline (> 280) plays to pile 1 even with no pile selected
      fireEvent.pointerDown(card0, { button: 0, clientX: 80, clientY: 450 });
      fireEvent.pointerMove(window, { clientX: 340, clientY: 350 });
      fireEvent.pointerUp(window, { clientX: 340, clientY: 350 });
      expect(sendAction).toHaveBeenCalledTimes(2);
      expect(sendAction).toHaveBeenLastCalledWith({
        type: "PLAY",
        payload: { cardId: "h1", pile: 1 },
      });
    });

    it("highlights target discard pile with .speed-discard-pile--selected while dragging >= 90% out and clears on release", () => {
      renderSpeed();

      const handArea = screen.getByTestId("speed-hand-area");
      const card0 = screen.getByTestId("speed-card-0");
      const pile0 = screen.getByTestId("discard-pile-0");
      const pile1 = screen.getByTestId("discard-pile-1");

      vi.spyOn(handArea, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 400, 500, 120));
      vi.spyOn(card0, "getBoundingClientRect").mockReturnValue(new DOMRect(50, 410, 62, 90));
      vi.spyOn(pile0, "getBoundingClientRect").mockReturnValue(new DOMRect(180, 200, 80, 110));
      vi.spyOn(pile1, "getBoundingClientRect").mockReturnValue(new DOMRect(300, 200, 80, 110));

      expect(pile0).not.toHaveClass("speed-discard-pile--selected");
      expect(pile1).not.toHaveClass("speed-discard-pile--selected");

      fireEvent.pointerDown(card0, { button: 0, clientX: 80, clientY: 450 });
      // Hover >= 90% out on left side -> pile 0 highlighted
      fireEvent.pointerMove(window, { clientX: 200, clientY: 350 });
      expect(pile0).toHaveClass("speed-discard-pile--selected");
      expect(pile1).not.toHaveClass("speed-discard-pile--selected");

      // Move to right side -> pile 1 highlighted
      fireEvent.pointerMove(window, { clientX: 340, clientY: 350 });
      expect(pile0).not.toHaveClass("speed-discard-pile--selected");
      expect(pile1).toHaveClass("speed-discard-pile--selected");

      // Release clears hover highlight
      fireEvent.pointerUp(window, { clientX: 340, clientY: 350 });
      expect(pile0).not.toHaveClass("speed-discard-pile--selected");
      expect(pile1).not.toHaveClass("speed-discard-pile--selected");
    });

    it("reorders cards in hand when dragged within the hand area without playing", () => {
      const { sendAction } = renderSpeed();
      fireEvent.click(screen.getByTestId("discard-pile-0"));

      const handArea = screen.getByTestId("speed-hand-area");
      vi.spyOn(handArea, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 400, 500, 120));

      for (let i = 0; i < 5; i++) {
        const el = screen.getByTestId(`speed-card-${i}`);
        vi.spyOn(el, "getBoundingClientRect").mockReturnValue(
          new DOMRect(20 + i * 70, 410, 62, 90)
        );
      }

      const card0 = screen.getByTestId("speed-card-0");
      expect(card0).toHaveTextContent("2");

      // Drag card 0 (center x=51) right past card 2's center (x=191) while staying inside handArea
      fireEvent.pointerDown(card0, { button: 0, clientX: 51, clientY: 450 });
      fireEvent.pointerMove(window, { clientX: 200, clientY: 450 });
      fireEvent.pointerUp(window, { clientX: 200, clientY: 450 });

      expect(sendAction).not.toHaveBeenCalled();
      expect(screen.getByTestId("speed-card-0")).toHaveTextContent("5");
      expect(screen.getByTestId("speed-card-1")).toHaveTextContent("8");
      expect(screen.getByTestId("speed-card-2")).toHaveTextContent("2");

      // Pressing "3" now plays the moved card h1
      fireEvent.keyDown(window, { key: "3" });
      expect(sendAction).toHaveBeenCalledWith({
        type: "PLAY",
        payload: { cardId: "h1", pile: 0 },
      });
    });
  });

  describe("number keys 1-5", () => {
    it("plays 1st..5th card to selected pile and ignores keys beyond hand length", () => {
      const { sendAction } = renderSpeed({
        hand: [card("h1", 0, 2), card("h2", 1, 5), card("h3", 2, 8)],
      });

      fireEvent.keyDown(window, { key: "ArrowRight" });
      fireEvent.keyDown(window, { key: "1" });
      fireEvent.keyDown(window, { key: "3" });
      fireEvent.keyDown(window, { key: "4" });
      fireEvent.keyDown(window, { key: "5" });

      expect(sendAction).toHaveBeenCalledTimes(2);
      expect(sendAction).toHaveBeenNthCalledWith(1, {
        type: "PLAY",
        payload: { cardId: "h1", pile: 1 },
      });
      expect(sendAction).toHaveBeenNthCalledWith(2, {
        type: "PLAY",
        payload: { cardId: "h3", pile: 1 },
      });
    });
  });

  describe("control mode dropdown", () => {
    it("defaults to absolute mode where 1-5 play, Space draws, and A/D/W/ArrowUp do not select or play", () => {
      const { sendAction } = renderSpeed();
      const modeSelect = screen.getByTestId("speed-control-mode") as HTMLSelectElement;
      expect(modeSelect.value).toBe("absolute");

      fireEvent.keyDown(window, { key: "ArrowLeft" });
      expect(screen.getByTestId("discard-pile-0")).toHaveAttribute("aria-pressed", "true");

      // A/D/W/ArrowUp should do nothing in absolute mode
      fireEvent.keyDown(window, { key: "d" });
      fireEvent.keyDown(window, { key: "D" });
      fireEvent.keyDown(window, { key: "a" });
      fireEvent.keyDown(window, { key: "w" });
      fireEvent.keyDown(window, { key: "ArrowUp" });
      expect(screen.getByTestId("speed-card-0")).not.toHaveAttribute("data-selected", "true");
      expect(sendAction).not.toHaveBeenCalled();

      // 1-5 and Space still work
      fireEvent.keyDown(window, { key: "2" });
      fireEvent.keyDown(window, { key: " ", code: "Space" });
      expect(sendAction).toHaveBeenNthCalledWith(1, {
        type: "PLAY",
        payload: { cardId: "h2", pile: 0 },
      });
      expect(sendAction).toHaveBeenNthCalledWith(2, { type: "DRAW" });
    });

    it("supports dual-cards-pile mode: A/D select card, ArrowLeft/Right select pile, W/ArrowUp play, Space draws, and selection persists/clamps", () => {
      const { sendAction, rerender, sendChat, clearError, leaveRoom } = renderSpeed();
      const modeSelect = screen.getByTestId("speed-control-mode") as HTMLSelectElement;

      modeSelect.focus();
      expect(document.activeElement).toBe(modeSelect);
      fireEvent.change(modeSelect, { target: { value: "dual-cards-pile" } });
      expect(modeSelect.value).toBe("dual-cards-pile");
      expect(document.activeElement).not.toBe(modeSelect);

      // Card 0 initially selected in dual mode
      expect(screen.getByTestId("speed-card-0")).toHaveAttribute("data-selected", "true");

      // D moves selection right, A moves left (clamped at 0)
      fireEvent.keyDown(window, { key: "a" });
      expect(screen.getByTestId("speed-card-0")).toHaveAttribute("data-selected", "true");

      fireEvent.keyDown(window, { key: "d" });
      fireEvent.keyDown(window, { key: "D" });
      fireEvent.keyDown(window, { key: "d" });
      expect(screen.getByTestId("speed-card-3")).toHaveAttribute("data-selected", "true");
      expect(screen.getByTestId("speed-card-0")).not.toHaveAttribute("data-selected", "true");

      // Select pile 1 with ArrowRight and play with W
      fireEvent.keyDown(window, { key: "ArrowRight" });
      expect(screen.getByTestId("discard-pile-1")).toHaveAttribute("aria-pressed", "true");

      fireEvent.keyDown(window, { key: "w" });
      expect(sendAction).toHaveBeenLastCalledWith({
        type: "PLAY",
        payload: { cardId: "h4", pile: 1 },
      });

      // Hand shrinks by 1 (4 cards left) -> selection index 3 persists at index 3
      const viewAfterFirstPlay = makeSpeedView({
        hand: [card("h1", 0, 2), card("h2", 1, 5), card("h3", 2, 8), card("h5", 0, 1)],
      });
      rerender(
        <SpeedView
          roomId="ROOM1"
          playerId="p0"
          view={viewAfterFirstPlay}
          chatMessages={[]}
          error={null}
          sendAction={sendAction}
          sendChat={sendChat}
          clearError={clearError}
          leaveRoom={leaveRoom}
        />
      );
      expect(screen.getByTestId("speed-card-3")).toHaveAttribute("data-selected", "true");

      // ArrowUp plays the persisted selected card (h5 at index 3)
      fireEvent.keyDown(window, { key: "ArrowLeft" });
      fireEvent.keyDown(window, { key: "ArrowUp" });
      expect(sendAction).toHaveBeenLastCalledWith({
        type: "PLAY",
        payload: { cardId: "h5", pile: 0 },
      });

      // Hand shrinks to 2 cards -> selection clamps to index 1
      const viewAfterShrink = makeSpeedView({
        hand: [card("h1", 0, 2), card("h2", 1, 5)],
      });
      rerender(
        <SpeedView
          roomId="ROOM1"
          playerId="p0"
          view={viewAfterShrink}
          chatMessages={[]}
          error={null}
          sendAction={sendAction}
          sendChat={sendChat}
          clearError={clearError}
          leaveRoom={leaveRoom}
        />
      );
      expect(screen.getByTestId("speed-card-1")).toHaveAttribute("data-selected", "true");

      // Space still draws in dual-cards-pile mode
      fireEvent.keyDown(window, { key: " ", code: "Space" });
      expect(sendAction).toHaveBeenLastCalledWith({ type: "DRAW" });
    });

    it("supports dual-pile-cards mode: A/D select pile, ArrowLeft/Right select card, W/ArrowUp play, Space draws", () => {
      const { sendAction } = renderSpeed();
      const modeSelect = screen.getByTestId("speed-control-mode") as HTMLSelectElement;

      fireEvent.change(modeSelect, { target: { value: "dual-pile-cards" } });
      expect(modeSelect.value).toBe("dual-pile-cards");

      // A/D select pile 0/1
      fireEvent.keyDown(window, { key: "d" });
      expect(screen.getByTestId("discard-pile-1")).toHaveAttribute("aria-pressed", "true");
      fireEvent.keyDown(window, { key: "A" });
      expect(screen.getByTestId("discard-pile-0")).toHaveAttribute("aria-pressed", "true");

      // ArrowRight/ArrowLeft select card in hand
      expect(screen.getByTestId("speed-card-0")).toHaveAttribute("data-selected", "true");
      fireEvent.keyDown(window, { key: "ArrowRight" });
      fireEvent.keyDown(window, { key: "ArrowRight" });
      expect(screen.getByTestId("speed-card-2")).toHaveAttribute("data-selected", "true");
      fireEvent.keyDown(window, { key: "ArrowLeft" });
      expect(screen.getByTestId("speed-card-1")).toHaveAttribute("data-selected", "true");

      // W plays card 1 (h2) to pile 0; Space draws
      fireEvent.keyDown(window, { key: "w" });
      expect(sendAction).toHaveBeenCalledWith({
        type: "PLAY",
        payload: { cardId: "h2", pile: 0 },
      });

      fireEvent.keyDown(window, { key: " ", code: "Space" });
      expect(sendAction).toHaveBeenLastCalledWith({ type: "DRAW" });
    });
  });

  describe("draw, unstuck, and ready controls", () => {
    it("sends DRAW on Spacebar and Draw button, and UNSTUCK on Unstuck button", () => {
      const { sendAction } = renderSpeed();

      fireEvent.keyDown(window, { key: " ", code: "Space" });
      fireEvent.click(screen.getByTestId("speed-draw-btn"));
      fireEvent.click(screen.getByTestId("speed-unstuck-btn"));

      expect(sendAction).toHaveBeenNthCalledWith(1, { type: "DRAW" });
      expect(sendAction).toHaveBeenNthCalledWith(2, { type: "DRAW" });
      expect(sendAction).toHaveBeenNthCalledWith(3, { type: "UNSTUCK" });
    });

    it("sends DRAW when clicking/tapping the play area or deck, but not when clicking a discard pile", () => {
      const { sendAction } = renderSpeed();

      fireEvent.click(screen.getByTestId("discard-pile-0"));
      expect(sendAction).not.toHaveBeenCalled();

      fireEvent.click(screen.getByTestId("speed-play-area"));
      fireEvent.click(screen.getByTestId("my-deck"));
      expect(sendAction).toHaveBeenNthCalledWith(1, { type: "DRAW" });
      expect(sendAction).toHaveBeenNthCalledWith(2, { type: "DRAW" });
    });

    it("sends READY when Ready Up button is clicked in waiting state and shows Ready/Not Ready pills", () => {
      const { sendAction, container } = renderSpeed({ hand: [], topCards: [], ready: ["p1"] });
      expect(container.querySelector(".table-north")).toHaveTextContent("Ready");
      expect(container.querySelector(".table-south")).toHaveTextContent("Not Ready");

      const readyBtn = screen.getByTestId("speed-ready-btn");
      expect(readyBtn).toBeInTheDocument();

      fireEvent.click(readyBtn);
      expect(sendAction).toHaveBeenCalledWith({ type: "READY" });
    });

    it("highlights the clicked stuck pile or left pile on Unstuck button only when server confirms unstuck", () => {
      const { sendAction: send1, rerender: rerender1, sendChat: sc1, clearError: ce1, leaveRoom: lr1, unmount: unmount1 } = renderSpeed();
      fireEvent.click(screen.getByTestId("stuck-pile-1"));
      expect(send1).toHaveBeenCalledWith({ type: "UNSTUCK" });
      // Not lit up until server includes playerId in view.stuck (e.g. if server rejects)
      expect(screen.getByTestId("speed-unstuck-btn")).toHaveTextContent("Unstuck (U)");
      expect(screen.getByTestId("stuck-pile-1")).not.toHaveClass("speed-stuck-pile--requested");

      rerender1(
        <SpeedView
          roomId="ROOM1"
          playerId="p0"
          view={makeSpeedView({ stuck: ["p0"] })}
          chatMessages={[]}
          error={null}
          sendAction={send1}
          sendChat={sc1}
          clearError={ce1}
          leaveRoom={lr1}
        />
      );
      expect(screen.getByTestId("speed-unstuck-btn")).toHaveTextContent("Unstuck Requested");
      expect(screen.getByTestId("stuck-pile-1")).toHaveClass("speed-stuck-pile--requested");
      expect(screen.getByTestId("stuck-pile-0")).not.toHaveClass("speed-stuck-pile--requested");
      unmount1();

      const { sendAction: sendBtn, rerender: rerenderBtn, sendChat: scB, clearError: ceB, leaveRoom: lrB } = renderSpeed();
      fireEvent.click(screen.getByTestId("speed-unstuck-btn"));
      expect(sendBtn).toHaveBeenCalledWith({ type: "UNSTUCK" });
      expect(screen.getByTestId("speed-unstuck-btn")).toHaveTextContent("Unstuck (U)");
      expect(screen.getByTestId("stuck-pile-0")).not.toHaveClass("speed-stuck-pile--requested");

      rerenderBtn(
        <SpeedView
          roomId="ROOM1"
          playerId="p0"
          view={makeSpeedView({ stuck: ["p0"] })}
          chatMessages={[]}
          error={null}
          sendAction={sendBtn}
          sendChat={scB}
          clearError={ceB}
          leaveRoom={lrB}
        />
      );
      expect(screen.getByTestId("speed-unstuck-btn")).toHaveTextContent("Unstuck Requested");
      expect(screen.getByTestId("stuck-pile-0")).toHaveClass("speed-stuck-pile--requested");
      expect(screen.getByTestId("stuck-pile-1")).not.toHaveClass("speed-stuck-pile--requested");
    });
  });

  describe("keyboard guard", () => {
    it("ignores game keys when focus is in an input, select, or textarea", () => {
      const { sendAction, container } = renderSpeed();
      const chatInput = screen.getByPlaceholderText("Type a message...");
      const modeSelect = screen.getByTestId("speed-control-mode");
      const textarea = document.createElement("textarea");
      container.appendChild(textarea);

      // Input focus (absolute mode)
      chatInput.focus();
      fireEvent.keyDown(chatInput, { key: "ArrowLeft" });
      fireEvent.keyDown(chatInput, { key: "ArrowRight" });
      fireEvent.keyDown(chatInput, { key: " ", code: "Space" });
      fireEvent.keyDown(chatInput, { key: "1" });
      fireEvent.keyDown(chatInput, { key: "2" });

      // Select focus (switch to dual mode, then test keys while select is focused)
      fireEvent.change(modeSelect, { target: { value: "dual-cards-pile" } });
      modeSelect.focus();
      fireEvent.keyDown(modeSelect, { key: "ArrowLeft" });
      fireEvent.keyDown(modeSelect, { key: "d" });
      fireEvent.keyDown(modeSelect, { key: "w" });
      fireEvent.keyDown(modeSelect, { key: "ArrowUp" });
      fireEvent.keyDown(modeSelect, { key: " ", code: "Space" });

      // Textarea focus
      textarea.focus();
      fireEvent.keyDown(textarea, { key: "ArrowRight" });
      fireEvent.keyDown(textarea, { key: "a" });
      fireEvent.keyDown(textarea, { key: "W" });
      fireEvent.keyDown(textarea, { key: " ", code: "Space" });

      expect(screen.getByTestId("discard-pile-0")).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByTestId("discard-pile-1")).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByTestId("speed-card-0")).toHaveAttribute("data-selected", "true");
      expect(sendAction).not.toHaveBeenCalled();
    });
  });

  describe("countdown state", () => {
    it("renders speed-countdown-banner for START and displays starting hand before PLAYING", () => {
      renderSpeed({
        state: "COUNTDOWN",
        countdownKind: "START",
        countdownEndsAt: Date.now() + 2500,
        topCards: [null, null],
      });

      const banner = screen.getByTestId("speed-countdown-banner");
      expect(banner).toHaveTextContent(/Game starting in \d+\.\.\./);
      for (let i = 0; i < 5; i++) {
        expect(screen.getByTestId(`speed-card-${i}`)).toBeInTheDocument();
      }
      expect(screen.queryByTestId("speed-ready-btn")).toBeNull();
      expect(screen.queryByTestId("speed-draw-btn")).toBeNull();
    });

    it("renders speed-countdown-banner for UNSTUCK", () => {
      renderSpeed({
        state: "COUNTDOWN",
        countdownKind: "UNSTUCK",
        countdownEndsAt: Date.now() + 2500,
      });

      const banner = screen.getByTestId("speed-countdown-banner");
      expect(banner).toHaveTextContent(/Unstucking in \d+\.\.\./);
    });
  });

  describe("winner state display", () => {
    it("shows winner banner with (You!) when viewer wins, and opponent name when opponent wins", () => {
      const { unmount } = renderSpeed({ winner: "p0" }, "p0");
      const banner = screen.getByTestId("speed-winner-banner");
      expect(banner).toHaveTextContent("Game Over!");
      expect(banner).toHaveTextContent("Alice (You!)");
      unmount();

      renderSpeed({ winner: "p1" }, "p0");
      const oppBanner = screen.getByTestId("speed-winner-banner");
      expect(oppBanner).toHaveTextContent("Bob");
      expect(oppBanner).not.toHaveTextContent("(You!)");
    });
  });

  describe("room invite link copy", () => {
    it("copies the invite link with ?code= when clicking the room code", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText },
        configurable: true,
      });

      renderSpeed();
      const roomBtn = screen.getByRole("button", { name: /Room:\s*ROOM1/i });
      fireEvent.click(roomBtn);

      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/?code=ROOM1`);
      expect(await screen.findByText("Copied!")).toBeInTheDocument();
    });
  });

  describe("unstuck keybind, opponent banner, and card play animations", () => {
    it("triggers UNSTUCK on U keybind and shows yellow banner under opponent when opponent requests unstuck", () => {
      const { sendAction, rerender, sendChat, clearError, leaveRoom } = renderSpeed();

      expect(screen.queryByTestId("opponent-unstuck-banner")).toBeNull();

      fireEvent.keyDown(window, { key: "u" });
      expect(sendAction).toHaveBeenCalledWith({ type: "UNSTUCK" });
      // Remains unlit until server confirms in view.stuck
      expect(screen.getByTestId("speed-unstuck-btn")).toHaveTextContent("Unstuck (U)");
      expect(screen.getByTestId("stuck-pile-0")).not.toHaveClass("speed-stuck-pile--requested");

      rerender(
        <SpeedView
          roomId="ROOM1"
          playerId="p0"
          view={makeSpeedView({ stuck: ["p0", "p1"] })}
          chatMessages={[]}
          error={null}
          sendAction={sendAction}
          sendChat={sendChat}
          clearError={clearError}
          leaveRoom={leaveRoom}
        />
      );
      expect(screen.getByTestId("speed-unstuck-btn")).toHaveTextContent("Unstuck Requested");
      expect(screen.getByTestId("stuck-pile-0")).toHaveClass("speed-stuck-pile--requested");

      const banner = screen.getByTestId("opponent-unstuck-banner");
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveTextContent("Requesting unstuck...");
      expect(screen.getByTestId("speed-play-area").querySelector(".speed-seat-north")).toContainElement(
        banner
      );
    });

    it("animates newly played cards from bottom when played from hand and from top when played by opponent", () => {
      const { rerender, sendAction, sendChat, clearError, leaveRoom } = renderSpeed({
        state: "PLAYING",
      });

      // Play our card h1 onto pile 0 (h1 leaves hand and lands on topCards[0])
      rerender(
        <SpeedView
          roomId="ROOM1"
          playerId="p0"
          view={makeSpeedView({
            state: "PLAYING",
            hand: [card("h2", 1, 5), card("h3", 2, 8), card("h4", 3, 11), card("h5", 0, 1)],
            topCards: [card("h1", 0, 2), card("t1", 3, 9)],
          })}
          chatMessages={[]}
          error={null}
          sendAction={sendAction}
          sendChat={sendChat}
          clearError={clearError}
          leaveRoom={leaveRoom}
        />
      );

      expect(screen.getByTestId("discard-card-anim-0")).toHaveClass("speed-card-play--bottom");

      // Opponent plays opp1 onto pile 1 (opp1 was not in our hand)
      rerender(
        <SpeedView
          roomId="ROOM1"
          playerId="p0"
          view={makeSpeedView({
            state: "PLAYING",
            hand: [card("h2", 1, 5), card("h3", 2, 8), card("h4", 3, 11), card("h5", 0, 1)],
            topCards: [card("h1", 0, 2), card("opp1", 2, 10)],
          })}
          chatMessages={[]}
          error={null}
          sendAction={sendAction}
          sendChat={sendChat}
          clearError={clearError}
          leaveRoom={leaveRoom}
        />
      );

      expect(screen.getByTestId("discard-card-anim-1")).toHaveClass("speed-card-play--top");
    });
  });
});
