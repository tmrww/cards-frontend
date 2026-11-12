import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { seatsFor, TableLayout } from "./TableLayout";

const dirs = (n: number, me: number, cw = true) => seatsFor(n, me, cw).map((s) => s.direction);
const seats = (n: number, me: number, cw = true) => seatsFor(n, me, cw).map((s) => s.seatIndex);

describe("seatsFor", () => {
  it("puts the viewer at the bottom (S) with offset 0 for every size", () => {
    for (const n of [2, 3, 4]) {
      const first = seatsFor(n, 1)[0];
      expect(first).toEqual({ direction: "S", seatIndex: 1, offset: 0 });
    }
  });

  it("seats 2 players top and bottom", () => {
    expect(dirs(2, 0)).toEqual(["S", "N"]);
    expect(seats(2, 1)).toEqual([1, 0]);
  });

  it("seats 3 players clockwise or counterclockwise", () => {
    expect(dirs(3, 0)).toEqual(["S", "W", "E"]);
    expect(dirs(3, 0, false)).toEqual(["S", "E", "W"]);
    expect(seats(3, 2)).toEqual([2, 0, 1]);
  });

  it("seats 4 players S, W, N, E clockwise; the teammate is opposite", () => {
    expect(dirs(4, 0)).toEqual(["S", "W", "N", "E"]);
    expect(seats(4, 1)).toEqual([1, 2, 3, 0]);
    expect(seatsFor(4, 1)[2].offset).toBe(2);
  });

  it("mirrors W and E when counterclockwise, keeping N opposite", () => {
    expect(dirs(4, 0, false)).toEqual(["S", "E", "N", "W"]);
    expect(seats(4, 0, false)).toEqual([0, 1, 2, 3]);
  });

  it("returns unique seats and directions that wrap around the player list", () => {
    for (const n of [2, 3, 4]) {
      for (let me = 0; me < n; me++) {
        expect(new Set(seats(n, me)).size).toBe(n);
        expect(new Set(dirs(n, me)).size).toBe(n);
      }
    }
  });

  it("rejects unsupported player counts", () => {
    expect(() => seatsFor(1, 0)).toThrow(RangeError);
    expect(() => seatsFor(5, 0)).toThrow(RangeError);
  });
});

describe("TableLayout", () => {
  it("renders each edge and the center", () => {
    const { container, getByText } = render(
      <TableLayout seats={{ N: "north", S: "south", W: "west", E: "east" }}>middle</TableLayout>
    );
    expect(container.querySelector(".table-north")).toHaveTextContent("north");
    expect(container.querySelector(".table-west")).toHaveTextContent("west");
    expect(container.querySelector(".table-east")).toHaveTextContent("east");
    expect(container.querySelector(".table-south")).toHaveTextContent("south");
    expect(getByText("middle").closest(".table-center")).not.toBeNull();
  });

  it("leaves unused edges empty", () => {
    const { container } = render(<TableLayout seats={{ S: "me", N: "them" }} />);
    expect(container.querySelector(".table-west")).toBeEmptyDOMElement();
    expect(container.querySelector(".table-east")).toBeEmptyDOMElement();
  });
});

