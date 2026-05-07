import { useCallback, useEffect, useRef, useState } from "react";
import { usersApi } from "../api/usersApi";

/** Keep the status union in one place */
export type UserStatus = "Active" | "Pending" | "Suspended";

export type UserAssignmentDto = {
  id: string;
  roleId: string;
  roleName: string;
  branchId: string | null;
  branchName: string | null;
  permissionCount: number;
};

export type UserDetailDto = {
  id: string;
  email: string;
  fullName: string;
  status: UserStatus;
  assignments: UserAssignmentDto[];
};

export type UserRowDto = {
  id: string;
  email: string;
  fullName: string;
  status: UserStatus;
};

/** If your backend returns a different shape, map it here. */
function toUserRow(u: any): UserRowDto {
  return {
    id: String(u?.id ?? ""),
    email: String(u?.email ?? ""),
    fullName: String(u?.fullName ?? ""),
    status: (u?.status ?? "Active") as UserStatus,
  };
}

function toUserDetail(u: any): UserDetailDto {
  const assignments: UserAssignmentDto[] = Array.isArray(u?.assignments)
    ? u.assignments.map((a: any) => ({
        id: String(a?.id ?? ""),
        roleId: String(a?.roleId ?? ""),
        roleName: String(a?.roleName ?? ""),
        branchId: a?.branchId ? String(a.branchId) : null,
        branchName: a?.branchName ?? null,
        permissionCount: Number(a?.permissionCount ?? 0),
      }))
    : [];

  return {
    id: String(u?.id ?? ""),
    email: String(u?.email ?? ""),
    fullName: String(u?.fullName ?? ""),
    status: (u?.status ?? "Active") as UserStatus,
    assignments,
  };
}

/* -------------------------
   shared: abortable async
-------------------------- */
function useAbortableRequest() {
  const abortRef = useRef<AbortController | null>(null);

  const begin = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    return abortRef.current.signal;
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  useEffect(() => abort, [abort]);

  return { begin, abort };
}

/* -------------------------
   useUser (company-scoped)
-------------------------- */
export function useUser(companyId: string, userId: string|null) {
  const [user, setUser] = useState<UserDetailDto | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(userId));
  const [error, setError] = useState<string | null>(null);

  const { begin, abort } = useAbortableRequest();

  const load = useCallback(async () => {
    const signal = begin();

    if (!companyId) {
      setUser(null);
      setLoading(false);
      setError("Missing companyId in route.");
      return;
    }

    if (!userId) {
      setUser(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await usersApi.getUserById(companyId, userId, signal);
      setUser(toUserDetail(data));
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Failed to load user");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [begin, companyId, userId]);

  useEffect(() => {
    load();
    return abort;
  }, [load, abort]);

  return { user, loading, error, refresh: load, companyId };
}

/* -------------------------
   useUsers (company-scoped)
-------------------------- */
export function useUsers(companyId: string) {
  const [users, setUsers] = useState<UserRowDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const { begin, abort } = useAbortableRequest();

  const load = useCallback(async () => {
    const signal = begin();

    if (!companyId) {
      setUsers([]);
      setLoading(false);
      setError("Missing companyId in route.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await usersApi.listUsers(companyId, signal);

      // If backend returns PagedResult, normalize here:
      const rows = res;// Array.isArray(res) ? res : (res ?? []);
      setUsers(rows.map(toUserRow));
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Failed to load users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [begin, companyId]);

  useEffect(() => {
    load();
    return abort;
  }, [load, abort]);

  return { users, loading, error, refresh: load, companyId };
}
