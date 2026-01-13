export type StockLocationDto = {
  id: string;
  companyId: string;
  branchId?: string | null;
  name: string;
  code?: string | null;
  address?: string | null;
  phone?: string | null;
  isWarehouse: boolean;
  isActive: boolean;
};

export type StockLocationFilter = {
  companyId?: string;
  branchId?: string;
  q?: string;
};

export type CreateStockLocationDto = {
  companyId: string;
  branchId?: string | null;
  name: string;
  code?: string | null;
  address?: string | null;
  phone?: string | null;
  isWarehouse?: boolean;
  isActive?: boolean;
};

export type UpdateStockLocationDto = Partial<Omit<CreateStockLocationDto, "companyId">>;
