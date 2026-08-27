import { useCallback, useState } from "react";
import { securityApi } from "../api/securityApi";
import type {
  CreateSecurityUserRequest,
  UpdateSecurityUserRequest,
  UserDto,
} from "../api/securityApi";
import { extractSecurityError } from "../utils/security.utils";
import {
  buildCreatePayload,
  buildUpdatePayload,
} from "../utils/userManagement.utils";

export function useUserActions(
  companyId: string,
  branchId: string | null | undefined,
) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <T,>(operation: () => Promise<T>, fallback: string): Promise<T> => {
    setBusy(true);
    setError(null);
    try {
      return await operation();
    } catch (requestError) {
      const message = extractSecurityError(requestError, fallback);
      setError(message);
      throw new Error(message);
    } finally {
      setBusy(false);
    }
  }, []);

  const create = useCallback(
    async (request: CreateSecurityUserRequest): Promise<UserDto> =>
      run(async () => {
        if (!companyId) throw new Error("Company context is missing.");
        const payload = buildCreatePayload(request, branchId);
        const created = await securityApi.createUser(companyId, payload);
        if (!created?.id) throw new Error("User was created, but the API did not return a user id.");
        return created;
      }, "Failed to create user."),
    [branchId, companyId, run],
  );

  const update = useCallback(
    async (userId: string, request: UpdateSecurityUserRequest): Promise<UserDto> =>
      run(async () => {
        if (!companyId) throw new Error("Company context is missing.");
        const payload = buildUpdatePayload(request, branchId);
        return await securityApi.updateUser(companyId, userId, payload);
      }, "Failed to update user."),
    [branchId, companyId, run],
  );

  const setActive = useCallback(
    (user: UserDto) => run(async () => {
      if (!companyId) throw new Error("Company context is missing.");
      await securityApi.setUserActive(companyId, user.id, !user.isActive);
    }, "Failed to update user status."),
    [companyId, run],
  );

  const resetPassword = useCallback(
    (userId: string, password: string) => run(async () => {
      if (!companyId) throw new Error("Company context is missing.");
      await securityApi.resetUserPassword(companyId, userId, password);
    }, "Failed to reset password."),
    [companyId, run],
  );

  const linkEmployee = useCallback(
    (userId: string, employeeId: string) => run(async () => {
      if (!companyId) throw new Error("Company context is missing.");
      await securityApi.linkUserEmployee(companyId, userId, employeeId);
    }, "Failed to link employee."),
    [companyId, run],
  );

  return { busy, error, setError, create, update, setActive, resetPassword, linkEmployee };
}
