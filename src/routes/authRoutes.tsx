
import RolesPermissionsPage from "../modules/security/pages/RolesPermissionsPage";

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
        path: "/roles-permission",
        element: <RolesPermissionsPage />,
        label: "Roles & Permissions",
        nav: true,
    }
];