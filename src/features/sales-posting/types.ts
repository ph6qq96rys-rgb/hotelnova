
export type CreateSaleInput = Omit<CreateSaleDto, "companyId" | "branchId">;
export type PaymentMethod = "CASH" | "CARD" | "MOBILE";

export type PaymentDto = {
  method: PaymentMethod;
  amount: number;
  ref?: string;
};

export type SaleLineDto = {
  menuItemId: string;
  quantity: number;
  unitPrice: number;
};

export type CreateSaleDto = {
  companyId: string|null;
  locationId: string|null;
  payment: PaymentDto;
  lines: SaleLineDto[];
};
