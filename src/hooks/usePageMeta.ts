import { useMemo } from "react";
import { matchPath } from "react-router-dom";

type Crumb = { label: string; to?: string };

export type PageMeta = {
  title: string;
  subtitle?: string;
  crumbs?: Crumb[];
};

type PageMetaInput = string | PageMeta;

export function usePageMeta(input: PageMetaInput) {
  return useMemo(() => {
    // If caller passed an override object, return it (with defaults)
    if (typeof input !== "string") {
      return {
        title: input.title,
        subtitle: input.subtitle ?? "",
        crumbs: input.crumbs ?? [{ label: input.title }],
      };
    }

    const pathname = input;

    // Defaults
    let title = "HotelNova Admin";
    let subtitle = "Administration console";
    let crumbs: Crumb[] = [{ label: "Dashboard", to: "/dashboard" }];

    if (pathname === "/" || pathname === "/dashboard") {
      title = "Dashboard";
      subtitle = "Overview & quick actions";
      crumbs = [{ label: "Dashboard" }];
      return { title, subtitle, crumbs };
    }

    if (pathname.startsWith("/users")) {
      title = "Users";
      subtitle = "Manage accounts, status, and profiles";
      crumbs.push({ label: "Users" });
      return { title, subtitle, crumbs };
    }

    if (pathname.startsWith("/roles") || pathname.startsWith("/roles-permissions")) {
      title = "Roles & Permissions";
      subtitle = "Role management & access control";
      crumbs.push({ label: "Roles & Permissions", to: "/roles-permissions" });
      return { title, subtitle, crumbs };
    }

    if (pathname.startsWith("/inventory-master")) {
      title = "Inventory";
      subtitle = "Master data setup";
      crumbs.push({ label: "Inventory", to: "/inventory-master" });

      if (matchPath("/inventory-master/uoms", pathname)) crumbs.push({ label: "Units of Measure" });
      else if (matchPath("/inventory-master/items", pathname)) crumbs.push({ label: "Items" });
      else if (matchPath("/inventory-master/categories", pathname)) crumbs.push({ label: "Categories" });

      return { title, subtitle, crumbs };
    }

    if (pathname.startsWith("/stock-transfers")) {
      title = "Stock Transfers";
      subtitle = "Warehouse → Store transfers with FIFO costing";
      crumbs.push({ label: "Stock Transfers", to: "/stock-transfers" });

      if (matchPath("/stock-transfers/new", pathname)) crumbs.push({ label: "New" });
      else if (matchPath("/stock-transfers/:id/edit", pathname)) crumbs.push({ label: "Edit" });
      else if (matchPath("/stock-transfers/:id", pathname)) crumbs.push({ label: "Detail" });

      return { title, subtitle, crumbs };
    }

    if (pathname.startsWith("/settings")) {
      title = "Settings";
      subtitle = "System & environment configuration";
      crumbs.push({ label: "Settings" });
      return { title, subtitle, crumbs };
    }

    crumbs.push({ label: title });
    return { title, subtitle, crumbs };
  }, [input]);
}
