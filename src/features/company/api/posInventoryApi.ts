// src/modules/company/api/posInventoryApi.ts

import { http } from "../../../api/http";
import { optionalGuid, requireGuid, unwrapArray } from "./apiGuards";

export type PosInventoryMappingDto = {
  id?: string;
  posId?: string;
  name?: string;
  posName?: string;
  stockLocationId?: string | null;
  issueLocationId?: string | null;
};

export type SavePosInventoryMappingsDto = {
  mappings: Array<{
    posId: string;
    stockLocationId: string | null;
  }>;
};

const base = (companyId: string, branchId: string) =>
  `/companies/${requireGuid(companyId, "companyId")}/branches/${requireGuid(
    branchId,
    "branchId",
  )}/pos-inventory-mappings`;

export const posInventoryApi = {
  async listMappings(companyId: string, branchId: string): Promise<PosInventoryMappingDto[]> {
    const res = await http.get<unknown>(base(companyId, branchId));
    return unwrapArray<PosInventoryMappingDto>(res.data);
  },

  async saveMappings(
    companyId: string,
    branchId: string,
    body: SavePosInventoryMappingsDto,
  ): Promise<void> {
    await http.put(base(companyId, branchId), {
      mappings: body.mappings.map((mapping) => ({
        posId: requireGuid(mapping.posId, "posId"),
        stockLocationId: optionalGuid(mapping.stockLocationId, "stockLocationId"),
      })),
    });
  },
};