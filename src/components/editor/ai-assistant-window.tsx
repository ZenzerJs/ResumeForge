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
  const isInteractingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  });
  const resizeStartRef = useRef<{ mouseX: number; mouseY: number; startW: number; startH: number }>({
    mouseX: 0,
    mouseY: 0,
    startW: 0,
    startH: 0,
  });
  const rafIdRef = useRef<number | null>(null);
  const currentPosRef = useRef<WindowGeometry>(DEFAULT_GEOMETRY);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.mode) setMode(parsed.mode);
        if (parsed.geometry) {
          setGeometry(parsed.geometry);
          currentPosRef.current = parsed.geometry;
        }
      }
    } catch {
      // ignore read error
    }
  }, []);

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

  const handleSetMode = (newMode: WindowMode) => {
    setMode(newMode);
    persistState(newMode, currentPosRef.current);
  };

  // Dragging logic for floating mode
  const handleMouseDownDrag = (e: React.MouseEvent) => {
    if (mode !== "floating") return;
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("input") ||
      target.closest("textarea") ||
      target.closest("select") ||
      target.closest("[data-no-drag]")
    ) {
      return;
    }

    e.preventDefault();
    isInteractingRef.current = true;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: currentPosRef.current.x,
      startY: currentPosRef.current.y,
    };

    if (windowRef.current) {
      windowRef.current.style.willChange = "left, top";
      document.body.style.userSelect = "none";
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isInteractingRef.current) return;
      const dx = moveEvent.clientX - dragStartRef.current.mouseX;
      const dy = moveEvent.clientY - dragStartRef.current.mouseY;

      const maxX = Math.max(0, window.innerWidth - currentPosRef.current.width);
      const maxY = Math.max(0, window.innerHeight - 100);

      const newX = Math.min(Math.max(10, dragStartRef.current.startX + dx), maxX);
      const newY = Math.min(Math.max(10, dragStartRef.current.startY + dy), maxY);

      currentPosRef.current.x = newX;
      currentPosRef.current.y = newY;

      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        if (windowRef.current && mode === "floating") {
          windowRef.current.style.left = `${newX}px`;
          windowRef.current.style.top = `${newY}px`;
        }
      });
    };

    const handleMouseUp = () => {
      isInteractingRef.current = false;
      document.body.style.userSelect = "";
      if (windowRef.current) {
        windowRef.current.style.willChange = "";
      }
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      setGeometry({ ...currentPosRef.current });
      persistState(mode, currentPosRef.current);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Resize logic for floating mode
  const handleMouseDownResize = (e: React.MouseEvent) => {
    if (mode !== "floating") return;
    e.preventDefault();
    e.stopPropagation();

    isInteractingRef.current = true;
    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startW: currentPosRef.current.width,
      startH: currentPosRef.current.height,
    };

    if (windowRef.current) {
      windowRef.current.style.willChange = "width, height";
      document.body.style.userSelect = "none";
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isInteractingRef.current) return;
      const dw = moveEvent.clientX - resizeStartRef.current.mouseX;
      const dh = moveEvent.clientY - resizeStartRef.current.mouseY;

      const newW = Math.max(MIN_WIDTH, Math.min(window.innerWidth - currentPosRef.current.x - 20, resizeStartRef.current.startW + dw));
      const newH = Math.max(MIN_HEIGHT, Math.min(window.innerHeight - currentPosRef.current.y - 20, resizeStartRef.current.startH + dh));

      currentPosRef.current.width = newW;
      currentPosRef.current.height = newH;

      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        if (windowRef.current && mode === "floating") {
          windowRef.current.style.width = `${newW}px`;
          windowRef.current.style.height = `${newH}px`;
        }
      });
    };

    const handleMouseUp = () => {
      isInteractingRef.current = false;
      document.body.style.userSelect = "";
      if (windowRef.current) {
        windowRef.current.style.willChange = "";
      }
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      setGeometry({ ...currentPosRef.current });
      persistState(mode, currentPosRef.current);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  if (!mounted || !open) return null;

  const content = (
    <div
      ref={windowRef}
      data-testid="ai-assistant-window"
      data-mode={mode}
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
        "flex flex-col bg-slate-950 text-slate-100 shadow-2xl border border-slate-800 transition-all",
        mode === "docked" &&
          "fixed inset-y-0 right-0 z-50 w-full max-w-lg border-l border-slate-800 duration-200 animate-in slide-in-from-right",
        mode === "floating" &&
          "fixed z-50 rounded-xl overflow-hidden border-slate-700/80 shadow-slate-950/80 transition-none",
        mode === "maximized" &&
          "fixed inset-4 md:inset-8 z-50 rounded-2xl border-slate-700 overflow-hidden duration-150 animate-in zoom-in-95"
      )}
    >
      {/* Window Title Header */}
      <div
        onMouseDown={handleMouseDownDrag}
        className={cn(
          "flex items-center justify-between px-3.5 py-2.5 bg-slate-900/90 border-b border-slate-800 select-none",
          mode === "floating" ? "cursor-grab active:cursor-grabbing" : "cursor-default"
        )}
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center size-6 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Bot className="size-3.5" />
          </div>
          <span className="text-xs font-semibold text-white">{title}</span>
        </div>

        {/* Window Mode Controls */}
        <div className="flex items-center gap-1" data-no-drag>
          <button
            type="button"
            onClick={() => handleSetMode("docked")}
            className={cn(
              "p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors",
              mode === "docked" && "text-amber-400 bg-amber-950/40"
            )}
            title="Dock to side panel"
          >
            <Dock className="size-3.5" />
          </button>

          <button
            type="button"
            onClick={() => handleSetMode("floating")}
            className={cn(
              "p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors",
              mode === "floating" && "text-amber-400 bg-amber-950/40"
            )}
            title="Float &amp; move freely"
          >
            <Move className="size-3.5" />
          </button>

          <button
            type="button"
            onClick={() => handleSetMode(mode === "maximized" ? "docked" : "maximized")}
            className={cn(
              "p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors",
              mode === "maximized" && "text-amber-400 bg-amber-950/40"
            )}
            title={mode === "maximized" ? "Restore" : "Maximize"}
          >
            {mode === "maximized" ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="p-1 rounded text-slate-400 hover:text-red-300 hover:bg-red-950/40 transition-colors ml-1"
            title="Close window"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Main Window Body Container */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-slate-950">
        {children}
      </div>

      {/* Resize Grip Handle (Floating mode only) */}
      {mode === "floating" && (
        <div
          onMouseDown={handleMouseDownResize}
          data-testid="window-resize-handle"
          className="absolute bottom-0 right-0 size-4 cursor-se-resize flex items-center justify-center text-slate-500 hover:text-amber-400"
          title="Drag to resize"
        >
          <svg viewBox="0 0 6 6" className="size-2.5 fill-current opacity-70">
            <circle cx="5" cy="5" r="0.8" />
            <circle cx="5" cy="2.5" r="0.8" />
            <circle cx="2.5" cy="5" r="0.8" />
          </svg>
        </div>
      )}
    </div>
  );

  // Render backdrop only in docked (optional) or maximized mode; floating mode MUST NOT render a backdrop
  return createPortal(
    <>
      {mode === "maximized" && (
        <div
          onClick={() => handleSetMode("docked")}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in"
        />
      )}
      {content}
    </>,
    document.body
  );
});
