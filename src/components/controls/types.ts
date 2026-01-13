export type UnitDto = {
  id: string;
  code: string;
  name: string;
  isActive?: boolean;
};

export type CategoryDto = {
  id: string;
  name: string;
  isActive?: boolean;
};

export type ItemDto = {
  id: string;
  name: string;
  sku?: string | null;
  categoryId?: string | null;
  baseUomId?: string | null;
  isActive?: boolean;
};

export type InventoryCatalogsDto = {
  units: UnitDto[];
  categories: CategoryDto[];
  items: ItemDto[];
};
