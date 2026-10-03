import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { Building2 } from "lucide-react";

import { useAppContext } from "../app/AppContext";
import { useAuth } from "../auth/AuthProvider";
import { loadWorkspaceAuth } from "../auth/workspace-auth.storage";
import {
  hasCompanyAdminRole,
  hasSystemAdminRole,
  normalizeRole,
} from "../auth/erpAccess";
import { branchesApi } from "../features/company/api/branchesApi";
import type { BranchDto } from "../features/company/types/company.types";

const HQ_BRANCH_ROLES = new Set([
  "FBCONTROLLER",
  "FNBCONTROLLER",
  "FOODBEVERAGECONTROLLER",
  "FINANCE",
  "FINANCEMANAGER",
  "GENERALMANAGER",
  "GM",
]);

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function branchLabel(branch: BranchDto | null | undefined): string {
  if (!branch) return "";

  return clean(branch.name) || clean(branch.code) || "Branch";
}

function hasHqRole(roles: string[]): boolean {
  return roles.some((role) => HQ_BRANCH_ROLES.has(normalizeRole(role)));
}

function sameId(left: string | null | undefined, right: string | null | undefined): boolean {
  return clean(left).toLowerCase() === clean(right).toLowerCase();
}

export function ScopeSwitcher() {
  const scope = useAppContext();
  const { auth, user, roles } = useAuth();
  const workspace = loadWorkspaceAuth();
  const [branches, setBranches] = useState<BranchDto[]>([]);
  const [loading, setLoading] = useState(false);
  const activeBranchId = clean(scope.branchId);
  const setBranch = scope.setBranch;

  const effectiveRoles = workspace?.roles?.length ? workspace.roles : roles;
  const companyId = clean(scope.companyId) || clean(workspace?.companyId) || clean(auth?.companyId) || clean(user?.companyId);
  const companyName =
    clean(scope.companyName) || clean(workspace?.companyName) || clean(auth?.companyName) || "Company profile";
  const assignedBranchId = clean(workspace?.branchId) || clean(auth?.branchId) || clean(user?.branchId);
  const assignedBranchName =
    clean(workspace?.branchName) || clean(auth?.branchName) || clean(scope.branchName) || "Assigned branch";

  useEffect(() => {
    let alive = true;

    if (!companyId) {
      setBranches([]);
      return undefined;
    }

    setLoading(true);

    branchesApi
      .list(companyId, { activeOnly: true, pageSize: 250 })
      .then((items) => {
        if (alive) setBranches(items);
      })
      .catch(() => {
        if (alive) setBranches([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [companyId]);

  const assignedBranch = useMemo(
    () => branches.find((branch) => sameId(branch.id, assignedBranchId)) ?? null,
    [assignedBranchId, branches],
  );


  const canSwitchBranch = Boolean(
    auth?.isCompanyScoped ||
      hasSystemAdminRole(effectiveRoles) ||
      hasCompanyAdminRole(effectiveRoles) ||
      (assignedBranch?.isMain && hasHqRole(effectiveRoles)) ||
      (!assignedBranchId && branches.length > 0),
  );

  useEffect(() => {
    if (!companyId || loading || !branches.length) return;

    if (!canSwitchBranch && assignedBranchId && !activeBranchId) {
      setBranch({
        id: assignedBranchId,
        name: branchLabel(assignedBranch) || assignedBranchName,
      });
      return;
    }

  }, [
    activeBranchId,
    loading,
    branches.length,
    assignedBranch,
    assignedBranchId,
    assignedBranchName,
    canSwitchBranch,
    companyId,
    setBranch,
  ]);

  if (!companyId) return null;

  const selectedBranchId = canSwitchBranch ? activeBranchId : activeBranchId || assignedBranchId;
  const selectedBranch = selectedBranchId
    ? branches.find((branch) => sameId(branch.id, selectedBranchId)) ?? assignedBranch
    : null;
  const branchSelectValue = branches.some((branch) => sameId(branch.id, selectedBranchId))
    ? selectedBranchId
    : "";
  const branchName =
    branchLabel(selectedBranch) ||
    clean(scope.branchName) ||
    assignedBranchName ||
    (loading ? "Loading branches..." : "No branch selected");

  function handleBranchChange(event: ChangeEvent<HTMLSelectElement>) {
    const branchId = event.target.value;
    const branch = branches.find((item) => sameId(item.id, branchId));

    void scope.requestBranchChange({
      id: branchId || null,
      name: branchLabel(branch),
    });
  }

  return (
    <div className="hna-scope" title={`${companyName} - ${branchName}`}>
      <Building2 size={16} strokeWidth={2} aria-hidden="true" />
      <div className="hna-scope__text">
        <span className="hna-scope__company">{companyName}</span>
        {canSwitchBranch ? (
          <select
            className="hna-scope__select"
            value={branchSelectValue}
            onChange={handleBranchChange}
            aria-label="Active branch"
            disabled={loading || branches.length === 0}
          >
            {branches.length === 0 ? (
              <option value="">{loading ? "Loading branches..." : "No active branches"}</option>
            ) : (
              <>
                <option value="">Select branch</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branchLabel(branch)}
                    {branch.isMain ? " (HQ)" : ""}
                  </option>
                ))}
              </>
            )}
          </select>
        ) : (
          <span className="hna-scope__branch">{branchName}</span>
        )}
      </div>
    </div>
  );
}
