// src/modules/security/api/userAssignmentsApi.ts
// Branch-scoped role assignment mutations.

import { http } from "../../../api/http";
import type { AddAssignmentRequest, RemoveAssignmentRequest } from "../types/security.types";

const base = (cid: string) => `/companies/${cid}/security`;

export function addUserRoleAssignment(cid: string, body: AddAssignmentRequest): Promise<void> {
  const { userId, roleId, branchId } = body;
  return http
    .post(`${base(cid)}/roles/${encodeURIComponent(roleId)}/users`, { userId, branchId: branchId ?? null })
    .then(() => undefined);
}

// FIX: was missing /users/ segment — URL was /security/{userId}/assignments/...
// Correct URL: /security/users/{userId}/assignments/{assignmentId}
export function removeUserRoleAssignment(cid: string, body: RemoveAssignmentRequest): Promise<void> {
  const { userId, assignmentId } = body;
  return http
    .delete(`${base(cid)}/users/${encodeURIComponent(userId)}/assignments/${encodeURIComponent(assignmentId)}`)
    .then(() => undefined);
}