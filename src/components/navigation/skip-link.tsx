"use client";

import React, { useEffect, useState } from "react";

/**
 * Accessible skip link that prevents native fragment jumps from dropping focus
 * and reliably shifts active focus onto `#main-content` on keyboard or click activation.
 */
export function SkipLink() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return (
    <a
      href="#main-content"
      data-hydrated={hydrated ? "true" : undefined}
      onClick={(event) => {
        const main = document.getElementById("main-content");
        if (main instanceof HTMLElement) {
          event.preventDefault();
          main.scrollIntoView({ block: "start" });
          main.focus({ preventScroll: true });
        }
      }}
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:font-semibold focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
    >
      Skip to content
    </a>
  );
}
