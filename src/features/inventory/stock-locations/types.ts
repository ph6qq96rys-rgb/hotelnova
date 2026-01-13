export type StockLocationType = "Store" | "Warehouse";

export type StockLocationDto = {
  id: string;
  companyId: string;
  branchId?: string | null;

  name: string;
  code?: string | null;
  type: StockLocationType;

  address?: string | null;
  phone?: string | null;

  isActive: boolean;
};

export type StockLocationFilter = {
  companyId: string;
  branchId?: string | null;
  q?: string | null;
  activeOnly?: boolean;
};

export type CreateStockLocationDto = {
  companyId: string;
  branchId?: string | null;

  name: string;
  code?: string | null;
  type: StockLocationType;

  address?: string | null;
  phone?: string | null;

  isActive?: boolean;
};

export type UpdateStockLocationDto = Partial<Omit<CreateStockLocationDto, "companyId">>;
export type BranchDto = { id: string; name: string; code?: string | null; isMain?:boolean | null };
