import { useEffect, useMemo, useState } from "react";
import { usersApi } from "../api/usersApi";
import type { PagedResult, UserDto, UserFilter } from "../types";

export function useUsers(initial: UserFilter = { page: 1, pageSize: 10 }) {
  const [filter, setFilter] = useState<UserFilter>(initial);
  const [data, setData] = useState<PagedResult<UserDto> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await usersApi.list(filter);
      setData(res.data);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [JSON.stringify(filter)]);

  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 10;

  const canPrev = useMemo(() => page > 1, [page]);
  const canNext = useMemo(() => (data ? page * pageSize < data.total : false), [data, page, pageSize]);

  return {
    filter, setFilter,
    data, loading, error,
    refresh,
    canPrev, canNext,
  };
}
