// sivQueryKeys.ts
export const sivKeys = {
  all: (companyId: string) => ["siv", companyId] as const,

  // lists
  list: (companyId: string) => [...sivKeys.all(companyId), "list"] as const,
  drafts: (companyId: string) => [...sivKeys.all(companyId), "drafts"] as const,

  // detail
  detail: (companyId: string, sivId: string) =>
    [...sivKeys.all(companyId), "detail", sivId] as const,

  // draft detail
  draftDetail: (companyId: string, draftId: string) =>
    [...sivKeys.all(companyId), "draftDetail", draftId] as const,

  // lookups
  issuingLocations: (companyId: string) =>
    [...sivKeys.all(companyId), "issuingLocations"] as const,
  requestingUnits: (companyId: string) =>
    [...sivKeys.all(companyId), "requestingUnits"] as const,
  itemsSearch: (companyId: string, q: string) =>
    [...sivKeys.all(companyId), "itemsSearch", q] as const,
  availability: (companyId: string, locationId: string, itemId: string) =>
    [...sivKeys.all(companyId), "availability", locationId, itemId] as const,

  // misc
  fifoPreview: (companyId: string, sivId: string, lineId: string) =>
    [...sivKeys.all(companyId), "fifoPreview", sivId, lineId] as const,
};
