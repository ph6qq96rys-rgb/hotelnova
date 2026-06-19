// src/routes/navigation.ts

export function cleanRoutePath(path: string): string {
  return path.trim().replace(/^\/+/, "").replace(/\/+$/, "");
}

export function companyPath(companyId: string, path: string): string {
  const cleanCompanyId = companyId.trim();

  if (!cleanCompanyId) {
    throw new Error("companyId is required for company navigation.");
  }

  const cleanPath = cleanRoutePath(path);

  return cleanPath
    ? `/companies/${cleanCompanyId}/${cleanPath}`
    : `/companies/${cleanCompanyId}/dashboard`;
}

export function isCompanyScopedPath(path: string): boolean {
  return path.startsWith("/companies/");
}

export function toCompanyPath(
  companyId: string,
  path: string
): string {
  if (isCompanyScopedPath(path)) return path;

  return companyPath(companyId, path);
}