import { isValidElement, type ReactNode } from "react";
import RequirePermission from "./RequirePermission";
import RequireErpRole from "./RequireErpRole";
import { canAccessRoute, hasAllErpPermissions, hasAnyErpPermission, hasAnyErpRole, type AccessIdentity } from "./erpAccess";
import type { AppRouteLike } from "../routes/routeDefConfig";

// Route metadata and explicit element guards both apply to a destination.
function canAccessElement(identity: AccessIdentity, element: ReactNode): boolean {
  if (!isValidElement<{ permission?: string; permissions?: string[]; mode?: string; roles?: string[]; children?: ReactNode }>(element)) return true;
  const props = element.props;
  if (element.type === RequirePermission) {
    const permissions = props.permissions ?? (props.permission ? [props.permission] : []);
    if (!(props.mode === "any" ? hasAnyErpPermission(identity, permissions) : hasAllErpPermissions(identity, permissions))) return false;
  } else if (element.type === RequireErpRole) {
    if (!hasAnyErpRole(identity, props.roles)) return false;
  } else {
    return true;
  }
  return canAccessElement(identity, props.children);
}

export function canAccessNavigationRoute(identity: AccessIdentity, route: AppRouteLike): boolean {
  return !route.hidden && canAccessRoute(identity, route) && canAccessElement(identity, route.element)
    && (route.accessParents ?? []).every(parent => canAccessRoute(identity, parent) && canAccessElement(identity, parent.element));
}

// Query-string shortcuts can require more access than their containing page.
export function canAccessCateringShortcut(identity: AccessIdentity, target: string): boolean {
  const [module, query] = target.split("?");
  const params = new URLSearchParams(query);
  const required = module === "command" || module === "sales" ? ["catering.view"]
    : module === "butchery" ? ["butchery.view"] : [];
  if (params.get("new") === "1") required.push("catering.manage");
  return hasAllErpPermissions(identity, required);
}
