// src/features/organization/components/OrgTree.tsx

import { Building2, CircleDot, GitBranch, Store, Warehouse } from "lucide-react";

import type { OrganizationDto } from "../types";

type Props = {
  companies: OrganizationDto[];
  branches: OrganizationDto[];
  stores: OrganizationDto[];
  selectedCompanyId: string | null;
  selectedBranchId: string | null;
  selectedStoreId: string | null;
  onSelectCompany: (id: string) => void;
  onSelectBranch: (id: string) => void;
  onSelectStore: (id: string) => void;
};

export default function OrgTree({
  companies,
  branches,
  stores,
  selectedCompanyId,
  selectedBranchId,
  selectedStoreId,
  onSelectCompany,
  onSelectBranch,
  onSelectStore,
}: Props) {
  return (
    <div className="card org-structure-card">
      <div className="card-header">
        <h2>Structure</h2>
        <div className="org-structure-summary">
          <span>{branches.length} branches</span>
          <span>{stores.length} locations</span>
        </div>
      </div>

      <div className="card-body">
        {companies.length === 0 ? (
          <div className="muted">No companies found.</div>
        ) : (
          <div className="org-map" aria-label="Organization structure">
            {companies.map((company) => {
              const activeCompany = company.id === selectedCompanyId;
              const companyBranches = branches.filter(
                (branch) => !branch.companyId || branch.companyId === company.id,
              );

              return (
                <section key={company.id} className={`org-company ${activeCompany ? "is-active" : ""}`}>
                  <button type="button" className="org-node org-node--company" onClick={() => onSelectCompany(company.id)}>
                    <span className="org-node__icon" aria-hidden="true">
                      <Building2 size={18} />
                    </span>
                    <span className="org-node__main">
                      <span className="org-node__eyebrow">Tenant company</span>
                      <span className="org-node__name">{company.name}</span>
                      <span className="org-node__meta">
                        {company.code ? `${company.code} | ` : ""}
                        {company.isActive ? "Active" : "Disabled"}
                      </span>
                    </span>
                    <span className="org-node__badge">{companyBranches.length}</span>
                  </button>

                  {activeCompany && (
                    <div className="org-branch-stack">
                      {companyBranches.length === 0 ? (
                        <div className="org-empty">No branches are configured for this company.</div>
                      ) : (
                        companyBranches.map((branch) => {
                          const activeBranch = branch.id === selectedBranchId;
                          const branchStores = stores.filter(
                            (storeItem) => !storeItem.branchId || storeItem.branchId === branch.id,
                          );

                          return (
                            <section key={branch.id} className={`org-branch ${activeBranch ? "is-active" : ""}`}>
                              <button type="button" className="org-node org-node--branch" onClick={() => onSelectBranch(branch.id)}>
                                <span className="org-node__icon" aria-hidden="true">
                                  <GitBranch size={17} />
                                </span>
                                <span className="org-node__main">
                                  <span className="org-node__eyebrow">Operational branch</span>
                                  <span className="org-node__name">{branch.name}</span>
                                  <span className="org-node__meta">
                                    {[branch.city, branch.region].filter(Boolean).join(" / ") || "Location not set"}
                                  </span>
                                </span>
                                <span className="org-node__badge">{branchStores.length}</span>
                              </button>

                              {activeBranch && (
                                <div className="org-location-grid">
                                  {branchStores.length === 0 ? (
                                    <div className="org-empty">No stock locations or stores are assigned to this branch.</div>
                                  ) : (
                                    branchStores.map((storeItem) => {
                                      const label = describeLocation(storeItem);
                                      const Icon = storeItem.isWarehouse ? Warehouse : Store;

                                      return (
                                        <button
                                          key={storeItem.id}
                                          type="button"
                                          className={`org-location ${storeItem.id === selectedStoreId ? "is-active" : ""}`}
                                          onClick={() => onSelectStore(storeItem.id)}
                                        >
                                          <span className="org-location__icon" aria-hidden="true">
                                            <Icon size={16} />
                                          </span>
                                          <span className="org-location__main">
                                            <span className="org-location__name">{storeItem.name}</span>
                                            <span className="org-location__meta">
                                              {storeItem.code ? `${storeItem.code} | ` : ""}
                                              {label}
                                            </span>
                                          </span>
                                          <CircleDot size={14} className="org-location__state" aria-hidden="true" />
                                        </button>
                                      );
                                    })
                                  )}
                                </div>
                              )}
                            </section>
                          );
                        })
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function describeLocation(location: OrganizationDto): string {
  const name = `${location.name ?? ""} ${location.code ?? ""}`.toLowerCase();

  if (name.includes("pos")) return "POS / selling outlet";
  if (name.includes("transit") || name.includes("in-transit")) return "In-transit stock";
  if (name.includes("production") || name.includes("wip")) return "Production / WIP";
  if (name.includes("waste") || name.includes("spoil")) return "Waste & spoilage";
  if (name.includes("kitchen")) return "Kitchen consumption";
  if (name.includes("bar")) return "Bar consumption";
  if (location.isWarehouse) return "Warehouse";

  return "Store";
}
