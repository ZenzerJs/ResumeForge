"use client";

import { useCallback, useRef, useEffect } from "react";

/**
 * useRovingTablist — ArrowLeft / ArrowRight / Home / End roving focus
 * for `role="tablist"` containers. Each `role="tab"` inside the container
 * participates. The first (or currently active) tab gets `tabIndex={0}`;
 * the rest get `tabIndex={-1}`.
 *
 * Usage:
 *   const { tablistRef, getTabProps } = useRovingTablist(activeIndex);
 *   <div ref={tablistRef} role="tablist" aria-label="…">
 *     {tabs.map((t, i) => (
 *       <button {...getTabProps(i)} role="tab" aria-selected={i === activeIndex}>
 *         {t.label}
 *       </button>
 *     ))}
 *   </div>
 */
export function useRovingTablist(activeIndex: number) {
  const tablistRef = useRef<HTMLDivElement>(null);

  // Focus the active tab whenever activeIndex changes
  useEffect(() => {
    const container = tablistRef.current;
    if (!container) return;
    const tabs = Array.from(
      container.querySelectorAll<HTMLElement>('[role="tab"]')
    );
    const target = tabs[activeIndex];
    if (target && document.activeElement && container.contains(document.activeElement)) {
      target.focus();
    }
  }, [activeIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      const container = tablistRef.current;
      if (!container) return;
      const tabs = Array.from(
        container.querySelectorAll<HTMLElement>('[role="tab"]')
      );
      if (tabs.length === 0) return;
      const currentIdx = tabs.indexOf(e.currentTarget);
      if (currentIdx === -1) return;

      const isDisabled = (el: HTMLElement | undefined) =>
        Boolean(el && (el as HTMLButtonElement).disabled);

      let nextIdx: number | null = null;
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const dir = e.key === "ArrowRight" ? 1 : -1;
        for (let step = 1; step <= tabs.length; step++) {
          const candidate = (currentIdx + dir * step + tabs.length) % tabs.length;
          if (!isDisabled(tabs[candidate])) {
            nextIdx = candidate;
            break;
          }
        }
      } else if (e.key === "Home") {
        nextIdx = tabs.findIndex((t) => !isDisabled(t));
        if (nextIdx === -1) nextIdx = null;
      } else if (e.key === "End") {
        for (let idx = tabs.length - 1; idx >= 0; idx--) {
          if (!isDisabled(tabs[idx])) {
            nextIdx = idx;
            break;
          }
        }
      } else {
        return;
      }

      if (nextIdx === null) return;
      e.preventDefault();
      tabs[nextIdx]?.focus();
      tabs[nextIdx]?.click();
    },
    []
  );

  const getTabProps = useCallback(
    (index: number) => ({
      tabIndex: index === activeIndex ? 0 : -1,
      onKeyDown: handleKeyDown,
    }),
    [activeIndex, handleKeyDown]
  );

  return { tablistRef, getTabProps } as const;
}
