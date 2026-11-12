import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useHandOrder } from "./useHandOrder";

const items = (...ids: string[]) => ids.map((id) => ({ id }));
const ids = (list: { id: string }[]) => list.map((i) => i.id);

describe("useHandOrder", () => {
  it("sets the order and keeps the ref in sync", () => {
    const { result } = renderHook(() => useHandOrder<{ id: string }>());
    act(() => result.current.setOrder(items("a", "b")));
    expect(ids(result.current.order)).toEqual(["a", "b"]);
    expect(ids(result.current.orderRef.current)).toEqual(["a", "b"]);
  });

  it("supports functional updates based on the latest order", () => {
    const { result } = renderHook(() => useHandOrder<{ id: string }>());
    act(() => {
      result.current.setOrder(items("a"));
      result.current.setOrder((prev) => [...prev, ...items("b")]);
    });
    expect(ids(result.current.order)).toEqual(["a", "b"]);
  });

  it("moves a card from one index to another", () => {
    const { result } = renderHook(() => useHandOrder<{ id: string }>());
    act(() => result.current.setOrder(items("a", "b", "c", "d")));
    act(() => result.current.move(0, 2));
    expect(ids(result.current.order)).toEqual(["b", "c", "a", "d"]);
    act(() => result.current.move(3, 0));
    expect(ids(result.current.order)).toEqual(["d", "b", "c", "a"]);
  });

  it("toggles, clears and prunes the selection", () => {
    const { result } = renderHook(() => useHandOrder<{ id: string }>());
    act(() => {
      result.current.toggle("a");
      result.current.toggle("b");
      result.current.toggle("c");
      result.current.toggle("b");
    });
    expect([...result.current.selected].sort()).toEqual(["a", "c"]);

    act(() => result.current.pruneSelection(new Set(["a"])));
    expect([...result.current.selected]).toEqual(["a"]);

    act(() => result.current.clearSelection());
    expect(result.current.selected.size).toBe(0);
  });
});

