import { useEffect, useState } from "react";
import { securityApi } from "../api/securityApi";
import type { PagedResult, UserDto } from "../api/securityApi";
import { extractSecurityError } from "../utils/security.utils";
import type { UserFilter } from "../types/userManagement.types";
import { emptyPage } from "../utils/userManagement.utils";

export function useUsersQuery(
  companyId: string,
  filter: UserFilter,
  refreshKey: number,
) {
  const [data, setData] = useState<PagedResult<UserDto>>(() => emptyPage(filter));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setData(emptyPage(filter));
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function load(): Promise<void> {
      setLoading(true);
      setError(null);

      try {
        const result = await securityApi.listUsersPage(
          companyId,
          filter,
          controller.signal,
        );

        if (!controller.signal.aborted) setData(result);
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(extractSecurityError(requestError, "Failed to load users."));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [companyId, filter, refreshKey]);

  return { data, loading, error, setError };
}
