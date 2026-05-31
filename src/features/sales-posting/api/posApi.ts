// src/features/sales/api/posApi.ts

import { http } from "../../../api/http";

export type MenuCategoryDto = {
  id: string;
  name: string;
  code?: string;
  itemCount: number;
};

export type MenuItemPosDto = {
  id: string;
  name: string;
  code?: string;
  sellingPrice: number;
  cost: number;
  categoryName: string;
};

export type PosSessionDto = {
  id: string;
  cashierName: string;
  terminal: string;
  openingFloat: number;
  closingFloat: number;
  openedAtUtc: string;
  closedAtUtc?: string;
  status: number;
  isZReported: boolean;
};

export type PaymentBreakdown = {
  method: string;
  total: number;
  count: number;
};

export type SessionReportDto = {
  sessionId: string;
  terminal: string;
  cashierName: string;
  openedAtUtc: string;
  closedAtUtc?: string;
  openingFloat: number;
  closingFloat: number;
  isZReported: boolean;
  totalSales: number;
  grossSales: number;
  totalCogs: number;
  grossProfit: number;
  totalDiscount: number;
  totalTax: number;
  paymentBreakdown: PaymentBreakdown[];
};

const base = (companyId: string, branchId: string) =>
  `/companies/${companyId}/branches/${branchId}`;

export const posApi = {
  // Categories
  categories: (companyId: string, branchId: string) =>
    http
      .get<MenuCategoryDto[]>(`${base(companyId, branchId)}/menu-categories`)
      .then((r) => r.data),

  categoryItems: (companyId: string, branchId: string, categoryId: string) =>
    http
      .get<MenuItemPosDto[]>(
        `${base(companyId, branchId)}/menu-categories/${categoryId}/items`
      )
      .then((r) => r.data),

  // Session
  currentSession: (companyId: string, branchId: string) =>
    http
      .get<PosSessionDto | null>(
        `${base(companyId, branchId)}/pos-sessions/current`
      )
      .then((r) => r.data),

  openSession: (
    companyId: string,
    branchId: string,
    payload: { cashierName: string; openingFloat: number; terminal?: string }
  ) =>
    http
      .post<PosSessionDto>(
        `${base(companyId, branchId)}/pos-sessions/open`,
        payload
      )
      .then((r) => r.data),

  closeSession: (
    companyId: string,
    branchId: string,
    sessionId: string,
    closingFloat: number
  ) =>
    http
      .post<PosSessionDto>(
        `${base(companyId, branchId)}/pos-sessions/${sessionId}/close`,
        { closingFloat }
      )
      .then((r) => r.data),

  xReport: (companyId: string, branchId: string, sessionId: string) =>
    http
      .get<SessionReportDto>(
        `${base(companyId, branchId)}/pos-sessions/${sessionId}/x-report`
      )
      .then((r) => r.data),

  zReport: (companyId: string, branchId: string, sessionId: string) =>
    http
      .post<SessionReportDto>(
        `${base(companyId, branchId)}/pos-sessions/${sessionId}/z-report`
      )
      .then((r) => r.data),
};