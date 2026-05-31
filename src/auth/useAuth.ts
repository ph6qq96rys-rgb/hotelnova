// src/auth/useAuth.ts
//
// Re-export useAuth from AuthProvider so callers that import from this module
// path continue to work without changing their import statements.
//
// ── What was wrong in the original ─────────────────────────────────────────
// The entire file was commented out. useAuth was only exported from
// AuthProvider.tsx, meaning call sites had to import from two different paths
// depending on where they were written. This re-export unifies them.

export { useAuth } from "./AuthProvider";
export type { AuthContextValue } from "./AuthProvider";