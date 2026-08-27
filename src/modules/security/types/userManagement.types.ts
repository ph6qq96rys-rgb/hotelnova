import type {
  CreateSecurityUserRequest,
  UpdateSecurityUserRequest,
  UserDto,
} from "../api/securityApi";

export type UserFilter = {
  q?: string;
  role?: string;
  branchId?: string;
  storeId?: string;
  stockLocationId?: string;
  isActive?: boolean;
  page: number;
  pageSize: number;
};

export type AccessScopeRequest =
  | CreateSecurityUserRequest
  | UpdateSecurityUserRequest;

export type UserModal =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "edit"; user: UserDto }
  | { kind: "resetPassword"; user: UserDto }
  | { kind: "linkEmployee"; user: UserDto };

export type AuthUserLike = {
  roles?: unknown[];
  roleNames?: unknown[];
};

export type UserWithEmployee = UserDto & {
  companyEmployeeId?: string | null;
  employeeId?: string | null;
};
