import { describe, it, expect, vi } from "vitest";
import {
  swapItems,
  handleDragStart,
  handleDragOver,
  handleDrop,
  isDragOver,
} from "../dragDrop";

/** Minimal DataTransfer-like mock for jsdom (which lacks a full implementation). */
function createDataTransfer(initial?: Record<string, string>) {
  const store: Record<string, string> = { ...initial };
  return {
    effectAllowed: "",
    dropEffect: "",
    types: Object.keys(store),
    setData: vi.fn((type: string, value: string) => {
      store[type] = value;
    }),
    getData: vi.fn((type: string) => store[type] ?? ""),
    setDragImage: vi.fn(),
  };
}

function createDragEvent(dataTransfer: ReturnType<typeof createDataTransfer>) {
  return {
    preventDefault: vi.fn(),
    dataTransfer,
  } as unknown as React.DragEvent<HTMLElement>;
}

describe("dragDrop utilities", () => {
  describe("swapItems", () => {
    it("swaps two items in an array", () => {
      const arr = ["a", "b", "c", "d"];
      const result = swapItems(arr, 1, 3);
      expect(result).toEqual(["a", "d", "c", "b"]);
    });

    it("does not mutate the original array", () => {
      const arr = ["a", "b", "c"];
      const result = swapItems(arr, 0, 2);
      expect(arr).toEqual(["a", "b", "c"]);
      expect(result).not.toBe(arr);
    });

    it("is a no-op when swapping an index with itself", () => {
      const arr = [1, 2, 3];
      const result = swapItems(arr, 1, 1);
      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe("handleDragStart", () => {
    it("sets effectAllowed and JSON drag data with the given index", () => {
      const dt = createDataTransfer();
      const e = createDragEvent(dt);
      handleDragStart(e, 5);
      expect(dt.effectAllowed).toBe("move");
      expect(dt.setData).toHaveBeenCalledWith("application/json", JSON.stringify({ index: 5 }));
    });

    it("appends and removes a temporary drag image element", () => {
      vi.useFakeTimers();
      const appendSpy = vi.spyOn(document.body, "appendChild");
      const removeSpy = vi.spyOn(document.body, "removeChild");
      const dt = createDataTransfer();
      const e = createDragEvent(dt);
      handleDragStart(e, 0);
      expect(appendSpy).toHaveBeenCalled();
      expect(dt.setDragImage).toHaveBeenCalled();
      vi.runAllTimers();
      expect(removeSpy).toHaveBeenCalled();
      vi.useRealTimers();
      appendSpy.mockRestore();
      removeSpy.mockRestore();
    });
  });

  describe("handleDragOver", () => {
    it("calls preventDefault and sets dropEffect to move", () => {
      const dt = createDataTransfer();
      const e = createDragEvent(dt);
      handleDragOver(e);
      expect(e.preventDefault).toHaveBeenCalled();
      expect(dt.dropEffect).toBe("move");
    });
  });

  describe("handleDrop", () => {
    it("returns the dragged index when it differs from the target index", () => {
      const dt = createDataTransfer({ "application/json": JSON.stringify({ index: 2 }) });
      const e = createDragEvent(dt);
      const result = handleDrop(e, 4);
      expect(e.preventDefault).toHaveBeenCalled();
      expect(result).toBe(2);
    });

    it("returns null when the dragged index equals the target index", () => {
      const dt = createDataTransfer({ "application/json": JSON.stringify({ index: 3 }) });
      const e = createDragEvent(dt);
      const result = handleDrop(e, 3);
      expect(result).toBeNull();
    });

    it("returns null and logs an error when drag data is malformed", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const dt = createDataTransfer({ "application/json": "not-json" });
      const e = createDragEvent(dt);
      const result = handleDrop(e, 0);
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("returns null when no drag data is present", () => {
      const dt = createDataTransfer();
      const e = createDragEvent(dt);
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const result = handleDrop(e, 0);
      expect(result).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe("isDragOver", () => {
    it("returns true when application/json is among the dataTransfer types", () => {
      const dt = createDataTransfer({ "application/json": "{}" });
      const e = createDragEvent(dt);
      expect(isDragOver(e)).toBe(true);
    });

    it("returns false when application/json is not present", () => {
      const dt = createDataTransfer({ "text/plain": "hi" });
      const e = createDragEvent(dt);
      expect(isDragOver(e)).toBe(false);
    });
  });
});
