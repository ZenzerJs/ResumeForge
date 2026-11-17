"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Maximize2,
  Minimize2,
  Dock,
  Move,
  Bot,
  Sparkles,
  ChevronRight,
  PanelRightClose,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type WindowMode = "docked" | "floating" | "maximized";

interface WindowGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

const STORAGE_KEY = "resumeforge_assistant_window";
const MIN_WIDTH = 380;
const MIN_HEIGHT = 450;

const DEFAULT_GEOMETRY: WindowGeometry = {
  x: typeof window !== "undefined" ? Math.max(20, window.innerWidth - 480) : 800,
  y: 80,
  width: 440,
  height: 620,
};

interface AiAssistantWindowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: React.ReactNode;
}

export const AiAssistantWindow = React.memo(function AiAssistantWindow({
  open,
  onOpenChange,
  title = "AI Assistant",
  children,
}: AiAssistantWindowProps) {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<WindowMode>("docked");
  const [geometry, setGeometry] = useState<WindowGeometry>(DEFAULT_GEOMETRY);

  const windowRef = useRef<HTMLDivElement | null>(null);
  const maximizeBtnRef = useRef<HTMLButtonElement | null>(null);
  const isInteractingRef = useRef<boolean>(false);
  const interactionRef = useRef<{
    kind: "drag" | "resize";
    pointerId: number;
    target: HTMLElement | null;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
  } | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const currentPosRef = useRef<WindowGeometry>(DEFAULT_GEOMETRY);
  const prevModeRef = useRef<WindowMode>("docked");

  const clampFloatingGeometry = useCallback((next: WindowGeometry): WindowGeometry => {
    if (typeof window === "undefined") return next;
    const width = Math.max(MIN_WIDTH, Math.min(Math.max(MIN_WIDTH, window.innerWidth - 20), next.width));
    const height = Math.max(MIN_HEIGHT, Math.min(Math.max(MIN_HEIGHT, window.innerHeight - 20), next.height));
    const maxX = Math.max(10, window.innerWidth - width - 10);
    const maxY = Math.max(10, window.innerHeight - 100);
    const x = Math.min(Math.max(10, next.x), maxX);
    const y = Math.min(Math.max(10, next.y), maxY);
    return { x, y, width, height };
  }, []);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.mode) setMode(parsed.mode);
        if (parsed.geometry) {
          const clamped = clampFloatingGeometry(parsed.geometry);
          setGeometry(clamped);
          currentPosRef.current = clamped;
        }
      }
    } catch {
      // ignore read error
    }
  }, [clampFloatingGeometry]);

  const persistState = useCallback((newMode: WindowMode, newGeo: WindowGeometry) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ mode: newMode, geometry: newGeo })
      );
    } catch {
      // ignore
    }
  }, []);

  const handleSetMode = useCallback((newMode: WindowMode) => {
    const clamped = clampFloatingGeometry(currentPosRef.current);
    currentPosRef.current = clamped;
    setGeometry(clamped);
    setMode(newMode);
    persistState(newMode, clamped);
  }, [clampFloatingGeometry, persistState]);

  const endPointerInteraction = useCallback((commit: boolean) => {
    const active = interactionRef.current;
    if (!active) return;
    interactionRef.current = null;
    isInteractingRef.current = false;
    document.body.style.userSelect = "";
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (windowRef.current) {
      windowRef.current.style.willChange = "";
    }
    if (active.target) {
      try {
        if (active.target.hasPointerCapture(active.pointerId)) {
          active.target.releasePointerCapture(active.pointerId);
        }
      } catch {
        // ignore released pointer
      }
    }
    if (commit) {
      const clamped = clampFloatingGeometry(currentPosRef.current);
      currentPosRef.current = clamped;
      setGeometry(clamped);
      persistState(mode, clamped);
    } else {
      const reverted = {
        x: active.startX,
        y: active.startY,
        width: active.startW,
        height: active.startH,
      };
      currentPosRef.current = reverted;
      if (windowRef.current && mode === "floating") {
        windowRef.current.style.left = `${reverted.x}px`;
        windowRef.current.style.top = `${reverted.y}px`;
        windowRef.current.style.width = `${reverted.width}px`;
        windowRef.current.style.height = `${reverted.height}px`;
      }
    }
  }, [clampFloatingGeometry, mode, persistState]);

  const endPointerInteractionRef = useRef(endPointerInteraction);
  endPointerInteractionRef.current = endPointerInteraction;

  useEffect(() => {
    return () => {
      endPointerInteractionRef.current(false);
    };
  }, []);

  useEffect(() => {
    if (mode === "maximized" && open && windowRef.current) {
      const firstButton = windowRef.current.querySelector<HTMLElement>(
        "button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled])"
      );
      (firstButton ?? windowRef.current).focus();
    } else if (prevModeRef.current === "maximized" && mode !== "maximized" && open) {
      maximizeBtnRef.current?.focus();
    }
    prevModeRef.current = mode;
  }, [mode, open]);

  // Pointer-capture drag logic for floating mode
  const handlePointerDownDrag = (e: React.PointerEvent<HTMLElement>) => {
    if (mode !== "floating" || e.button > 0) return;
    const target = e.target as HTMLElement;
    if (
      target.closest("button:not([data-testid='window-drag-handle'])") ||
      target.closest("input") ||
      target.closest("textarea") ||
      target.closest("select") ||
      target.closest("[data-no-drag]")
    ) {
      return;
    }

    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore synthetic pointer without active capture
    }
    isInteractingRef.current = true;
    interactionRef.current = {
      kind: "drag",
      pointerId: e.pointerId,
      target: e.currentTarget,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: currentPosRef.current.x,
      startY: currentPosRef.current.y,
      startW: currentPosRef.current.width,
      startH: currentPosRef.current.height,
    };

    if (windowRef.current) {
      windowRef.current.style.willChange = "left, top";
      document.body.style.userSelect = "none";
    }
  };

  // Pointer-capture resize logic for floating mode
  const handlePointerDownResize = (e: React.PointerEvent<HTMLElement>) => {
    if (mode !== "floating" || e.button > 0) return;
    e.preventDefault();
    e.stopPropagation();

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore synthetic pointer without active capture
    }
    isInteractingRef.current = true;
    interactionRef.current = {
      kind: "resize",
      pointerId: e.pointerId,
      target: e.currentTarget,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: currentPosRef.current.x,
      startY: currentPosRef.current.y,
      startW: currentPosRef.current.width,
      startH: currentPosRef.current.height,
    };

    if (windowRef.current) {
      windowRef.current.style.willChange = "width, height";
      document.body.style.userSelect = "none";
    }
  };

  const handlePointerMoveCapture = (e: React.PointerEvent<HTMLElement>) => {
    const active = interactionRef.current;
    if (!active || active.pointerId !== e.pointerId || !isInteractingRef.current) return;

    const dx = e.clientX - active.startClientX;
    const dy = e.clientY - active.startClientY;

    if (active.kind === "drag") {
      const clamped = clampFloatingGeometry({
        ...currentPosRef.current,
        x: active.startX + dx,
        y: active.startY + dy,
      });
      currentPosRef.current = clamped;
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        if (windowRef.current && mode === "floating") {
          windowRef.current.style.left = `${clamped.x}px`;
          windowRef.current.style.top = `${clamped.y}px`;
        }
      });
    } else {
      const clamped = clampFloatingGeometry({
        ...currentPosRef.current,
        width: active.startW + dx,
        height: active.startH + dy,
      });
      currentPosRef.current = clamped;
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        if (windowRef.current && mode === "floating") {
          windowRef.current.style.width = `${clamped.width}px`;
          windowRef.current.style.height = `${clamped.height}px`;
        }
      });
    }
  };

  const handleDragHandleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (mode !== "floating") return;
    const step = e.shiftKey ? 48 : 16;
    let dx = 0;
    let dy = 0;
    if (e.key === "ArrowLeft") dx = -step;
    else if (e.key === "ArrowRight") dx = step;
    else if (e.key === "ArrowUp") dy = -step;
    else if (e.key === "ArrowDown") dy = step;
    else return;

    e.preventDefault();
    const clamped = clampFloatingGeometry({
      ...currentPosRef.current,
      x: currentPosRef.current.x + dx,
      y: currentPosRef.current.y + dy,
    });
    currentPosRef.current = clamped;
    setGeometry(clamped);
    persistState("floating", clamped);
  };

  const handleResizeHandleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (mode !== "floating") return;
    const step = e.shiftKey ? 48 : 16;
    let dw = 0;
    let dh = 0;
    if (e.key === "ArrowLeft") dw = -step;
    else if (e.key === "ArrowRight") dw = step;
    else if (e.key === "ArrowUp") dh = -step;
    else if (e.key === "ArrowDown") dh = step;
    else return;

    e.preventDefault();
    const clamped = clampFloatingGeometry({
      ...currentPosRef.current,
      width: currentPosRef.current.width + dw,
      height: currentPosRef.current.height + dh,
    });
    currentPosRef.current = clamped;
    setGeometry(clamped);
    persistState("floating", clamped);
  };

  const handleMaximizedKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (mode !== "maximized") return;
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      handleSetMode("docked");
      return;
    }
    if (e.key === "Tab" && windowRef.current) {
      const focusable = Array.from(
        windowRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  if (!mounted || !open) return null;

  const content = (
    <div
      ref={windowRef}
      data-testid="ai-assistant-window"
      data-mode={mode}
      role={mode === "maximized" ? "dialog" : "region"}
      aria-modal={mode === "maximized" ? true : undefined}
      aria-label={title}
      tabIndex={mode === "maximized" ? -1 : undefined}
      onKeyDown={handleMaximizedKeyDown}
      style={
        mode === "floating"
          ? {
              left: `${geometry.x}px`,
              top: `${geometry.y}px`,
              width: `${geometry.width}px`,
              height: `${geometry.height}px`,
            }
          : undefined
      }
      className={cn(
        "flex flex-col border border-hairline bg-panel text-foreground shadow-2xl transition-all",
        mode === "docked" &&
          "fixed inset-y-0 right-0 z-50 w-full max-w-lg border-l border-hairline duration-200 animate-in slide-in-from-right",
        mode === "floating" &&
          "fixed z-50 rounded-[10px] overflow-hidden border-control/70 transition-none",
        mode === "maximized" &&
          "fixed inset-4 md:inset-8 z-50 rounded-[10px] border-control/70 overflow-hidden duration-150 animate-in zoom-in-95"
      )}
    >
      {/* Window Title Header */}
      <div
        onPointerDown={handlePointerDownDrag}
        onPointerMove={handlePointerMoveCapture}
        onPointerUp={() => endPointerInteraction(true)}
        onPointerCancel={() => endPointerInteraction(false)}
        onLostPointerCapture={() => endPointerInteraction(true)}
        className={cn(
          "flex items-center justify-between border-b border-hairline bg-elevated/90 px-3.5 py-2.5 select-none",
          mode === "floating" ? "cursor-grab active:cursor-grabbing touch-none" : "cursor-default"
        )}
      >
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-[6px] border border-primary/30 bg-primary/10 text-primary">
            <Bot className="size-3.5" aria-hidden />
          </div>
          <span className="text-xs font-semibold text-foreground">{title}</span>
          {mode === "floating" && (
            <button
              type="button"
              data-testid="window-drag-handle"
              onKeyDown={handleDragHandleKeyDown}
              aria-label="Move floating window. Use arrow keys to reposition."
              title="Use arrow keys to move window"
              className="rounded-[6px] border border-hairline bg-inset px-1.5 py-0.5 text-xs font-mono text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
            >
              Move
            </button>
          )}
        </div>

        {/* Window Mode Controls */}
        <div className="flex items-center gap-1" data-no-drag>
          <button
            type="button"
            onClick={() => handleSetMode("docked")}
            aria-label="Dock window to side panel"
            aria-pressed={mode === "docked"}
            className={cn(
              "rounded-[6px] p-1 text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel",
              mode === "docked" && "bg-primary/15 text-primary"
            )}
            title="Dock to side panel"
          >
            <Dock className="size-3.5" aria-hidden />
          </button>

          <button
            type="button"
            onClick={() => handleSetMode("floating")}
            aria-label="Float window freely"
            aria-pressed={mode === "floating"}
            className={cn(
              "rounded-[6px] p-1 text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel",
              mode === "floating" && "bg-primary/15 text-primary"
            )}
            title="Float & move freely"
          >
            <Move className="size-3.5" aria-hidden />
          </button>

          <button
            ref={maximizeBtnRef}
            type="button"
            onClick={() => handleSetMode(mode === "maximized" ? "docked" : "maximized")}
            aria-label={mode === "maximized" ? "Restore window" : "Maximize window"}
            aria-pressed={mode === "maximized"}
            className={cn(
              "rounded-[6px] p-1 text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel",
              mode === "maximized" && "bg-primary/15 text-primary"
            )}
            title={mode === "maximized" ? "Restore" : "Maximize"}
          >
            {mode === "maximized" ? <Minimize2 className="size-3.5" aria-hidden /> : <Maximize2 className="size-3.5" aria-hidden />}
          </button>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close AI Assistant window"
            className="ml-1 rounded-[6px] p-1 text-muted-foreground transition-colors hover:bg-status-danger/15 hover:text-status-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
            title="Close window"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>

      {/* Main Window Body Container */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-canvas">
        {children}
      </div>

      {/* Resize Grip Handle (Floating mode only) */}
      {mode === "floating" && (
        <button
          type="button"
          onPointerDown={handlePointerDownResize}
          onPointerMove={handlePointerMoveCapture}
          onPointerUp={() => endPointerInteraction(true)}
          onPointerCancel={() => endPointerInteraction(false)}
          onLostPointerCapture={() => endPointerInteraction(true)}
          onKeyDown={handleResizeHandleKeyDown}
          data-testid="window-resize-handle"
          aria-label="Resize floating window. Use arrow keys to adjust width and height."
          className="absolute bottom-0 right-0 flex size-5 touch-none cursor-se-resize items-center justify-center rounded-tl-[6px] text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title="Drag or use arrow keys to resize"
        >
          <svg viewBox="0 0 6 6" className="size-2.5 fill-current opacity-70" aria-hidden>
            <circle cx="5" cy="5" r="0.8" />
            <circle cx="5" cy="2.5" r="0.8" />
            <circle cx="2.5" cy="5" r="0.8" />
          </svg>
        </button>
      )}
    </div>
  );

  // Render backdrop only in maximized mode; floating mode MUST NOT render a backdrop
  return createPortal(
    <>
      {mode === "maximized" && (
        <div
          aria-hidden="true"
          onClick={() => handleSetMode("docked")}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in"
        />
      )}
      {content}
    </>,
    document.body
  );
});
