import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import "./styles/global.css";
import "./styles/design-system.css";

const StaffApp = lazy(() => import("./app/StaffApp"));
const PublicMenuPage = lazy(() => import("./features/public-menu/PublicMenuPage"));

function Application() {
  const location = useLocation();
  // QR visitors neither load staff modules nor initialize staff authentication.
  return <Suspense fallback={<p role="status" style={{padding:32}}>Loading… / በመጫን ላይ…</p>}>
    {location.pathname === "/menu" || location.pathname.startsWith("/menu/") ?
      <Routes><Route path="/menu/:companyId/:branchId/:token" element={<PublicMenuPage />} /><Route path="*" element={<PublicMenuPage />} /></Routes> :
      <StaffApp />}
  </Suspense>;
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode><BrowserRouter><Application /></BrowserRouter></React.StrictMode>
);
