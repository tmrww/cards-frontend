import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { card } from "../../test/factories";
import { computeOverlap, HandRow } from "./HandRow";

describe("computeOverlap", () => {
  it("is 0 for zero or one card", () => {
    expect(computeOverlap(0, 1000)).toBe(0);
    expect(computeOverlap(1, 1000)).toBe(0);
  });
  it("uses the default overlap when the cards already fit", () => {
    expect(computeOverlap(5, 1000)).toBe(-20);
  });
  it("overlaps more as the row narrows, within limits", () => {
    // 27 cards * 62 = 1674 needed; 600 - 40 = 560 available -> 1114 / 26 = 42.8 -> 43
    expect(computeOverlap(27, 600)).toBe(-43);
    expect(computeOverlap(27, 100)).toBe(-46); // capped; width floors at 300 -> 1374 / 26 = 52.8
  });
  it("never overlaps less than 18px once cards stop fitting", () => {
    // 15 cards = 930 needed; 900 - 40 = 860 available -> 70 / 14 = 5 -> raised to 18
    expect(computeOverlap(15, 900)).toBe(-18);
  });
});

describe("HandRow", () => {
  const cards = [card("a", 0, 3), card("b", 1, 9), card("c", 2, 12)];
  const renderRow = (props = {}) => {
    const handlers = { onToggle: vi.fn(), onMove: vi.fn() };
    render(
      <HandRow cards={cards} selectedIds={new Set(["b"])} emptyMessage="empty" {...handlers} {...props} />
    );
    return handlers;
  };

  it("renders one element per card with the right selection state", () => {
    renderRow();
    const rendered = document.querySelectorAll(".hand-card");
    expect(rendered).toHaveLength(3);
    expect(rendered[1]).toHaveClass("card-selected");
    expect(rendered[0]).not.toHaveClass("card-selected");
  });

  it("shows the empty message when there are no cards", () => {
    render(<HandRow cards={[]} selectedIds={new Set()} onToggle={vi.fn()} onMove={vi.fn()} emptyMessage="No cards" />);
    expect(screen.getByText("No cards")).toBeInTheDocument();
  });

  it("calls onToggle with the card id when clicked", () => {
    const { onToggle } = renderRow();
    fireEvent.click(document.querySelectorAll(".hand-card")[2]);
    expect(onToggle).toHaveBeenCalledWith("c");
  });

  it("calls onMove while dragging a card over another", () => {
    const { onMove } = renderRow();
    const els = document.querySelectorAll(".hand-card");
    fireEvent.dragStart(els[0]);
    fireEvent.dragOver(els[2]);
    expect(onMove).toHaveBeenCalledWith(0, 2);
  });

  it("does not call onMove when dragging over itself or without a drag", () => {
    const { onMove } = renderRow();
    const els = document.querySelectorAll(".hand-card");
    fireEvent.dragOver(els[1]);
    fireEvent.dragStart(els[1]);
    fireEvent.dragOver(els[1]);
    expect(onMove).not.toHaveBeenCalled();
  });

  it("applies decoration classes, styles, titles and badges", () => {
    renderRow({
      decorate: (c: { id: string }) =>
        c.id === "a"
          ? { extraClass: "card-wildcard", style: { borderBottom: "3px solid red" }, title: "special", badges: <span>WILD</span> }
          : {},
    });
    const first = document.querySelectorAll(".hand-card")[0] as HTMLElement;
    expect(first).toHaveClass("card-wildcard");
    expect(first).toHaveAttribute("title", "special");
    expect(first.style.borderBottom).toBe("3px solid red");
    expect(screen.getByText("WILD")).toBeInTheDocument();
  });

  it("marks hearts and diamonds red and spades and clubs black", () => {
    renderRow();
    const els = document.querySelectorAll(".hand-card");
    expect(els[0]).toHaveClass("card-black");
    expect(els[1]).toHaveClass("card-red");
  });
});
