import { http } from "../../../api/http";
import type { PermissionDto, RoleUserDto, AssignRoleRequest } from "../../../api/identity/identityTypes";

// Endpoints (as provided)
export async function getPermissions(): Promise<PermissionDto[]> {
  const {data} = await http.get<PermissionDto[]>("/identity/Permissions");
  return data;
}

export async function getRoleUsers(): Promise<RoleUserDto[]> {
  const {data} = await http.get<RoleUserDto[]>("/Roles/users");
  return data;
}

export async function assignRole(body: AssignRoleRequest): Promise<void> {
  await http.post("/Roles/assign", body);
}
