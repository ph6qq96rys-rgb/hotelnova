// src/routes/inventoryPaths.ts

export type InventoryRouteScope = {
  companyId: string;
  branchId?: string | null;
};

function enc(value: string): string {
  return encodeURIComponent(value);
}

export function inventoryBasePath(scope: InventoryRouteScope): string {
  const companyId = enc(scope.companyId);

  if (scope.branchId) {
    return `/companies/${companyId}/branches/${enc(scope.branchId)}`;
  }

  return `/companies/${companyId}`;
}

export function grnPath(scope: InventoryRouteScope): string {
  return `${inventoryBasePath(scope)}/grns`;
}

export function grnDraftsPath(scope: InventoryRouteScope): string {
  return `${grnPath(scope)}/drafts`;
}

export function newGrnDraftPath(scope: InventoryRouteScope): string {
  return `${grnDraftsPath(scope)}/new`;
}

export function editGrnDraftPath(
  scope: InventoryRouteScope,
  draftId: string,
): string {
  return `${grnDraftsPath(scope)}/${enc(draftId)}`;
}

export function grnDetailPath(
  scope: InventoryRouteScope,
  grnId: string,
): string {
  return `${grnPath(scope)}/${enc(grnId)}`;
}

export function sivPath(scope: InventoryRouteScope): string {
  return `${inventoryBasePath(scope)}/siv`;
}

export function newSivDraftPath(scope: InventoryRouteScope): string {
  return `${sivPath(scope)}/drafts/new`;
}

export function editSivDraftPath(
  scope: InventoryRouteScope,
  draftId: string,
): string {
  return `${sivPath(scope)}/drafts/${enc(draftId)}`;
}

export function sivDetailPath(
  scope: InventoryRouteScope,
  sivId: string,
): string {
  return `${sivPath(scope)}/${enc(sivId)}`;
}