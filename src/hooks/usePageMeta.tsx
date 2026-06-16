export type PageCrumb = {
  label: string;
  to?: string;
};

export type PageMeta = {
  title: string;
  subtitle?: string;
  crumbs?: PageCrumb[];
};

const ROUTE_META: Record<string, PageMeta> = {
  "/": {
    title: "Dashboard",
    subtitle: "Operational overview",
    crumbs: [{ label: "Dashboard", to: "/" }],
  },

  "/dashboard": {
    title: "Dashboard",
    subtitle: "Operational overview",
    crumbs: [{ label: "Dashboard", to: "/dashboard" }],
  },

  "/security/users": {
    title: "User Administration",
    subtitle: "Employee-linked ERP user provisioning",
    crumbs: [
      { label: "Security" },
      { label: "Users", to: "/security/users" },
    ],
  },

  "/security/roles-permissions": {
    title: "Security Administration",
    subtitle: "Roles, permissions, users, and access governance",
    crumbs: [
      { label: "Security" },
      { label: "Roles & Permissions", to: "/security/roles-permissions" },
    ],
  },

  "/settings": {
    title: "Settings",
    subtitle: "System configuration and controls",
    crumbs: [{ label: "Settings", to: "/settings" }],
  },
};

function matchDynamicRoute(pathname: string): PageMeta | null {
  if (/^\/companies\/[^/]+\/security\/users\/[^/]+$/.test(pathname)) {
    return {
      title: "User Detail",
      subtitle: "Identity profile and access assignments",
      crumbs: [
        { label: "Security" },
        { label: "Users", to: "/security/users" },
        { label: "User Detail" },
      ],
    };
  }

  return null;
}

export function getPageMeta(pathname: string): PageMeta {
  return (
    ROUTE_META[pathname] ??
    matchDynamicRoute(pathname) ??
    {
      title: "Dashboard",
      subtitle: "RestaurantFNB ERP workspace",
      crumbs: [],
    }
  );
}

export function usePageMeta(pathname: string): PageMeta {
  return getPageMeta(pathname);
}