import { describe, expect, it } from "vitest";
import { initialSocketState, socketReducer, SocketState } from "./useGameSocket";

const inRoom: SocketState = {
  ...initialSocketState,
  roomId: "ABCDE",
  gameType: "guandan",
  view: { some: "view" },
  chat: [{ id: "1", sender: "Ann", text: "hi" }],
  error: "old error",
};

describe("socketReducer", () => {
  it.each(["ROOM_CREATED", "ROOM_JOINED"] as const)("%s enters the room and resets chat and error", (type) => {
    const next = socketReducer(inRoom, { type, roomId: "ZZZZZ", gameType: "placeholder" });
    expect(next).toMatchObject({ roomId: "ZZZZZ", gameType: "placeholder", chat: [], error: null });
  });

  it("ROOM_LEFT clears the room, view, chat and error but keeps the room list", () => {
    const rooms = [{ roomId: "R", gameType: "guandan", playerCount: 1 }];
    const next = socketReducer({ ...inRoom, rooms }, { type: "ROOM_LEFT" });
    expect(next).toEqual({ ...initialSocketState, rooms });
  });

  it("LEFT_LOCALLY clears the room but keeps the current error", () => {
    const next = socketReducer(inRoom, { type: "LEFT_LOCALLY" });
    expect(next).toMatchObject({ roomId: null, gameType: null, view: null, chat: [], error: "old error" });
  });

  it("ROOM_LIST stores the rooms", () => {
    const rooms = [{ roomId: "R", gameType: "guandan", playerCount: 2 }];
    expect(socketReducer(initialSocketState, { type: "ROOM_LIST", rooms }).rooms).toBe(rooms);
  });

  it("STATE_UPDATE stores the opaque view and room id", () => {
    const view = { anything: 1 };
    const next = socketReducer(initialSocketState, { type: "STATE_UPDATE", roomId: "R1", view });
    expect(next).toMatchObject({ roomId: "R1", view });
  });

  it("CHAT_MESSAGE appends with unique ids", () => {
    const msg = { type: "CHAT_MESSAGE", roomId: "R", playerId: "p", playerName: "Bob", message: "yo" } as const;
    const once = socketReducer(inRoom, msg);
    const twice = socketReducer(once, msg);
    expect(twice.chat.map((m) => [m.sender, m.text])).toEqual([
      ["Ann", "hi"],
      ["Bob", "yo"],
      ["Bob", "yo"],
    ]);
    expect(new Set(twice.chat.map((m) => m.id)).size).toBe(3);
  });

  it("ERROR and SET_ERROR set and clear the error", () => {
    expect(socketReducer(initialSocketState, { type: "ERROR", error: "boom" }).error).toBe("boom");
    expect(socketReducer(inRoom, { type: "SET_ERROR", error: null }).error).toBeNull();
  });
});

