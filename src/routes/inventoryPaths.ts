// src/routes/inventoryPaths.ts

export type InventoryRouteScope = {
  companyId: string;
  branchId?: string | null;
};

function enc(value: string): string {
  return encodeURIComponent(value);
}

function requireCompanyId(scope: InventoryRouteScope): string {
  if (!scope.companyId?.trim()) {
    throw new Error("companyId is required to build inventory route.");
  }

  return enc(scope.companyId.trim());
}

/**
 * Frontend routes are company-scoped.
 * Branch is API/filter context, not part of the URL unless AppRoutes registers:
 * /companies/:companyId/branches/:branchId/...
 */
export function inventoryBasePath(scope: InventoryRouteScope): string {
  return `/companies/${requireCompanyId(scope)}`;
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
  draftId: string
): string {
  return `${grnDraftsPath(scope)}/${enc(draftId)}`;
}

export function grnDetailPath(
  scope: InventoryRouteScope,
  grnId: string
): string {
  return `${grnPath(scope)}/${enc(grnId)}`;
}

export function sivPath(scope: InventoryRouteScope): string {
  return `${inventoryBasePath(scope)}/siv`;
}

export function sivDraftsPath(scope: InventoryRouteScope): string {
  return `${sivPath(scope)}/drafts`;
}

export function newSivDraftPath(scope: InventoryRouteScope): string {
  return `${sivDraftsPath(scope)}/new`;
}

export function editSivDraftPath(
  scope: InventoryRouteScope,
  draftId: string
): string {
  return `${sivDraftsPath(scope)}/${enc(draftId)}`;
}

export function sivDetailPath(
  scope: InventoryRouteScope,
  sivId: string
): string {
  return `${sivPath(scope)}/${enc(sivId)}`;
}

export function inventoryMasterPath(scope: InventoryRouteScope): string {
  return `${inventoryBasePath(scope)}/inventory-master`;
}

export function inventoryItemsPath(scope: InventoryRouteScope): string {
  return `${inventoryMasterPath(scope)}/items`;
}

export function newInventoryItemPath(scope: InventoryRouteScope): string {
  return `${inventoryItemsPath(scope)}/new`;
}

export function editInventoryItemPath(
  scope: InventoryRouteScope,
  itemId: string
): string {
  return `${inventoryItemsPath(scope)}/${enc(itemId)}/edit`;
}

export function importInventoryItemsPath(scope: InventoryRouteScope): string {
  return `${inventoryItemsPath(scope)}/import`;
}

export function inventoryLedgerPath(scope: InventoryRouteScope): string {
  return `${inventoryMasterPath(scope)}/ledger`;
}