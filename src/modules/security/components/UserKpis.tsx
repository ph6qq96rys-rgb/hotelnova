import { useMemo } from "react";
import type { UserDto } from "../api/securityApi";
import { employeeIdOf, isCompanyAdmin, isSystemAdmin } from "../utils/userManagement.utils";

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="lux-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function UserKpis({
  items,
  total,
  showSystemAdmins,
}: {
  items: UserDto[];
  total: number;
  showSystemAdmins: boolean;
}) {
  const metrics = useMemo(
    () => ({
      active: items.filter((item) => item.isActive).length,
      disabled: items.filter((item) => !item.isActive).length,
      companyAdmins: items.filter(isCompanyAdmin).length,
      systemAdmins: items.filter(isSystemAdmin).length,
      employeeLinked: items.filter((item) => Boolean(employeeIdOf(item))).length,
    }),
    [items],
  );

  return (
    <div className="lux-kpis">
      <KpiCard label="Users" value={total} />
      <KpiCard label="Active" value={metrics.active} />
      <KpiCard label="Disabled" value={metrics.disabled} />
      <KpiCard label="Company Admins" value={metrics.companyAdmins} />
      <KpiCard label="Employee Linked" value={metrics.employeeLinked} />
      {showSystemAdmins && <KpiCard label="System Admins" value={metrics.systemAdmins} />}
    </div>
  );
}
