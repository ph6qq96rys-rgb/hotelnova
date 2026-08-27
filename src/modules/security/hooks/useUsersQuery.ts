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

  function upsertUser(user: UserDto): void {
    if (!user?.id) return;

    setData((current) => {
      const items = current.items ?? [];
      const index = items.findIndex((item) => item.id === user.id);

      if (index >= 0) {
        const nextItems = [...items];
        nextItems[index] = user;
        return { ...current, items: nextItems };
      }

      const pageSize = current.pageSize || filter.pageSize || 20;
      return {
        ...current,
        items: [user, ...items].slice(0, pageSize),
        total: (current.total ?? items.length) + 1,
      };
    });
  }

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

  return { data, loading, error, setError, upsertUser };
}
