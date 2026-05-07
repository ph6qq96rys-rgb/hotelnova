import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import ForgotPasswordPage from "../pages/ForgotPasswordPage";
import ResetPasswordPage from "../pages/ResetPasswordPage";
import RolesPermissionsPage from "../features/security/pages/RolesPermissionsPage";

import type { RouteObject } from "react-router-dom";
import type { ReactNode } from "react";

export type AppRoute = RouteObject & {
  path?: string;              // absolute path: "/users"
  label?: string;             // sidebar label
  element?: ReactNode;        // route element
  icon?: ReactNode;          // sidebar icon
  nav?: boolean;             // show in sidebar?
  section?: string;          // sidebar grouping header
  roles?: string[];          // optional RBAC
  permissions?: string[];    // optional PBAC
   menu?: {
    label: string;
    icon?: ReactNode;
    permission?: string;   // e.g. "users.view"
    section?: string;      // optional grouping in sidebar
  };
};
export const authRoutes: AppRoute[] = [
    {
        path: "/login",
        element: <LoginPage />,
        label: "Login",
        nav: true,
    },
    {
        path: "/register",
        element: <RegisterPage />,
        label: "Register",
        nav: true,
    },
    {
        path: "/forgot-password",
        element: <ForgotPasswordPage />,
        label: "Forgot Password",
        nav: true,
    },
    {
        path: "/reset-password",
        element: <ResetPasswordPage />,
        label: "Reset Password",
        nav: false,
    },
    {
        path: "/roles-permission",
        element: <RolesPermissionsPage />,
        label: "Roles & Permissions",
        nav: true,
    }
];