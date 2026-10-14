"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

const CONTROL_CLASS =
  "grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-40";

interface Movable {
  id: string;
}

/**
 * A list whose items can be reordered (FR-2.2) three ways, so nobody depends
 * on a mouse (NFR-5): drag the handle; focus the handle and use Space, the
 * arrow keys, then Space again; or press the Move up and Move down buttons.
 * Screen readers are told where an item lands.
 *
 * `renderItem` places the controls it is given wherever suits the row.
 */
export function SortableList<T extends Movable>({
  items,
  label,
  nameOf,
  onMove,
  disabled = false,
  className,
  itemClassName,
  renderItem,
}: {
  items: T[];
  /** Names the list, e.g. "Lessons in Unit 1". */
  label: string;
  nameOf: (item: T) => string;
  onMove: (from: number, to: number) => void;
  disabled?: boolean;
  className?: string;
  itemClassName?: string;
  renderItem: (item: T, controls: ReactNode, index: number) => ReactNode;
}) {
  const contextId = useId();
  const listRef = useRef<HTMLOListElement>(null);
  // Which button to return focus to once the list has re-rendered in its new order.
  const refocus = useRef<{ id: string; direction: "up" | "down" } | null>(null);
  const [moved, setMoved] = useState("");

  const sensors = useSensors(
    // A small distance, so a click on the handle is not taken for a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const positionOf = (id: string | number) => items.findIndex((item) => item.id === id);
  const name = (id: string | number) => {
    const item = items[positionOf(id)];
    return item ? nameOf(item) || "Untitled item" : "Item";
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${name(active.id)}. It is in position ${positionOf(active.id) + 1} of ${items.length}.`,
    onDragOver: ({ active, over }) =>
      over ? `${name(active.id)} is over position ${positionOf(over.id) + 1} of ${items.length}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${name(active.id)} was dropped in position ${positionOf(over.id) + 1} of ${items.length}.`
        : `${name(active.id)} was dropped where it started.`,
    onDragCancel: ({ active }) => `Moving cancelled. ${name(active.id)} is back where it started.`,
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = positionOf(active.id);
    const to = positionOf(over.id);
    if (from !== -1 && to !== -1) onMove(from, to);
  };

  const step = (item: T, index: number, direction: "up" | "down") => {
    const to = direction === "up" ? index - 1 : index + 1;
    refocus.current = { id: item.id, direction };
    setMoved(`${nameOf(item) || "Untitled item"} moved to position ${to + 1} of ${items.length}.`);
    onMove(index, to);
  };

  useEffect(() => {
    const target = refocus.current;
    if (!target) return;
    refocus.current = null;
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>(`[data-move-item="${target.id}"]`);
    const wanted = [...(buttons ?? [])].find((button) => button.dataset.moveDirection === target.direction);
    // At the top or bottom the pressed button is now disabled, so use its neighbour.
    (wanted && !wanted.disabled ? wanted : [...(buttons ?? [])].find((button) => !button.disabled))?.focus();
  }, [items]);

  return (
    <DndContext
      id={contextId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "To reorder, press Space to pick up the item, use the up and down arrow keys to move it, then press Space to drop it or Escape to cancel. The Move up and Move down buttons do the same.",
        },
      }}
    >
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy} disabled={disabled}>
        <ol ref={listRef} aria-label={label} className={className}>
          {items.map((item, index) => (
            <SortableRow key={item.id} id={item.id} className={itemClassName}>
              {(handle) =>
                renderItem(
                  item,
                  <span className="flex shrink-0 items-center">
                    <button
                      type="button"
                      aria-label={`Drag to reorder ${nameOf(item) || "this item"}`}
                      disabled={disabled}
                      className={cn(CONTROL_CLASS, "cursor-grab touch-none active:cursor-grabbing")}
                      {...handle}
                    >
                      <GripVertical aria-hidden className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${nameOf(item) || "this item"} up`}
                      data-move-item={item.id}
                      data-move-direction="up"
                      disabled={disabled || index === 0}
                      onClick={() => step(item, index, "up")}
                      className={CONTROL_CLASS}
                    >
                      <ArrowUp aria-hidden className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${nameOf(item) || "this item"} down`}
                      data-move-item={item.id}
                      data-move-direction="down"
                      disabled={disabled || index === items.length - 1}
                      onClick={() => step(item, index, "down")}
                      className={CONTROL_CLASS}
                    >
                      <ArrowDown aria-hidden className="size-4" />
                    </button>
                  </span>,
                  index,
                )
              }
            </SortableRow>
          ))}
        </ol>
      </SortableContext>
      <span role="status" className="sr-only">
        {moved}
      </span>
    </DndContext>
  );
}

function SortableRow({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: (handle: Record<string, unknown>) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(className, isDragging && "relative z-10 opacity-80 shadow-lg")}
    >
      {children({ ...attributes, ...listeners })}
    </li>
  );
}
