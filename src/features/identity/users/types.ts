export type PagedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export type UserDto = {
  id: string;
  userName: string;
  email: string;
  phoneNumber?: string | null;
  isActive: boolean;
  companyId?: string | null;
  branchId?: string | null;
  storeId?: string | null;
  roles: string[];
  createdAt?: string | null;
};

export type UserFilter = {
  q?: string;
  page?: number;
  pageSize?: number;
  role?: string;
  isActive?: boolean;
  companyId?: string;
  branchId?: string;
  storeId?: string;
};

export type CreateUserDto = {
  userName: string;
  email: string;
  password: string;
  roles: string[];
  companyId?: string | null;
  branchId?: string | null;
  storeId?: string | null;
  isActive?: boolean;
};

export type UpdateUserDto = {
  userName?: string;
  email?: string;
  phoneNumber?: string | null;
  roles?: string[];
  companyId?: string | null;
  branchId?: string | null;
  storeId?: string | null;
  isActive?: boolean;
};
