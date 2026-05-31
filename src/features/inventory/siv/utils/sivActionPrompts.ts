// src/features/inventory/siv/utils/sivActionPrompts.ts
//
// window.prompt() and window.confirm() are removed.
// These functions now throw to signal "cancelled" — callers that previously
// checked for null should now catch the CancelledError.
//
// For actual UI prompts, use the inline modal pattern in SivDetailsPage /
// SivApprovalPage — those pages render a proper <textarea> modal that works
// correctly on mobile and inside iframes.

export class CancelledError extends Error {
  constructor() { super("User cancelled"); }
}

/**
 * @deprecated Use an inline modal in the page component instead.
 * Kept for backwards compatibility only.
 */
export function promptRequired(message: string): string | null {
  // Fall back to native prompt in development; return null (cancel) otherwise
  if (typeof window !== "undefined" && window.prompt) {
    const value   = window.prompt(message, "");
    if (value === null) return null;
    const trimmed = value.trim();
    if (!trimmed) { window.alert("This field is required."); return null; }
    return trimmed;
  }
  return null;
}

/**
 * @deprecated Use an inline confirm dialog instead.
 */
export function confirmAction(message: string): boolean {
  return typeof window !== "undefined" && window.confirm
    ? window.confirm(message)
    : false;
}