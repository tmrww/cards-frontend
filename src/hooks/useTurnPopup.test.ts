import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTurnPopup } from "./useTurnPopup";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
});
afterEach(() => vi.useRealTimers());

const setup = (initial = false) => {
  const onStart = vi.fn();
  const hook = renderHook(({ turn }) => useTurnPopup(turn, onStart), { initialProps: { turn: initial } });
  return { ...hook, onStart };
};

describe("useTurnPopup", () => {
  it("is hidden until it becomes my turn", () => {
    const { result, onStart } = setup();
    expect(result.current.show).toBe(false);
    expect(onStart).not.toHaveBeenCalled();
  });

  it("shows and notifies when my turn starts, and auto-hides after 5s", () => {
    const { result, rerender, onStart } = setup();
    rerender({ turn: true });
    expect(result.current).toEqual({ show: true, fast: false, leaving: false });
    expect(onStart).toHaveBeenCalledTimes(1);

    act(() => void vi.advanceTimersByTime(4999));
    expect(result.current.show).toBe(true);
    act(() => void vi.advanceTimersByTime(1));
    expect(result.current.show).toBe(false);
  });

  it("speeds up on mouse move, halving the remaining time", () => {
    const { result, rerender } = setup();
    rerender({ turn: true });
    act(() => void vi.advanceTimersByTime(1000)); // 4000ms left -> 2000ms when fast

    act(() => void window.dispatchEvent(new MouseEvent("mousemove")));
    expect(result.current.fast).toBe(true);

    act(() => void vi.advanceTimersByTime(1999));
    expect(result.current.show).toBe(true);
    act(() => void vi.advanceTimersByTime(1));
    expect(result.current.show).toBe(false);
  });

  it("caps the fast duration at 2.5s", () => {
    const { result, rerender } = setup();
    rerender({ turn: true });
    act(() => void window.dispatchEvent(new MouseEvent("mousemove")));
    act(() => void vi.advanceTimersByTime(2499));
    expect(result.current.show).toBe(true);
    act(() => void vi.advanceTimersByTime(1));
    expect(result.current.show).toBe(false);
  });

  it("plays the leave animation for 200ms after a click", () => {
    const { result, rerender } = setup();
    rerender({ turn: true });
    act(() => void window.dispatchEvent(new MouseEvent("mousedown")));
    expect(result.current).toMatchObject({ show: true, leaving: true });

    act(() => void vi.advanceTimersByTime(200));
    expect(result.current.show).toBe(false);
  });

  it("ignores mouse movement while leaving", () => {
    const { result, rerender } = setup();
    rerender({ turn: true });
    act(() => void window.dispatchEvent(new MouseEvent("click")));
    act(() => void window.dispatchEvent(new MouseEvent("mousemove")));
    expect(result.current.fast).toBe(false);
  });

  it("hides immediately when the turn ends", () => {
    const { result, rerender } = setup();
    rerender({ turn: true });
    rerender({ turn: false });
    expect(result.current.show).toBe(false);
  });

  it("shows again on the next turn", () => {
    const { result, rerender, onStart } = setup();
    rerender({ turn: true });
    rerender({ turn: false });
    rerender({ turn: true });
    expect(result.current.show).toBe(true);
    expect(onStart).toHaveBeenCalledTimes(2);
  });
});

