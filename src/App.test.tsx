import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { makeView } from "./test/factories";

class FakeWebSocket {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];
  readyState = FakeWebSocket.OPEN;
  sent: unknown[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {}
}

const socket = () => FakeWebSocket.instances.at(-1)!;
const receive = (msg: object) => act(() => socket().onmessage!({ data: JSON.stringify(msg) }));
const open = () => act(() => socket().onopen!());

beforeEach(() => {
  FakeWebSocket.instances = [];
  sessionStorage.clear();
  vi.stubGlobal("WebSocket", FakeWebSocket);
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  vi.stubEnv("VITE_WS_URL", "ws://test");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("App", () => {
  it("connects and asks for the room list", () => {
    render(<App />);
    expect(socket().url).toBe("ws://test");
    open();
    expect(socket().sent).toContainEqual({ type: "LIST_ROOMS" });
  });

  it("creates a room with the selected game type and player identity", () => {
    render(<App />);
    open();
    fireEvent.change(screen.getByLabelText(/Username/), { target: { value: "Ann" } });
    fireEvent.change(screen.getByLabelText(/Game/), { target: { value: "placeholder" } });
    fireEvent.click(screen.getByText("Host"));
    const created = socket().sent.at(-1) as Record<string, string>;
    expect(created).toMatchObject({ type: "CREATE_ROOM", gameType: "placeholder", playerName: "Ann" });
    expect(created.playerId).toMatch(/^P_/);
  });

  it("renders the registered view for the room's game type", () => {
    render(<App />);
    open();
    receive({ type: "ROOM_JOINED", roomId: "ABCDE", gameType: "placeholder" });
    receive({ type: "STATE_UPDATE", roomId: "ABCDE", view: { hello: "world" } });
    expect(screen.getByTestId("placeholder-view")).toHaveTextContent("ABCDE");
    expect(screen.getByTestId("placeholder-view")).toHaveTextContent('"hello": "world"');
  });

  it("shows a fallback with a leave button for an unknown game type", () => {
    render(<App />);
    open();
    receive({ type: "ROOM_JOINED", roomId: "ABCDE", gameType: "mystery" });
    expect(screen.getByText(/Unsupported game type: mystery/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Leave Room"));
    expect(socket().sent).toContainEqual({ type: "LEAVE_ROOM" });
    expect(screen.getByText("Host")).toBeInTheDocument();
  });

  it("returns to the lobby when the server reports ROOM_LEFT", () => {
    render(<App />);
    open();
    receive({ type: "ROOM_CREATED", roomId: "ABCDE", gameType: "placeholder" });
    receive({ type: "ROOM_LEFT" });
    expect(screen.getByText("Host")).toBeInTheDocument();
    // Once on connect, once more after leaving.
    expect(socket().sent.filter((m) => (m as { type: string }).type === "LIST_ROOMS")).toHaveLength(2);
    expect(socket().sent.at(-1)).toEqual({ type: "LIST_ROOMS" });
  });

  it("sends game actions in the generic GAME_ACTION envelope", () => {
    render(<App />);
    open();
    receive({ type: "ROOM_JOINED", roomId: "ABCDE", gameType: "guandan" });
    receive({ type: "STATE_UPDATE", roomId: "ABCDE", view: makeView() });
    fireEvent.click(screen.getByText("Ready Up"));
    expect(socket().sent.at(-1)).toEqual({ type: "GAME_ACTION", action: { type: "READY" } });
  });

  it("sends chat messages with the room and player", () => {
    render(<App />);
    open();
    receive({ type: "ROOM_JOINED", roomId: "ABCDE", gameType: "guandan" });
    receive({ type: "STATE_UPDATE", roomId: "ABCDE", view: makeView() });
    fireEvent.change(screen.getByPlaceholderText("Type a message..."), { target: { value: "gg" } });
    fireEvent.click(screen.getByText("Send"));
    expect(socket().sent.at(-1)).toMatchObject({ type: "SEND_MESSAGE", roomId: "ABCDE", message: "gg" });
  });

  it("shows server errors in the lobby", () => {
    render(<App />);
    open();
    receive({ type: "ERROR", error: "Room not found" });
    expect(screen.getByText("Room not found")).toBeInTheDocument();
  });

  it("keeps the player id across renders using the legacy storage key", () => {
    sessionStorage.setItem("guandan_player_id", "P_OLD01");
    render(<App />);
    open();
    fireEvent.change(screen.getByLabelText(/Username/), { target: { value: "Ann" } });
    fireEvent.click(screen.getByText("Host"));
    expect(socket().sent.at(-1)).toMatchObject({ playerId: "P_OLD01" });
    expect(sessionStorage.getItem("cardgame_player_id")).toBe("P_OLD01");
  });

  it("toggles game sounds and chat sounds from the bottom-left bar", () => {
    render(<App />);
    open();
    receive({ type: "ROOM_JOINED", roomId: "ABCDE", gameType: "guandan" });
    receive({ type: "STATE_UPDATE", roomId: "ABCDE", view: makeView() });

    const gameBtn = screen.getByRole("button", { name: /Game Sounds:/ });
    const chatBtn = screen.getByRole("button", { name: /Chat Sounds:/ });
    expect(gameBtn).toHaveTextContent("Game Sounds: On");
    expect(chatBtn).toHaveTextContent("Chat Sounds: On");

    fireEvent.click(gameBtn);
    fireEvent.click(chatBtn);
    expect(gameBtn).toHaveTextContent("Game Sounds: Off");
    expect(chatBtn).toHaveTextContent("Chat Sounds: Off");
    expect(gameBtn).toHaveAttribute("aria-pressed", "false");
    expect(chatBtn).toHaveAttribute("aria-pressed", "false");
  });
});
