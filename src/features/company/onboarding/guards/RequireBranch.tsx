import type React from "react";
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppContext } from "../../../../app/AppContext";
import { safeReturnUrl } from "../../../../auth/returnUrl";

export function RequireBranch({ children }: { children: React.ReactNode }) {
  const { companyId, branchId } = useAppContext();
  const nav = useNavigate();
  const loc = useLocation();
  const redirected = useRef(false);
  useEffect(() => {
    if (redirected.current || !companyId) return;
    if (loc.pathname.includes("/onboarding")) return;
    if (!branchId) {
      redirected.current = true;
      const ret = safeReturnUrl(loc.pathname + loc.search, "/dashboard");
      nav(`/companies/${companyId}/onboarding?returnUrl=${encodeURIComponent(ret)}`, { replace: true });
    }
  }, [companyId, branchId, nav, loc.pathname, loc.search]);
  if (!branchId && !loc.pathname.includes("/onboarding")) return null;
  return <>{children}</>;
}