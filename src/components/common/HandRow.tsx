import React, { useEffect, useRef, useState } from "react";
import type { Card } from "../../types";
import { CardView } from "./CardView";

const CARD_WIDTH = 62;
const SIDE_PADDING = 40;
const MIN_AVAILABLE_WIDTH = 300;
const DEFAULT_OVERLAP = 20;
const MIN_OVERLAP = 18;
const MAX_OVERLAP = 46;

/** Negative left margin (px) so `count` cards fit in `containerWidth` without clipping. */
export function computeOverlap(count: number, containerWidth: number): number {
  if (count <= 1) return 0;
  const available = Math.max(MIN_AVAILABLE_WIDTH, containerWidth - SIDE_PADDING);
  const needed = count * CARD_WIDTH;
  if (needed <= available) return -DEFAULT_OVERLAP;
  const overlap = Math.ceil((needed - available) / (count - 1));
  return -Math.min(MAX_OVERLAP, Math.max(MIN_OVERLAP, overlap));
}

export interface CardDecoration {
  extraClass?: string;
  style?: React.CSSProperties;
  title?: string;
  badges?: React.ReactNode;
}

interface HandRowProps {
  cards: Card[];
  selectedIds: Set<string>;
  onToggle: (cardId: string) => void;
  /** Called while dragging to move the card at `from` to index `to`. */
  onMove: (from: number, to: number) => void;
  /** Game-specific per-card styling, badges and tooltip. */
  decorate?: (card: Card) => CardDecoration;
  emptyMessage: string;
}

/** The player's hand: overlapping, selectable, drag-to-reorder cards. */
export const HandRow: React.FC<HandRowProps> = ({
  cards,
  selectedIds,
  onToggle,
  onMove,
  decorate,
  emptyMessage,
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1000);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  useEffect(() => {
    const update = () => rowRef.current && setWidth(rowRef.current.clientWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const overlap = computeOverlap(cards.length, width);

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;
    onMove(draggedIdx, index);
    setDraggedIdx(index);
  };

  return (
    <div className="hand-row" ref={rowRef}>
      {cards.length === 0 ? (
        <div className="empty-hand-msg">{emptyMessage}</div>
      ) : (
        cards.map((card, index) => {
          const { extraClass, style, title, badges } = decorate?.(card) ?? {};
          return (
            <CardView
              key={card.id}
              card={card}
              selected={selectedIds.has(card.id)}
              dragging={draggedIdx === index}
              extraClass={extraClass}
              title={title}
              badges={badges}
              draggable
              onDragStart={() => setDraggedIdx(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={() => setDraggedIdx(null)}
              onClick={() => onToggle(card.id)}
              style={{ marginLeft: index === 0 ? 0 : `${overlap}px`, ...style }}
            />
          );
        })
      )}
    </div>
  );
};

