// src/modules/security/api/securityApi.ts
export type RoleDto = {
  id: string;
  name: string;
  description?: string | null;
  userCount: number;
  isSystem: boolean;
};

export type UserLiteDto = {
  id: string;
  email: string;
  fullName?: string | null;
};

export type RoleDetailDto = {
  role: RoleDto;
  permissionKeys: string[];
  users: UserLiteDto[];
};

// ⬇️ Replace with your existing fetch/axios wrapper if you have one.
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    credentials: "include", // if you use cookies; remove if JWT-only
    ...init
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  // NoContent
  if (res.status === 204) return undefined as unknown as T;

  return (await res.json()) as T;
}

export const securityApi = {
  // Roles
  listRoles: () => request<RoleDto[]>("/api/security/roles"), // GET :contentReference[oaicite:1]{index=1}
  getRole: (roleId: string) =>
    request<RoleDetailDto>(`/api/security/roles/${roleId}`), // GET :contentReference[oaicite:2]{index=2}

  createRole: (payload: { name: string; description?: string | null }) =>
    request<string>("/api/security/roles", {
      method: "POST",
      body: JSON.stringify(payload)
    }), // POST :contentReference[oaicite:3]{index=3}

  updateRole: (roleId: string, payload: { name: string; description?: string | null }) =>
    request<void>(`/api/security/roles/${roleId}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    }), // PUT :contentReference[oaicite:4]{index=4}

  deleteRole: (roleId: string) =>
    request<void>(`/api/security/roles/${roleId}`, { method: "DELETE" }), // DELETE :contentReference[oaicite:5]{index=5}

  // Permissions catalog
  listPermissions: () => request<Array<{ key: string; group: string; description: string }>>(
    "/api/security/permissions"
  ), // GET :contentReference[oaicite:6]{index=6}

  // Role permissions assignment
  setRolePermissions: (roleId: string, permissionKeys: string[]) =>
    request<void>(`/api/security/roles/${roleId}/permissions`, {
      method: "PUT",
      body: JSON.stringify({ permissionKeys })
    }), // PUT :contentReference[oaicite:7]{index=7}

  // Users search
  searchUsers: (q: string) =>
    request<UserLiteDto[]>(`/api/security/users/search?q=${encodeURIComponent(q)}`), // GET :contentReference[oaicite:8]{index=8}

  // Role membership (existing behavior)
  addUserToRole: (roleId: string, userId: string) =>
    request<void>(`/api/security/roles/${roleId}/users`, {
      method: "POST",
      body: JSON.stringify({ userId })
    }), // POST :contentReference[oaicite:9]{index=9}

  removeUserFromRole: (roleId: string, userId: string) =>
    request<void>(`/api/security/roles/${roleId}/users/${userId}`, { method: "DELETE" }) // DELETE :contentReference[oaicite:10]{index=10}
};
