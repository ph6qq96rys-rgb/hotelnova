import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { isNullOrEmpty, clearAuthStorage } from "../utils/authUtils";

type Props = {
  children: React.ReactNode;
};

export default function AuthCompanyGuard({ children }: Props) {
  const navigate = useNavigate();

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    const companyId = localStorage.getItem("companyId");

    if (isNullOrEmpty(userId) || isNullOrEmpty(companyId)) {
      console.warn("Invalid session. Logging out.");

      clearAuthStorage();

      navigate("/login", { replace: true });
    }
  }, [navigate]);

  return <>{children}</>;
}
