import { useCallback, useRef, useState } from "react";

type Updater<T> = T[] | ((prev: T[]) => T[]);

/**
 * Player-controlled hand order and card selection, shared by any card game.
 * `order` is mirrored in a ref so effects can read the latest order synchronously.
 */
export function useHandOrder<T extends { id: string }>() {
  const [order, setOrderState] = useState<T[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const orderRef = useRef<T[]>([]);

  const setOrder = useCallback((update: Updater<T>) => {
    const next = typeof update === "function" ? update(orderRef.current) : update;
    orderRef.current = next;
    setOrderState(next);
  }, []);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  /** Drop selected ids that are no longer in the hand. */
  const pruneSelection = useCallback((validIds: Set<string>) => {
    setSelected((prev) => new Set([...prev].filter((id) => validIds.has(id))));
  }, []);

  /** Moves the card at `from` to position `to`. */
  const move = useCallback(
    (from: number, to: number) =>
      setOrder((prev) => {
        const next = [...prev];
        next.splice(to, 0, ...next.splice(from, 1));
        return next;
      }),
    [setOrder]
  );

  return { order, orderRef, setOrder, selected, toggle, clearSelection, pruneSelection, move };
}

