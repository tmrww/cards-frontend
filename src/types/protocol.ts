export interface RoomSummary {
  roomId: string;
  gameType: string;
  playerCount: number;
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
}

/** Shape of an in-game action. Each game narrows this to its own union. */
export interface GameAction {
  type: string;
  payload?: unknown;
}

export type ClientMessage =
  | { type: "CREATE_ROOM"; gameType: string; playerId: string; playerName: string }
  | { type: "JOIN_ROOM"; roomId: string; playerId: string; playerName: string }
  | { type: "SEND_MESSAGE"; roomId?: string; playerId?: string; playerName?: string; message: string }
  | { type: "LEAVE_ROOM" }
  | { type: "LIST_ROOMS" }
  | { type: "START_GAME" }
  | { type: "GAME_ACTION"; action: GameAction };

export type ServerMessage =
  | { type: "ROOM_CREATED"; roomId: string; gameType: string }
  | { type: "ROOM_JOINED"; roomId: string; gameType: string }
  | { type: "ROOM_LEFT" }
  | { type: "ROOM_LIST"; rooms: RoomSummary[] }
  | { type: "STATE_UPDATE"; roomId: string; view: unknown }
  | { type: "CHAT_MESSAGE"; roomId: string; playerId: string; playerName: string; message: string }
  | { type: "ERROR"; error: string };

