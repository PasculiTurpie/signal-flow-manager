import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";

const defaultPosition = { x: 0, y: 0 };

const getPointerEvent = (event) => {
  if (event && typeof event === "object" && "touches" in event) {
    return event.touches[0] || event.changedTouches?.[0] || null;
  }
  return event;
};

const isNumber = (value) => Number.isFinite(Number(value));

const toPosition = (point) => {
  if (!point || typeof point !== "object") {
    return { ...defaultPosition };
  }
  const x = Number(point.x);
  const y = Number(point.y);
  if (!isNumber(x) || !isNumber(y)) {
    return { ...defaultPosition };
  }
  return { x, y };
};

export default function useDraggableLabel({
  initial,
  disabled = false,
  clamp,
  onChange,
  onDragEnd,
} = {}) {
  const { project } = useReactFlow();
  const [position, setPosition] = useState(() => toPosition(initial));
  const [dragging, setDragging] = useState(false);
  const stateRef = useRef({
    offset: { x: 0, y: 0 },
    start: toPosition(initial),
    dragging: false,
  });
  const positionRef = useRef(position);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    if (dragging) return;
    const next = toPosition(initial);
    setPosition(next);
    stateRef.current.start = next;
  }, [initial?.x, initial?.y, dragging]);

  const clampPosition = useCallback(
    (point) => {
      if (!point) return { ...defaultPosition };
      return clamp ? clamp(point) : point;
    },
    [clamp]
  );

  const projectPointer = useCallback(
    (event) => {
      const pointer = getPointerEvent(event);
      if (!pointer) return { ...defaultPosition };
      return project({ x: pointer.clientX, y: pointer.clientY });
    },
    [project]
  );

  const finalizeDrag = useCallback(
    (event) => {
      if (!stateRef.current.dragging) return;
      if (event?.cancelable) {
        event.preventDefault();
      }
      stateRef.current.dragging = false;
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", finalizeDrag);
      window.removeEventListener("pointercancel", finalizeDrag);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", finalizeDrag);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", finalizeDrag);
      window.removeEventListener("touchcancel", finalizeDrag);
      setDragging(false);

      const finalPosition = positionRef.current;
      const startPosition = stateRef.current.start;
      const moved =
        !startPosition ||
        startPosition.x !== finalPosition.x ||
        startPosition.y !== finalPosition.y;

      if (moved) {
        onDragEnd?.(finalPosition, { initial: startPosition, moved: true });
      } else {
        onDragEnd?.(finalPosition, { initial: startPosition, moved: false });
      }
    },
    [onDragEnd]
  );

  const handleMove = useCallback(
    (event) => {
      if (!stateRef.current.dragging) return;
      if (event?.cancelable) {
        event.preventDefault();
      }
      const projected = projectPointer(event);
      const offset = stateRef.current.offset;
      const next = {
        x: projected.x + offset.x,
        y: projected.y + offset.y,
      };
      const clamped = clampPosition(next);
      setPosition(clamped);
      onChange?.(clamped);
    },
    [clampPosition, onChange, projectPointer]
  );

  const startDragging = useCallback(
    (event) => {
      if (disabled) return;
      if (stateRef.current.dragging) return;
      const pointerEvent = getPointerEvent(event);
      if (pointerEvent && "button" in pointerEvent && pointerEvent.button !== 0) {
        return;
      }
      if (typeof event?.detail === "number" && event.detail > 1) {
        return;
      }
      if (event?.preventDefault) event.preventDefault();
      if (event?.stopPropagation) event.stopPropagation();

      const projected = projectPointer(event);
      const startPosition = clampPosition(positionRef.current);
      stateRef.current.start = startPosition;
      stateRef.current.offset = {
        x: startPosition.x - projected.x,
        y: startPosition.y - projected.y,
      };
      stateRef.current.dragging = true;
      setDragging(true);

      const supportsPointerEvents =
        typeof window !== "undefined" && "PointerEvent" in window;

      if (supportsPointerEvents) {
        window.addEventListener("pointermove", handleMove, { passive: false });
        window.addEventListener("pointerup", finalizeDrag);
        window.addEventListener("pointercancel", finalizeDrag);
      } else {
        window.addEventListener("mousemove", handleMove);
        window.addEventListener("mouseup", finalizeDrag);
        window.addEventListener("touchmove", handleMove, { passive: false });
        window.addEventListener("touchend", finalizeDrag);
        window.addEventListener("touchcancel", finalizeDrag);
      }
    },
    [clampPosition, disabled, finalizeDrag, handleMove, projectPointer]
  );

  useEffect(
    () => () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", finalizeDrag);
      window.removeEventListener("pointercancel", finalizeDrag);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", finalizeDrag);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", finalizeDrag);
      window.removeEventListener("touchcancel", finalizeDrag);
    },
    [finalizeDrag, handleMove]
  );

  const styleTransform = useMemo(
    () => `translate(-50%, -50%) translate(${position.x}px, ${position.y}px)`,
    [position.x, position.y]
  );

  return {
    position,
    transform: styleTransform,
    isDragging: dragging,
    handlePointerDown: startDragging,
    setPosition,
  };
}
