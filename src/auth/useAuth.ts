/*import { useContext } from "react";
import { AuthContext } from "./AuthProvider";

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider />");
  return ctx;
}

type UseAuth = {
  isAuthenticated: boolean;
  hasPermission: (
    permission: string,
    companyId?: string,
    branchId?: string | null
  ) => boolean;
};
*/