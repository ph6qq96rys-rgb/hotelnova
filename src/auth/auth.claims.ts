// src/auth/auth.claims.ts
// JWT claim names expected from the backend.

export const AUTH_CLAIMS = {
  sub: "sub",
  userId: "user_id",
  employeeId: "employee_id",
  companyId: "company_id",
  branchId: "branch_id",
  departmentId: "department_id",
  stockLocationId: "stock_location_id",
  storeId: "store_id",
  permission: "permission",
  permissions: "permissions",
  role: "role",
  roles: "roles",
  email: "email",
  name: "name",
  firstName: "first_name",
  lastName: "last_name",
  exp: "exp",
} as const;
