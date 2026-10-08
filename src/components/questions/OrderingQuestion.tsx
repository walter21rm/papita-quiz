"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, Check, GripVertical, X } from "lucide-react";
import { Markdown } from "@/components/Markdown";
import type { QuestionInputProps } from "./types";

interface ItemProps {
  id: number;
  position: number;
  text: string;
  total: number;
  locked: boolean;
  status?: "correct" | "wrong";
  onMove: (from: number, to: number) => void;
}

const sortableId = (itemIndex: number) => `item-${itemIndex}`;
const itemIndexOf = (id: string | number) => Number(String(id).replace("item-", ""));

function SortableItem({ id, position, text, total, locked, status, onMove }: ItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId(id),
    disabled: locked,
  });
  let style = "border-papa-100 bg-white";
  if (status === "correct") style = "border-brote-500 bg-brote-50";
  if (status === "wrong") style = "border-tomate-500 bg-tomate-50";

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-2xl border-2 px-2 py-2.5 ${style} ${
        isDragging ? "z-10 shadow-lg shadow-papa-300/50" : ""
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={locked}
        aria-label={`Arrastrar: ${text}`}
        className="cursor-grab touch-none rounded-lg p-1.5 text-papa-400 hover:bg-papa-50 hover:text-papa-700 active:cursor-grabbing disabled:cursor-default"
      >
        <GripVertical className="size-5" aria-hidden />
      </button>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-papa-100 font-display text-sm font-bold text-papa-700">
        {status === "correct" ? <Check className="size-4 text-brote-600" /> : status === "wrong" ? <X className="size-4 text-tomate-600" /> : position + 1}
      </span>
      <Markdown inline className="flex-1 text-papa-900">
        {text}
      </Markdown>
      {!locked && (
        <span className="flex flex-col">
          <button
            type="button"
            onClick={() => onMove(position, position - 1)}
            disabled={position === 0}
            aria-label={`Subir: ${text}`}
            className="rounded-md p-0.5 text-papa-500 hover:bg-papa-50 disabled:opacity-30"
          >
            <ArrowUp className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => onMove(position, position + 1)}
            disabled={position === total - 1}
            aria-label={`Bajar: ${text}`}
            className="rounded-md p-0.5 text-papa-500 hover:bg-papa-50 disabled:opacity-30"
          >
            <ArrowDown className="size-4" aria-hidden />
          </button>
        </span>
      )}
    </li>
  );
}

export function OrderingQuestion({ question, response, onChange, review, disabled }: QuestionInputProps<"ordering">) {
  const items = question.orderedItems ?? [];
  const order = response.order.length === items.length ? response.order : items.map((_, index) => index);
  const locked = review || disabled;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function move(from: number, to: number) {
    if (to < 0 || to >= order.length) return;
    onChange({ type: "ordering", order: arrayMove(order, from, to) });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    move(order.indexOf(itemIndexOf(active.id)), order.indexOf(itemIndexOf(over.id)));
  }

  return (
    <div className="flex flex-col gap-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={order.map(sortableId)} strategy={verticalListSortingStrategy}>
          <ol className="flex flex-col gap-2">
            {order.map((itemIndex, position) => (
              <SortableItem
                key={itemIndex}
                id={itemIndex}
                position={position}
                text={items[itemIndex]}
                total={order.length}
                locked={locked}
                status={review ? (itemIndex === position ? "correct" : "wrong") : undefined}
                onMove={move}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      {review && order.some((itemIndex, position) => itemIndex !== position) && (
        <div className="rounded-2xl bg-brote-50 px-4 py-3 text-sm text-papa-900 ring-1 ring-brote-100">
          <p className="font-extrabold text-brote-700">Orden correcto:</p>
          <ol className="mt-1 list-decimal pl-5">
            {items.map((item) => (
              <li key={item}>
                <Markdown inline>{item}</Markdown>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
