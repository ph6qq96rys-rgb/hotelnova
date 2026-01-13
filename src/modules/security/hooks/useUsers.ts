import { useEffect, useState } from "react";

export type UserAssignmentDto = {
  id: string;
  roleId: string;
  roleName: string;
  branchId?: string | null;
  branchName?: string | null;
  permissionCount: number;
};

export type UserDetailDto = {
  id: string;
  email: string;
  fullName: string;
  status: "Active" | "Pending" | "Suspended";
  assignments: UserAssignmentDto[];
};

export function useUser(userId: string) {
  const [user, setUser] = useState<UserDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/identity/users/users/${userId}`, {
          headers: { "Content-Type": "application/json" },
          credentials: "include"
        });

        if (!res.ok) throw new Error(await res.text());

        const data = (await res.json()) as UserDetailDto;
        if (!alive) return;

        setUser(data);
        setError(null);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Failed to load user");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  return {
    user,
    loading,
    error,
    refresh: async () => {
      const res = await fetch(`/api/identity/users/users/users/${userId}`, {
        headers: { "Content-Type": "application/json" },
        credentials: "include"
      });
      if (!res.ok) throw new Error(await res.text());
      setUser((await res.json()) as UserDetailDto);
    }
  };
}

export type UserRowDto = {
  id: string;
  email: string;
  fullName: string;
  status: "Active" | "Pending" | "Suspended";
};

async function fetchUsers(): Promise<UserRowDto[]> {
  const res = await fetch("/api/identity/users/users", {
    headers: { "Content-Type": "application/json" },
    credentials: "include"
  });

  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

export function useUsers() {
  const [users, setUsers] = useState<UserRowDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const data = await fetchUsers();
        if (!alive) return;
        setUsers(data);
        setError(null);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Failed to load users");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return {
    users,
    loading,
    error,
    refresh: async () => setUsers(await fetchUsers())
  };
}
