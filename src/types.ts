export interface Suit {
  readonly id: number;
  readonly name: string;
}

export interface CardValue {
  readonly value: number;
  readonly name: string;
}

export interface Card {
  id: string;
  faceUp: boolean;
  value: CardValue;
  suit: Suit;
}

export type GuanDanCombinationType =
  | "SINGLE"
  | "PAIR"
  | "TRIPLE"
  | "FULL_HOUSE"
  | "CONSECUTIVE_PAIRS"
  | "CONSECUTIVE_TRIPLES"
  | "STRAIGHT"
  | "STRAIGHT_BOMB"
  | "BOMB"
  | "FOUR_JOKERS";

export interface GuanDanCombination {
  player: string;
  cards: Card[];
  type: GuanDanCombinationType;
  mainRank: number;
  bombSize?: number;
}

export interface GuanDanPlayerInfo {
  id: string;
  name: string;
  cardCount: number;
  status?: "played" | "passed" | "out";
}

export interface GuanDanPlayerView {
  turn: number;
  state: "WAITING" | "PLAYING" | "ENDED";
  ready: string[];
  currentStage?: number;
  stage: number[];
  strikes: number[];
  won: string[];
  hand: Card[];
  currentRound: GuanDanCombination[];
  // pastRounds: { winner: string; cards: GuanDanCombination[] }[];
  players: GuanDanPlayerInfo[];
  isFinished: boolean;
  winnerIds: string[];
}

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

export type GuanDanAction =
  | { type: "READY" }
  | { type: "PLAY"; payload: { cardIds: string[] } }
  | { type: "PASS" };

export type ClientMessage =
  | { type: "CREATE_ROOM"; gameType: string; playerId: string; playerName: string }
  | { type: "JOIN_ROOM"; roomId: string; playerId: string; playerName: string }
  | { type: "SEND_MESSAGE"; roomId?: string; playerId?: string; playerName?: string; message: string }
  | { type: "LEAVE_ROOM" }
  | { type: "LIST_ROOMS" }
  | { type: "START_GAME" }
  | { type: "GAME_ACTION"; action: GuanDanAction };

export type ServerMessage =
  | { type: "ROOM_CREATED"; roomId: string; gameType: string }
  | { type: "ROOM_JOINED"; roomId: string; gameType: string }
  | { type: "ROOM_LEFT" }
  | { type: "ROOM_LIST"; rooms: RoomSummary[] }
  | { type: "STATE_UPDATE"; roomId: string; view: GuanDanPlayerView }
  | { type: "CHAT_MESSAGE"; roomId: string; playerId: string; playerName: string; message: string }
  | { type: "ERROR"; error: string };

