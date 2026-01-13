import UsersPage from "../pages/UsersPage";
import RolesPermissionsPage from "../pages/RolesPermissionsPage";

export const userManagementRoutes = [
  {
    path: "/users",
    element: <UsersPage />,
  },
  {
    path: "/roles-permissions",
    element: <RolesPermissionsPage />,
  },
];
