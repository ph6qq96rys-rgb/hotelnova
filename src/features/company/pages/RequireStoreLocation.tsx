import React, { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppContext } from "../../../app/AppContext";
import { safeReturnUrl } from "../../../auth/returnUrl";

export default function RequireStoreLocation({ children }: { children: React.ReactNode }) {
  const { companyId, branchId, storeId, stockLocationId } = useAppContext();
  const nav = useNavigate();
  const loc = useLocation();
  const redirected = useRef(false);

  useEffect(() => {
    if (redirected.current) return;
    if (!companyId || !branchId) return;

    if (loc.pathname.startsWith("/setup/store-location")) return;

    if (!storeId || !stockLocationId) {
      redirected.current = true;
      const ret = safeReturnUrl(loc.pathname + loc.search, "/dashboard");
      nav(`/setup/store-location?returnUrl=${encodeURIComponent(ret)}`, { replace: true });
    }
  }, [companyId, branchId, storeId, stockLocationId, nav, loc.pathname, loc.search]);

  if ((!storeId || !stockLocationId) && !loc.pathname.startsWith("/setup/store-location")) return null;
  return <>{children}</>;
}
