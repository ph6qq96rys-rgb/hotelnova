import { http } from "../../../api/http";
import type {
  ApplyRecipeRequest,
  CreateProductionBatchRequest,
  ProductionBatchDto,
  UpdateProductionLinesRequest,
} from "../types";

export const productionApi = {
  createBatch: (companyId: string, req: CreateProductionBatchRequest) =>
    http.post<string>(`/companies/${companyId}/production/batches`, req).then((r) => r.data),

  getBatch: (companyId: string, batchId: string) =>
    http.get<ProductionBatchDto>(`/companies/${companyId}/production/batches/${batchId}`).then((r) => r.data),

  updateLines: (companyId: string, batchId: string, req: UpdateProductionLinesRequest) =>
    http.put<void>(`/companies/${companyId}/production/batches/${batchId}/lines`, req).then((r) => r.data),

  applyRecipe: (companyId: string, batchId: string, req: ApplyRecipeRequest) =>
    http.post<void>(`/companies/${companyId}/production/batches/${batchId}/apply-recipe`, req).then((r) => r.data),

  post: (companyId: string, batchId: string) =>
    http.post<void>(`/companies/${companyId}/production/batches/${batchId}/post`, {}).then((r) => r.data),

  reverse: (companyId: string, batchId: string) =>
    http.post<void>(`/companies/${companyId}/production/batches/${batchId}/reverse`, {}).then((r) => r.data),
};
