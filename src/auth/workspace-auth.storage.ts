export type WorkspaceAuth = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
  companyId: string;
  companyName: string;
  tenantSlug: string;
  branchId: string | null;
  branchName: string | null;
  roles: string[];
  permissions: string[];
};

const WORKSPACE_AUTH_KEY = "restaurantfnb.workspaceAuth";

export function loadWorkspaceAuth(): WorkspaceAuth | null {
  const raw = sessionStorage.getItem(WORKSPACE_AUTH_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as WorkspaceAuth;
  } catch {
    sessionStorage.removeItem(WORKSPACE_AUTH_KEY);
    return null;
  }
}

export function saveWorkspaceAuth(auth: WorkspaceAuth): void {
  // Delegated/impersonation sessions should normally be tab-scoped.
  sessionStorage.setItem(WORKSPACE_AUTH_KEY, JSON.stringify(auth));
}

export function clearWorkspaceAuth(): void {
  sessionStorage.removeItem(WORKSPACE_AUTH_KEY);
}
