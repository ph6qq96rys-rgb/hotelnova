import { useParams } from "react-router-dom";
export  function useCompanyIdFromRoute(): string {
  const { companyId } = useParams<{ companyId?: string }>();
  return companyId ?? "";
}