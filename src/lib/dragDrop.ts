/**
 * Drag and Drop utilities for reordering posts
 */

export interface DragItem {
  index: number;
  day: number;
}

export interface DragState {
  draggedIndex: number | null;
  dropTargetIndex: number | null;
}

/**
 * Swap two items in an array
 */
export function swapItems<T>(arr: T[], indexA: number, indexB: number): T[] {
  const newArr = [...arr];
  [newArr[indexA], newArr[indexB]] = [newArr[indexB], newArr[indexA]];
  return newArr;
}

let cachedDragImage: HTMLDivElement | null = null;

function getDragImageEl(): HTMLDivElement {
  if (cachedDragImage) return cachedDragImage;
  const dragImage = document.createElement("div");
  dragImage.textContent = `Moving post`;
  dragImage.style.position = "absolute";
  dragImage.style.top = "-1000px";
  dragImage.style.background = "var(--primary)";
  dragImage.style.color = "#fff";
  dragImage.style.padding = "8px 16px";
  dragImage.style.borderRadius = "6px";
  dragImage.style.fontSize = "12px";
  cachedDragImage = dragImage;
  return dragImage;
}

/**
 * Handle drag start event
 */
export function handleDragStart(e: React.DragEvent<HTMLElement>, index: number): void {
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("application/json", JSON.stringify({ index }));

  // Reuse a single detached drag-image node instead of creating one per drag
  const dragImage = getDragImageEl();
  document.body.appendChild(dragImage);
  e.dataTransfer.setDragImage(dragImage, 0, 0);
  setTimeout(() => {
    if (dragImage.parentNode) dragImage.parentNode.removeChild(dragImage);
  }, 0);
}

/**
 * Handle drag over event
 */
export function handleDragOver(e: React.DragEvent<HTMLElement>): void {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
}

/**
 * Handle drop event
 */
export function handleDrop(e: React.DragEvent<HTMLElement>, targetIndex: number): number | null {
  e.preventDefault();
  try {
    const data = e.dataTransfer.getData("application/json");
    const { index } = JSON.parse(data);
    if (index !== targetIndex) {
      return index;
    }
  } catch (err) {
    console.error("Error parsing drag data:", err);
  }
  return null;
}

/**
 * Check if an element is being dragged over
 */
export function isDragOver(e: React.DragEvent<HTMLElement>): boolean {
  return e.dataTransfer.types.includes("application/json");
}
