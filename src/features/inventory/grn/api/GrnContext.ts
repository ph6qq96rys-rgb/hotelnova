export interface GrnContext {
    companyId: string;
    branchId?: string | null;
}

export function createGrnContext(
    companyId?: string | null,
    branchId?: string | null,
): GrnContext {
    if (!companyId?.trim()) {
        throw new Error("Company context is required.");
    }

    return {
        companyId: companyId.trim(),
        branchId: branchId?.trim() || null,
    };
}