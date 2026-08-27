import type { Page } from "@playwright/test";

export const TEST_COMPANY_ID = "c76834e2-1b3b-4794-9ff8-272c825c4f17";
export const TEST_BRANCH_ID = "branch-qae-main";

const AUTH_KEY = "restaurantfnb.auth.v2";
const SCOPE_KEY = "rfnb.scope.v3";

function base64Url(value: string): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function createTestJwt(): string {
  const header = base64Url(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      sub: "qae-user",
      email: "qae@hotelnova.local",
      name: "QAE Automation",
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
      roles: ["COMPANYADMIN"],
      permissions: [
        "dashboard.view",
        "menu.view",
        "recipes.view",
        "production.view",
        "pos.sell",
        "pos.view",
        "sales.view",
        "reports.view",
        "hr.view",
        "hr.attendance.view",
        "hr.overtime.view",
      ],
      company_id: TEST_COMPANY_ID,
      branch_id: TEST_BRANCH_ID,
    })
  );

  return `${header}.${payload}.`;
}

export async function seedWorkspaceAuth(page: Page): Promise<void> {
  const accessToken = createTestJwt();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const auth = {
    user: {
      id: "qae-user",
      email: "qae@hotelnova.local",
      fullName: "QAE Automation",
      companyId: TEST_COMPANY_ID,
    },
    accessToken,
    refreshToken: "qae-refresh-token",
    expiresAt,
    permissions: [
      "dashboard.view",
      "menu.view",
      "recipes.view",
      "production.view",
      "pos.sell",
      "pos.view",
    "sales.view",
    "reports.view",
    "hr.view",
    "hr.attendance.view",
    "hr.overtime.view",
  ],
    roles: ["COMPANYADMIN"],
    companyId: TEST_COMPANY_ID,
    companyName: "Hotel Nova QAE",
    tenantSlug: "hotelnova-qae",
    branchId: TEST_BRANCH_ID,
    branchName: "Main Branch",
    sessionOnly: false,
  };
  const scope = {
    mode: "tenant",
    companyId: TEST_COMPANY_ID,
    companyName: "Hotel Nova QAE",
    tenantSlug: "hotelnova-qae",
    branchId: TEST_BRANCH_ID,
    branchName: "Main Branch",
    storeId: null,
    storeName: null,
    stockLocationId: null,
    stockLocationName: null,
  };

  await page.addInitScript(
    ({ authKey, scopeKey, authValue, scopeValue }) => {
      window.localStorage.setItem(authKey, JSON.stringify(authValue));
      window.localStorage.setItem(scopeKey, JSON.stringify(scopeValue));
      window.localStorage.setItem("companyId", authValue.companyId);
      window.localStorage.setItem("branchId", authValue.branchId);
      window.sessionStorage.setItem("companyId", authValue.companyId);
      window.sessionStorage.setItem("branchId", authValue.branchId);
    },
    { authKey: AUTH_KEY, scopeKey: SCOPE_KEY, authValue: auth, scopeValue: scope }
  );
}
