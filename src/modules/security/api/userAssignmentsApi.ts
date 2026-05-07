// src/modules/security/api/userAssignmentsApi.ts
import { http } from "../../../api/http";

const base = (companyId: string) => `/companies/${companyId}/security`;

export function addUserRoleAssignment(
  companyId: string,
  body: {
    userId: string;
    roleId: string;
    branchId?: string | null;
  }
): Promise<void> {
  const { userId, roleId, branchId } = body;
  return http.post(`${base(companyId)}/roles/${roleId}/users`, {
    userId,
    roleId,
    branchId: branchId ?? null,
  });
}

export function removeUserRoleAssignment(
  companyId: string,
  body: {
    userId: string;
    assignmentId: string;
  }
): Promise<void> {
  const { userId, assignmentId } = body;
  return http.delete(`${base(companyId)}/${userId}/assignments/${assignmentId}`);
}
