// src/api/identity/identityTypes.ts

export type PagedResult<T> = {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
};

export type UserDto = {
  id: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  userName?: string;
  email?: string;
  isActive: boolean;
  roles: string[];
  branchId?: number;
  storeId?: number;
};

export type UsersQuery = {
  pageNumber?: number;
  pageSize?: number;
  search?: string;
};

// Users create/update/reset
export type CreateUserRequest = {
  firstName?: string;
  lastName?: string;
  userName: string;
  email: string;
  password: string;
  branchId?: number;
  storeId?: number;
};

export type UpdateUserRequest = {
  firstName?: string;
  lastName?: string;
  userName?: string;
  email?: string;
  isActive?: boolean;
  branchId?: number;
  storeId?: number;
};

export type ResetPasswordRequest = {
  newPassword: string;
};

// ✅ Roles & Permissions
export type PermissionDto = {
  key: string;
  name?: string;
  description?: string;
  group?: string;
};

export type RoleUserDto = {
  userId: string;
  userName?: string;
  email?: string;
  roles: string[];
};

export type AssignRoleRequest = {
  userId: string;
  roleName: string;
};
