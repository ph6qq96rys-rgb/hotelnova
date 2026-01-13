import  type { ReactNode } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useAppScope } from "../app/useAppScope";

type CanProps = {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode; // optional
};

export function Can({ permission, children, fallback = null }: CanProps) {
  const { isAuthenticated, hasPermission } = useAuth();
  const { companyId, branchId } = useAppScope();

  if (!isAuthenticated) return null;

  const allowed = hasPermission(permission, companyId, branchId);

  if (!allowed) return <>{fallback}</>;

  return <>{children}</>;
}
