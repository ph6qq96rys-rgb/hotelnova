// src/api/identity/identityTypes.ts

export type PagedResult<T> = {
  items: T[];
  total: number;
  totalCount: number;
  page: number;
  pageNumber: number;
  pageSize: number;
};

export type UserDto = {
  id: string;

  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  userName?: string | null;
  email?: string | null;

  isActive: boolean;
  scope?: string | null;

  roles?: string[];
  roleNames?: string[];

  employee?: {
    id: string;
    employeeCode?: string | null;
    employeeNo?: string | null;
    fullName?: string | null;
    phoneNumber?: string | null;
    companyId?: string | null;
    branchId?: string | null;
    departmentId?: string | null;
    departmentName?: string | null;
  } | null;

  branchId?: string | null;
  branchIds?: string[];
  branchName?: string | null;

  storeId?: string | null;
  storeName?: string | null;

  companyEmployeeId?: string | null;
  employeeId?: string | null;
  employeeCode?: string | null;
  employeeName?: string | null;
  employeeFullName?: string | null;

  stockLocationId?: string | null;
  stockLocationCode?: string | null;
  stockLocationName?: string | null;
  defaultStockLocationId?: string | null;
  defaultStockLocationCode?: string | null;
  defaultStockLocationName?: string | null;
  stockLocationIds?: string[];

  allowedStockLocationIds?: string[];

  canSubmitWarehouseRequests?: boolean;
  canApproveWarehouseRequests?: boolean;
  canIssueStock?: boolean;

  createdAtUtc?: string | null;
  updatedAtUtc?: string | null;
};

export type UsersQuery = {
  page?: number;
  pageNumber?: number;
  pageSize?: number;
  q?: string;
  search?: string;
  branchId?: string | null;
  isActive?: boolean | null;
};

export type CreateUserRequest = {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;

  userName: string;
  email: string;
  password: string;

  roles?: string[];
  roleNames?: string[];

  scope?: string | null;
  branchId?: string | null;
  branchIds?: string[];
  storeId?: string | null;

  companyEmployeeId?: string | null;
  employeeId?: string | null;
  stockLocationId?: string | null;
  stockLocationIds?: string[];
  allowedStockLocationIds?: string[];

  isActive?: boolean;

  canSubmitWarehouseRequests?: boolean;
  canApproveWarehouseRequests?: boolean;
  canIssueStock?: boolean;
};

export type UpdateUserRequest = {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;

  userName?: string | null;
  email?: string | null;

  isActive?: boolean;

  roles?: string[];
  roleNames?: string[];

  scope?: string | null;
  branchId?: string | null;
  branchIds?: string[];
  storeId?: string | null;

  companyEmployeeId?: string | null;
  employeeId?: string | null;
  stockLocationId?: string | null;
  stockLocationIds?: string[];
  allowedStockLocationIds?: string[];

  canSubmitWarehouseRequests?: boolean;
  canApproveWarehouseRequests?: boolean;
  canIssueStock?: boolean;
};

export type ResetPasswordRequest = {
  newPassword: string;
};

export type PermissionDto = {
  key: string;
  name?: string | null;
  description?: string | null;
  group?: string | null;
  category?: string | null;
};

export type RoleUserDto = {
  userId: string;
  userName?: string | null;
  email?: string | null;
  roles: string[];
};

export type AssignRoleRequest = {
  userId: string;
  roleName: string;
};
