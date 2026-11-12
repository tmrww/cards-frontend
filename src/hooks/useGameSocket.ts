import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { ChatMessage, ClientMessage, RoomSummary, ServerMessage } from "../types";
import { getWebSocketUrl } from "../utils/wsUrl";

export interface SocketState {
  roomId: string | null;
  gameType: string | null;
  rooms: RoomSummary[];
  /** Latest game view from the server; each game module narrows its own type. */
  view: unknown;
  chat: ChatMessage[];
  error: string | null;
}

export type SocketAction =
  | ServerMessage
  | { type: "SET_ERROR"; error: string | null }
  /** Leaving initiated by this client (keeps the current error, unlike ROOM_LEFT). */
  | { type: "LEFT_LOCALLY" };

export const initialSocketState: SocketState = {
  roomId: null,
  gameType: null,
  rooms: [],
  view: null,
  chat: [],
  error: null,
};

const outOfRoom = (s: SocketState): SocketState => ({
  ...s,
  roomId: null,
  gameType: null,
  view: null,
  chat: [],
});

let chatCounter = 0;

export function socketReducer(state: SocketState, action: SocketAction): SocketState {
  switch (action.type) {
    case "ROOM_CREATED":
    case "ROOM_JOINED":
      return { ...state, roomId: action.roomId, gameType: action.gameType, chat: [], error: null };
    case "ROOM_LEFT":
      return { ...outOfRoom(state), error: null };
    case "LEFT_LOCALLY":
      return outOfRoom(state);
    case "ROOM_LIST":
      return { ...state, rooms: action.rooms };
    case "STATE_UPDATE":
      return { ...state, roomId: action.roomId, view: action.view };
    case "CHAT_MESSAGE":
      return {
        ...state,
        chat: [
          ...state.chat,
          { id: `${Date.now()}-${chatCounter++}`, sender: action.playerName, text: action.message },
        ],
      };
    case "ERROR":
    case "SET_ERROR":
      return { ...state, error: action.error };
  }
}

const post = (ws: WebSocket, msg: ClientMessage) => ws.send(JSON.stringify(msg));

/** WebSocket connection plus the room/game state it drives. */
export function useGameSocket() {
  const [state, dispatch] = useReducer(socketReducer, initialSocketState);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      post(ws, msg);
    } else {
      dispatch({ type: "SET_ERROR", error: "Not connected to WebSocket server." });
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    wsRef.current?.close();

    try {
      const ws = new WebSocket(getWebSocketUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        dispatch({ type: "SET_ERROR", error: null });
        post(ws, { type: "LIST_ROOMS" });
      };

      ws.onmessage = (event) => {
        try {
          const msg: ServerMessage = JSON.parse(event.data);
          dispatch(msg);
          if (msg.type === "ROOM_LEFT") post(ws, { type: "LIST_ROOMS" });
        } catch {
          dispatch({ type: "SET_ERROR", error: "Received malformed server message." });
        }
      };

      ws.onclose = ws.onerror = () => setConnected(false);
    } catch (err: unknown) {
      setConnected(false);
      dispatch({
        type: "SET_ERROR",
        error:
          err instanceof Error
            ? `WebSocket connection error: ${err.message}`
            : "Failed to connect to WebSocket server.",
      });
    }
  }, []);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);

  return { ...state, connected, send, dispatch, reconnect: connect };
}
