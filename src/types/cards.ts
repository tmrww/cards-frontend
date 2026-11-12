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

