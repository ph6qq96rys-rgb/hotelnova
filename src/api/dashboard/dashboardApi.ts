import { http } from "../http"; // adjust path if yours differs
import type { DashboardOverviewDto } from "./dashboardTypes";

export async function getDashboardOverview(): Promise<DashboardOverviewDto> {
  // If your apiClient baseURL already includes /api, keep this:
  // /dashboard/overview
  // If baseURL is http://localhost:7216 (no /api), use: /api/dashboard/overview
  const {data} = await http.get<DashboardOverviewDto>("/dashboard/overview");
  return data;
}
