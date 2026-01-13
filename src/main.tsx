import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import { AuthProvider } from "./auth/AuthProvider";
import { AppProvider } from "./app/AppContext";
import AppRoutes from "./routes/AppRoutes";
//import AuthCompanyGuard from "./app/AuthCompanyGuard"

import "./index.css";
import "./styles/admin.css";
import "./styles/inventory-master.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <AppRoutes />
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
