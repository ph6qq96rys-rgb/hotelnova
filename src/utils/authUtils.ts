const EMPTY_GUID = "00000000-0000-0000-0000-000000000000";

export function isNullOrEmpty(value?: string | null) {
  return (
    value === null ||
    value === undefined ||
    value.trim() === "" ||
    value === EMPTY_GUID
  );
}

export function clearAuthStorage() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("user_id");
  localStorage.removeItem("company_id");
}
