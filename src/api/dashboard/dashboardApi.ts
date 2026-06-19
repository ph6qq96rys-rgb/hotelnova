import { http } from "../http";
import type { DashboardOverviewDto } from "./dashboardTypes";

const DASHBOARD_BASE = "/dashboard";

export async function getDashboardOverview(
  signal?: AbortSignal
): Promise<DashboardOverviewDto> {
  const { data } = await http.get<DashboardOverviewDto>(
    `${DASHBOARD_BASE}/overview`,
    { signal }
  );

  return data;
}