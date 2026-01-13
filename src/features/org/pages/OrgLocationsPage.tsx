import { useEffect, useMemo, useState } from "react";
import OrgTree from "../components/OrgTree";
import CompanyForm from "../components/CompanyForm";
import BranchForm from "../components/BranchForm";
import StoreForm from "../components/StoreForm";
import { orgApi } from "../api/orgApi";
import type { OrganizationDto } from "../types";

type Modal =
  | { kind: "none" }
  | { kind: "company.create" }
  | { kind: "company.edit"; company: OrganizationDto }
  | { kind: "branch.create" }
  | { kind: "branch.edit"; branch: OrganizationDto }
  | { kind: "store.create" }
  | { kind: "store.edit"; store: OrganizationDto };

export default function OrgLocationsPage() {
  const [companies, setCompanies] = useState<OrganizationDto[]>([]);
  const [branches, setBranches] = useState<OrganizationDto[]>([]);
  const [stores, setStores] = useState<OrganizationDto[]>([]);

  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modal, setModal] = useState<Modal>({ kind: "none" });
  const close = () => setModal({ kind: "none" });

  const currentCompany = useMemo(
    () => companies.find(x => x.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId]
  );

  const currentBranch = useMemo(
    () => branches.find(x => x.id === selectedBranchId) ?? null,
    [branches, selectedBranchId]
  );

  const currentStore = useMemo(
    () => stores.find(x => x.id === selectedStoreId) ?? null,
    [stores, selectedStoreId]
  );

  // -------------------------
  // Data loaders (IMPORTANT: orgApi returns PagedResult, not AxiosResponse)
  // -------------------------
  const loadCompanies = async () => {
    const res = await orgApi.list({ page: 1, pageSize: 500 });
    setCompanies(res.data.items ?? []);
  };

  const loadBranches = async (companyId: string) => {
    const res = await orgApi.listBranches(companyId, { page: 1, pageSize: 500 });
    setBranches(res.data.items ?? []);
  };

  const loadStores = async (companyId: string) => {
    const res = await orgApi.listStores(companyId, { page: 1, pageSize: 500 });
    setStores(res.data.items ?? []);
  };

  const refreshAll = async (opts?: { keepSelection?: boolean }) => {
    setLoading(true);
    setError(null);

    try {
      await loadCompanies();

      if (!selectedCompanyId) {
        setBranches([]);
        setStores([]);
        return;
      }

      await Promise.all([loadBranches(selectedCompanyId), loadStores(selectedCompanyId)]);

      // If selection is not valid after refresh (item deleted), clear it.
      if (!opts?.keepSelection) {
        // keepSelection=false means we still validate and clean up stale ids
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load organization data");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------
  // Initial load
  // -------------------------
  useEffect(() => {
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------
  // When company changes: reset branch/store and load children
  // -------------------------
  useEffect(() => {
    setSelectedBranchId(null);
    setSelectedStoreId(null);

    if (!selectedCompanyId) {
      setBranches([]);
      setStores([]);
      return;
    }

    setLoading(true);
    setError(null);
    Promise.all([loadBranches(selectedCompanyId), loadStores(selectedCompanyId)])
      .catch((e: any) => setError(e?.message ?? "Failed to load branches/stores"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompanyId]);

  // -------------------------
  // Modal openers
  // -------------------------
  const openCompanyCreate = () => setModal({ kind: "company.create" });
  const openCompanyEdit = () => currentCompany && setModal({ kind: "company.edit", company: currentCompany });

  const openBranchCreate = () => selectedCompanyId && setModal({ kind: "branch.create" });
  const openBranchEdit = () => currentBranch && setModal({ kind: "branch.edit", branch: currentBranch });

  const openStoreCreate = () => selectedCompanyId && selectedBranchId && setModal({ kind: "store.create" });
  const openStoreEdit = () => currentStore && setModal({ kind: "store.edit", store: currentStore });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Organization & Locations</h1>
          <p className="muted">Setup Company → Branch → Store/Warehouse structure.</p>
        </div>

        <div className="row gap">
          <button className="btn primary" onClick={openCompanyCreate}>
            + Company
          </button>
          <button className="btn" onClick={openCompanyEdit} disabled={!currentCompany}>
            Edit Company
          </button>

          <button className="btn primary" onClick={openBranchCreate} disabled={!selectedCompanyId}>
            + Branch
          </button>
          <button className="btn" onClick={openBranchEdit} disabled={!currentBranch}>
            Edit Branch
          </button>

          <button className="btn primary" onClick={openStoreCreate} disabled={!selectedCompanyId || !selectedBranchId}>
            + Store
          </button>
          <button className="btn" onClick={openStoreEdit} disabled={!currentStore}>
            Edit Store
          </button>
        </div>
      </div>

      {error ? (
        <div className="alert danger">
          <strong>Error:</strong> {error}
        </div>
      ) : null}

      {loading ? <div className="muted">Loading...</div> : null}

      <div className="two-col">
        <OrgTree
          companies={companies}
          branches={branches}
          stores={stores}
          selectedCompanyId={selectedCompanyId}
          selectedBranchId={selectedBranchId}
          onSelectCompany={(id: string) => setSelectedCompanyId(id)}
          onSelectBranch={(id: string) => {
            setSelectedBranchId(id);
            setSelectedStoreId(null);
          }}
        />

        <div className="card">
          <div className="card-header">
            <h2>Details</h2>
          </div>

          <div className="card-body">
            {!currentCompany ? (
              <div className="muted">Select a company to see details.</div>
            ) : (
              <div className="grid">
                <div>
                  <strong>Company:</strong> {currentCompany.name}
                </div>
                <div>
                  <strong>Status:</strong> {currentCompany.isActive ? "Active" : "Disabled"}
                </div>

                <hr />

                <div>
                  <strong>Branch:</strong> {currentBranch?.name ?? "-"}
                </div>
                <div>
                  <strong>City/Region:</strong>{" "}
                  {currentBranch
                    ? `${(currentBranch as any).city ?? "-"} / ${(currentBranch as any).region ?? "-"}`
                    : "-"}
                </div>

                <hr />

                <div>
                  <strong>Store:</strong> {currentStore?.name ?? "-"}
                </div>

                {selectedCompanyId ? (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div className="muted" style={{ marginBottom: 8 }}>
                      Stores in this company:
                    </div>

                    {stores.length === 0 ? (
                      <div className="muted">No stores yet.</div>
                    ) : (
                      <div className="row gap" style={{ flexWrap: "wrap" }}>
                        {stores.map(s => (
                          <button
                            key={s.id}
                            className={`btn ${s.id === selectedStoreId ? "primary" : ""}`}
                            onClick={() => setSelectedStoreId(s.id)}
                            type="button"
                          >
                            {s.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="card-footer actions">
            <button className="btn" onClick={() => refreshAll({ keepSelection: true })}>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {modal.kind !== "none" ? (
        <div className="modal-backdrop" onClick={close}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            {modal.kind === "company.create" ? (
              <CompanyForm
                mode="create"
                onCancel={close}
                onSubmit={async (dto: any) => {
                  await orgApi.create(dto);
                  close();
                  await refreshAll();
                }}
              />
            ) : null}

            {modal.kind === "company.edit" ? (
              <CompanyForm
                mode="edit"
                initial={modal.company as any}
                onCancel={close}
                onSubmit={async (dto: any) => {
                  await orgApi.update(modal.company.id, dto);
                  close();
                  await refreshAll({ keepSelection: true });
                }}
              />
            ) : null}

            {modal.kind === "branch.create" && selectedCompanyId ? (
              <BranchForm
                companyId={selectedCompanyId}
                mode="create"
                onCancel={close}
                onSubmit={async (dto: any) => {
                  await orgApi.create(dto);
                  close();
                  await refreshAll({ keepSelection: true });
                }}
              />
            ) : null}

            {modal.kind === "branch.edit" ? (
              <BranchForm
                companyId={(modal.branch as any).companyId}
                mode="edit"
                initial={modal.branch as any}
                onCancel={close}
                onSubmit={async (dto: any) => {
                  await orgApi.update(modal.branch.id, dto);
                  close();
                  await refreshAll({ keepSelection: true });
                }}
              />
            ) : null}

            {modal.kind === "store.create" && selectedCompanyId && selectedBranchId ? (
              <StoreForm
                companyId={selectedCompanyId}
                branchId={selectedBranchId}
                mode="create"
                onCancel={close}
                onSubmit={async (dto: any) => {
                  await orgApi.create(dto);
                  close();
                  await refreshAll({ keepSelection: true });
                }}
              />
            ) : null}

            {modal.kind === "store.edit" ? (
              <StoreForm
                companyId={(modal.store as any).companyId}
                branchId={(modal.store as any).branchId}
                mode="edit"
                initial={modal.store as any}
                onCancel={close}
                onSubmit={async (dto: any) => {
                  await orgApi.update(modal.store.id, dto);
                  close();
                  await refreshAll({ keepSelection: true });
                }}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
