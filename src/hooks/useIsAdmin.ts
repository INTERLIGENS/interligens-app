"use client";

// ─── useIsAdmin — client-side admin-founder detection ────────────────────
// Fetches /api/auth/admin-check once on mount, caches the result in state.
// Used by investigator surfaces to bypass NDA / onboarding flows when the
// admin founder is signed in.
//
// Tri-state return:
//   isAdmin === null  — still loading (initial fetch in flight)
//   isAdmin === true  — admin_session cookie is valid
//   isAdmin === false — no admin session (normal investigator / visitor)

import { useEffect, useState } from "react";

export function useIsAdmin(): {
  isAdmin: boolean | null;
  loading: boolean;
} {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/admin-check", {
          credentials: "include",
          cache: "no-store",
        });
        if (cancelled) return;
        if (!res.ok) {
          setIsAdmin(false);
          return;
        }
        const data = (await res.json().catch(() => ({}))) as {
          isAdmin?: boolean;
        };
        setIsAdmin(Boolean(data.isAdmin));
      } catch {
        if (!cancelled) setIsAdmin(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { isAdmin, loading: isAdmin === null };
}
