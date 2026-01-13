import { http } from "./http";
import type {LoginRequest, RegisterRequest, LoginResponse,AuthUser, ResetPasswordRequest } from "../auth/auth.types";

export async function resetPassword(payload: ResetPasswordRequest) {
  const { data }= await http.post("/auth/reset-password", payload);
  return data;
}
export const authApi = {
  async login(req: LoginRequest) {
    const r = await http.post<LoginResponse>("/auth/login", req);
    return r.data;
  },

  register: async (req: RegisterRequest) => {
    const data  = await http.post("/auth/register", req);
    return data;
  },

  // Optional: get current user profile
  me: async () => {
    const { data } = await http.get<AuthUser>("/auth/me");
    return data;
  },

  logout: async () => {
    const { data } = await http.post("/auth/logout", {});
    return data;
  },

   forgotPassword:async(email: string) =>{
    const { data } = await http.post("/auth/forgot-password", { email });
    return data;
  },
resetPassword: (req: ResetPasswordRequest) =>
    http.post("/auth/reset-password", req).then(r => r.data),
};
