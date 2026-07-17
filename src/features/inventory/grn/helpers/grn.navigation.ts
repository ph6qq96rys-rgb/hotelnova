export function buildGrnListPath(companyId: string): string {
  return `/companies/${encodeURIComponent(companyId)}/grns`;
}

export function buildGrnNewPath(companyId: string): string {
  return `${buildGrnListPath(companyId)}/new`;
}

export function buildGrnDetailPath(companyId: string, grnId: string): string {
  return `${buildGrnListPath(companyId)}/${encodeURIComponent(grnId)}`;
}

export function buildGrnEditPath(companyId: string, grnId: string): string {
  return `${buildGrnDetailPath(companyId, grnId)}/edit`;
}
