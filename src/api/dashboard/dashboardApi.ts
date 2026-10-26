import { http } from "../http";
import type { DashboardOverviewDto } from "./dashboardTypes";

const DASHBOARD_BASE = "/dashboard";

/**
 * The company dashboard. With a branch it covers that branch; without one, company administrators get the
 * whole company and everyone else their own branch. Sections the user may not see come back empty.
 */
export async function getDashboardOverview(
  branchId?: string | null,
  signal?: AbortSignal
): Promise<DashboardOverviewDto> {
  const { data } = await http.get<DashboardOverviewDto>(`${DASHBOARD_BASE}/overview`, {
    params: branchId ? { branchId } : undefined,
    signal,
  });

  return data;
}
