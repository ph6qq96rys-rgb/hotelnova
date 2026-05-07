export function promptRequired(message: string): string | null {
  const value = window.prompt(message, "");
  if (value === null) return null;

  const trimmed = value.trim();
  if (!trimmed) {
    window.alert("This field is required.");
    return null;
  }

  return trimmed;
}

export function confirmAction(message: string): boolean {
  return window.confirm(message);
}