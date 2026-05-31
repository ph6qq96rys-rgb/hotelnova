// src/api/dashboard/dashboardApi.ts

import { http } from "../http";
import type { DashboardOverviewDto } from "./dashboardTypes";

export async function getDashboardOverview(): Promise<DashboardOverviewDto> {
  const { data } = await http.get<DashboardOverviewDto>("/dashboard/overview");
  return data;
}