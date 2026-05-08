import { useState, useCallback } from "react";

export interface UndoRedoState<T> {
  past: T[];
  present: T;
  future: T[];
}

export interface UseUndoRedoReturn<T> {
  state: T;
  setState: (newState: T | ((prev: T) => T)) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  clearHistory: () => void;
  lastAction: string;
}

const MAX_HISTORY = 5;

export function useUndoRedo<T>(initialState: T): UseUndoRedoReturn<T> {
  const [history, setHistory] = useState<UndoRedoState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  const [lastAction, setLastAction] = useState<string>("");

  const setState = useCallback((newState: T | ((prev: T) => T)) => {
    setHistory((prev) => ({
      past: [...prev.past.slice(-MAX_HISTORY + 1), prev.present],
      present: typeof newState === "function" ? (newState as (p: T) => T)(prev.present) : newState,
      future: [],
    }));
  }, []);

  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.past.length === 0) return prev;

      const newPast = prev.past.slice(0, -1);
      const newPresent = prev.past[prev.past.length - 1];

      return {
        past: newPast,
        present: newPresent,
        future: [prev.present, ...prev.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((prev) => {
      if (prev.future.length === 0) return prev;

      const newPresent = prev.future[0];
      const newFuture = prev.future.slice(1);

      return {
        past: [...prev.past, prev.present],
        present: newPresent,
        future: newFuture,
      };
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory({
      past: [],
      present: history.present,
      future: [],
    });
  }, [history.present]);

  return {
    state: history.present,
    setState,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    clearHistory,
    lastAction,
  };
}
