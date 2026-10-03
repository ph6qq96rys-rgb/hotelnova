import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../auth/AuthProvider";
import { AppProvider } from "./AppContext";
import { I18nProvider } from "../i18n";
import AppRoutes from "../routes/AppRoutes";
// Authentication pages share these layout rules with the security workspace.
// Keep them in the staff entry bundle when individual routes are loaded lazily.
import "../modules/security/pages/security.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false } },
});
export default function StaffApp() {
  return <QueryClientProvider client={queryClient}><AuthProvider><I18nProvider><AppProvider><AppRoutes /></AppProvider></I18nProvider></AuthProvider></QueryClientProvider>;
}
