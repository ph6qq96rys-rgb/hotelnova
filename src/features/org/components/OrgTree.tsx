import type { OrganizationDto } from "../types";

type Props = {
  companies: OrganizationDto[];
  branches: OrganizationDto[];
  stores: OrganizationDto[];
  selectedCompanyId: string | null;
  selectedBranchId: string | null;
  onSelectCompany: (id: string) => void;
  onSelectBranch: (id: string) => void;
};

export default function OrgTree({
  companies,
  branches,
  stores,
  selectedCompanyId,
  selectedBranchId,
  onSelectCompany,
  onSelectBranch,
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
            {companies.map(c => {
              const activeCompany = c.id === selectedCompanyId;
              return (
                <li key={c.id} className={`list-item ${activeCompany ? "active" : ""}`}>
                  <button type="button" className="tree-btn" onClick={() => onSelectCompany(c.id)}>
                    {c.name}
                  </button>

                  {activeCompany ? (
                    <ul className="org-tree sub">
                      {branches.length === 0 ? (
                        <li className="subitem muted">No branches.</li>
                      ) : (
                        branches.map(b => {
                          const activeBranch = b.id === selectedBranchId;
                          return (
                            <li key={b.id} className={`subitem ${activeBranch ? "active" : ""}`}>
                              <button type="button" className="tree-btn" onClick={() => onSelectBranch(b.id)}>
                                {b.name}
                              </button>

                              {activeBranch ? (
                                <ul className="org-tree sub">
                                  {stores.length === 0 ? (
                                    <li className="subitem muted">No stores.</li>
                                  ) : (
                                    stores.map(s => (
                                      <li key={s.id} className="subitem">
                                        <span className="muted">{s.name}</span>
                                      </li>
                                    ))
                                  )}
                                </ul>
                              ) : null}
                            </li>
                          );
                        })
                      )}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
