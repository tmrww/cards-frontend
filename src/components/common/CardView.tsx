import React from "react";
import type { Card } from "../../types";
import { getCardShortValue, getSuitSymbol, isRedCard } from "../../utils/cards";

const colorClass = (card: Card) => (isRedCard(card) ? "card-red" : "card-black");

interface CardViewProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title" | "className"> {
  card: Card;
  selected?: boolean;
  dragging?: boolean;
  /** Extra classes, e.g. game-specific highlights. */
  extraClass?: string;
  title?: string;
  /** Badges shown at the bottom of the card (e.g. WILD, BOMB). */
  badges?: React.ReactNode;
}

/** A full-size hand card face. */
export const CardView: React.FC<CardViewProps> = ({
  card,
  selected,
  dragging,
  extraClass,
  title,
  badges,
  ...divProps
}) => {
  const suit = getSuitSymbol(card.suit.id);
  const className = [
    "hand-card",
    colorClass(card),
    selected && "card-selected",
    dragging && "card-dragging",
    extraClass,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      {...divProps}
      className={className}
      title={title ?? `${card.value.name} of ${card.suit.name}`}
    >
      <div className="card-corner-top">
        <span className="card-rank">{getCardShortValue(card)}</span>
        <span className="card-suit-small">{suit}</span>
      </div>
      <div className="card-center-suit">{suit}</div>
      <div className="card-badges">{badges}</div>
    </div>
  );
};

/** Compact inline card, used for cards played on the table. */
export const MiniCard: React.FC<{ card: Card; wild?: boolean }> = ({ card, wild }) => (
  <span className={`mini-card ${colorClass(card)} ${wild ? "card-wild" : ""}`}>
    {getSuitSymbol(card.suit.id)}
    {getCardShortValue(card)}
  </span>
);
