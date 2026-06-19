// src/features/organization/components/OrgTree.tsx

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
    <div className="card">
      <div className="card-header">
        <h2>Structure</h2>
      </div>

      <div className="card-body">
        {companies.length === 0 ? (
          <div className="muted">No companies found.</div>
        ) : (
          <ul className="org-tree">
            {companies.map((company) => {
              const activeCompany = company.id === selectedCompanyId;

              return (
                <li key={company.id} className={`list-item ${activeCompany ? "active" : ""}`}>
                  <button type="button" className="tree-btn" onClick={() => onSelectCompany(company.id)}>
                    {company.name}
                  </button>

                  {activeCompany && (
                    <ul className="org-tree sub">
                      {branches.length === 0 ? (
                        <li className="subitem muted">No branches.</li>
                      ) : (
                        branches.map((branch) => {
                          const activeBranch = branch.id === selectedBranchId;

                          return (
                            <li key={branch.id} className={`subitem ${activeBranch ? "active" : ""}`}>
                              <button type="button" className="tree-btn" onClick={() => onSelectBranch(branch.id)}>
                                {branch.name}
                              </button>

                              {activeBranch && (
                                <ul className="org-tree sub">
                                  {stores.length === 0 ? (
                                    <li className="subitem muted">No stores.</li>
                                  ) : (
                                    stores.map((store) => (
                                      <li
                                        key={store.id}
                                        className={`subitem ${store.id === selectedStoreId ? "active" : ""}`}
                                      >
                                        <button type="button" className="tree-btn" onClick={() => onSelectStore(store.id)}>
                                          {store.name}
                                        </button>
                                      </li>
                                    ))
                                  )}
                                </ul>
                              )}
                            </li>
                          );
                        })
                      )}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}