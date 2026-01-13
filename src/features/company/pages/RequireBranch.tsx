import React, { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppContext } from "../../../app/AppContext";
import { safeReturnUrl } from "../../../auth/returnUrl";
export default function RequireBranch({ children }: { children: React.ReactNode }) {
  const { companyId, branchId } = useAppContext();
  const nav = useNavigate();
  const loc = useLocation();
  const redirected = useRef(false);

  useEffect(() => {
    if (redirected.current) return;
    if (!companyId) return;
    if (loc.pathname.startsWith("/setup/branch")) return;

    if (!branchId) {
      redirected.current = true;
      const ret = safeReturnUrl(loc.pathname + loc.search, "/dashboard");
      nav(`/setup/branch?returnUrl=${encodeURIComponent(ret)}`, { replace: true });
    }
  }, [companyId, branchId, nav, loc.pathname, loc.search]);

  if (!branchId && !loc.pathname.startsWith("/setup/branch")) return null;
  return <>{children}</>;
}
