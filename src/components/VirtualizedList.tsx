import { ReactNode, useEffect, useMemo, useRef, useState } from "react";

interface VirtualizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  height: number | string;
  estimatedItemHeight: number;
  ariaLabel?: string;
  overscan?: number;
  getItemHeight?: (item: T, index: number) => number;
  emptyState?: ReactNode;
}

function findStartIndex(offsets: number[], scrollTop: number): number {
  let low = 0;
  let high = offsets.length - 1;
  let result = offsets.length;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (offsets[mid] + 1 >= scrollTop) {
      result = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return Math.max(0, result);
}

export function VirtualizedList<T>({
  items,
  renderItem,
  height,
  estimatedItemHeight,
  ariaLabel,
  overscan = 4,
  getItemHeight,
  emptyState,
}: VirtualizedListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setViewportHeight(containerRef.current.clientHeight);
      }
    };

    updateHeight();

    const resizeObserver = typeof ResizeObserver !== "undefined" && containerRef.current
      ? new ResizeObserver(updateHeight)
      : null;

    if (resizeObserver && containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener("resize", updateHeight);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, [height]);

  const itemHeights = useMemo(
    () => items.map((item, index) => getItemHeight?.(item, index) ?? estimatedItemHeight),
    [estimatedItemHeight, getItemHeight, items]
  );

  const offsets = useMemo(() => {
    let offset = 0;
    return itemHeights.map((itemHeight) => {
      const current = offset;
      offset += itemHeight;
      return current;
    });
  }, [itemHeights]);

  const totalHeight = useMemo(
    () => itemHeights.reduce((sum, itemHeight) => sum + itemHeight, 0),
    [itemHeights]
  );

  const visibleRange = useMemo(() => {
    const viewport = viewportHeight || estimatedItemHeight * 5;
    const startIndex = findStartIndex(offsets, scrollTop);
    let endIndex = startIndex;
    const visibleBottom = scrollTop + viewport;

    while (endIndex < items.length && offsets[endIndex] < visibleBottom) {
      endIndex += 1;
    }

    return {
      startIndex: Math.max(0, startIndex - overscan),
      endIndex: Math.min(items.length, endIndex + overscan),
    };
  }, [estimatedItemHeight, items.length, offsets, overscan, scrollTop, viewportHeight]);

  if (items.length === 0) {
    return <>{emptyState || null}</>;
  }

  const displayHeight = typeof height === "number" ? `${height}px` : height;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="region"
      aria-label={ariaLabel}
      style={{
        height: displayHeight,
        overflowY: "auto",
        position: "relative",
      }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        {items.slice(visibleRange.startIndex, visibleRange.endIndex).map((item, localIndex) => {
          const index = visibleRange.startIndex + localIndex;
          const top = offsets[index] ?? 0;
          const itemHeight = itemHeights[index] ?? estimatedItemHeight;

          return (
            <div
              key={index}
              style={{
                position: "absolute",
                top,
                left: 0,
                right: 0,
                height: itemHeight,
              }}
            >
              {renderItem(item, index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}