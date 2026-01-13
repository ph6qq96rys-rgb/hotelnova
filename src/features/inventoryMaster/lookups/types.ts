export type UomDto = {
  id: string;
  name: string;
  code?: string | null;
  isActive: boolean;
};

export type CategoryDto = {
  id: string;
  name: string;
  isActive: boolean;
};
