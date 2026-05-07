import { http } from "../../../api/http";
import type { CreateBranchDto,BranchDto } from "../types";



export const branchesApi = {
  async list(companyId: string): Promise<BranchDto[]> {
    const res = await http.get(`/companies/${companyId}/branches`);
    return res.data ?? [];
  },
  async create(companyId: string, dto: CreateBranchDto): Promise<BranchDto> {
    const res = await http.post(`/companies/${companyId}/branches`, dto);
    return res.data;
  },
};
