/**
 * Task 7.3 — useActiveJob hook
 *
 * Shared active-job state across all surfaces (tracker, tailor, editor).
 * Source-of-truth priority:
 *   1. URL search param `?jobId=<id>` (deeplink or programmatic navigation)
 *   2. sessionStorage key `resumeforge_active_job_id` (survives tab switches)
 *   3. null (no job selected)
 *
 * Setting the active job writes to sessionStorage so that navigating
 * away and back (tracker → editor → tracker) preserves the selection
 * without re-selecting or re-pasting.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const SESSION_KEY = "resumeforge_active_job_id";

export interface UseActiveJobReturn {
  activeJobId: string | null;
  setActiveJobId: (id: string | null) => void;
  /** Navigate to `targetPath` while encoding the active jobId as a URL param */
  navigateWithJob: (targetPath: string, jobId?: string | null) => void;
  /** Clear the persisted active job from sessionStorage */
  clearActiveJob: () => void;
}

export function useActiveJob(): UseActiveJobReturn {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [activeJobId, setActiveJobIdState] = useState<string | null>(() => {
    // Initialise from URL param first, then sessionStorage, on client
    if (typeof window === "undefined") return null;
    const urlParam = searchParams.get("jobId");
    if (urlParam) {
      // Sync URL param → sessionStorage so subsequent navigations remember it
      sessionStorage.setItem(SESSION_KEY, urlParam);
      return urlParam;
    }
    return sessionStorage.getItem(SESSION_KEY);
  });

  // Keep URL param → sessionStorage in sync when searchParams change (e.g. back navigation)
  useEffect(() => {
    const urlParam = searchParams.get("jobId");
    if (urlParam && urlParam !== activeJobId) {
      sessionStorage.setItem(SESSION_KEY, urlParam);
      setActiveJobIdState(urlParam);
    }
  }, [searchParams, activeJobId]);

  const setActiveJobId = useCallback((id: string | null) => {
    if (id) {
      sessionStorage.setItem(SESSION_KEY, id);
    } else {
      sessionStorage.removeItem(SESSION_KEY);
    }
    setActiveJobIdState(id);
  }, []);

  const navigateWithJob = useCallback(
    (targetPath: string, jobId?: string | null) => {
      const resolvedId = jobId ?? activeJobId;
      if (resolvedId) {
        // Write to sessionStorage before navigation so it's available immediately
        sessionStorage.setItem(SESSION_KEY, resolvedId);
        router.push(`${targetPath}?jobId=${resolvedId}`);
      } else {
        router.push(targetPath);
      }
    },
    [router, activeJobId]
  );

  const clearActiveJob = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setActiveJobIdState(null);
  }, []);

  return { activeJobId, setActiveJobId, navigateWithJob, clearActiveJob };
}
