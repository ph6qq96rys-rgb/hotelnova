// src/features/organization/pages/OrgLocationsPage.tsx

import { useCallback, useEffect, useMemo, useState } from "react";

import BranchForm from "../components/BranchForm";
import CompanyForm from "../components/CompanyForm";
import OrgTree from "../components/OrgTree";
import StoreForm from "../components/StoreForm";
import { orgApi } from "../api/orgApi";
import type {
  BranchDto,
  CompanyDto,
  CreateBranchDto,
  CreateCompanyDto,
  CreateStoreDto,
  OrganizationDto,
  StoreDto,
  UpdateBranchDto,
  UpdateCompanyDto,
  UpdateStoreDto,
} from "../types";

type Modal =
  | { kind: "none" }
  | { kind: "company.create" }
  | { kind: "company.edit"; company: CompanyDto }
  | { kind: "branch.create" }
  | { kind: "branch.edit"; branch: BranchDto }
  | { kind: "store.create" }
  | { kind: "store.edit"; store: StoreDto };

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;

  const maybe = error as {
    response?: { status?: number; data?: { message?: string; title?: string } | string };
    message?: string;
  };

  if (typeof maybe?.response?.data === "string") return maybe.response.data;

  return (
    maybe?.response?.data?.message ??
    maybe?.response?.data?.title ??
    maybe?.message ??
    fallback
  );
}

function asCompany(row: OrganizationDto): CompanyDto {
  return row as CompanyDto;
}

function asBranch(row: OrganizationDto): BranchDto {
  return row as BranchDto;
}

function asStore(row: OrganizationDto): StoreDto {
  return {
    ...(row as StoreDto),
    companyId: row.companyId ?? "",
    branchId: row.branchId ?? "",
    isWarehouse: Boolean(row.isWarehouse),
  };
}

export default function OrgLocationsPage() {
  const [companies, setCompanies] = useState<OrganizationDto[]>([]);
  const [branches, setBranches] = useState<OrganizationDto[]>([]);
  const [stores, setStores] = useState<OrganizationDto[]>([]);

  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  const [modal, setModal] = useState<Modal>({ kind: "none" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const company = useMemo(
    () => companies.find((x) => x.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId],
  );

  const branch = useMemo(
    () => branches.find((x) => x.id === selectedBranchId) ?? null,
    [branches, selectedBranchId],
  );

  const store = useMemo(
    () => stores.find((x) => x.id === selectedStoreId) ?? null,
    [stores, selectedStoreId],
  );

  const currentCompany = company ? asCompany(company) : null;
  const currentBranch = branch ? asBranch(branch) : null;
  const currentStore = store ? asStore(store) : null;

  const closeModal = useCallback(() => setModal({ kind: "none" }), []);

  const loadCompanies = useCallback(async (): Promise<OrganizationDto[]> => {
    const res = await orgApi.listCompanies({ page: 1, pageSize: 500 });
    const rows = res.data.items ?? [];

    setCompanies(rows);
    setSelectedCompanyId((current) =>
      current && rows.some((x) => x.id === current) ? current : rows[0]?.id ?? null,
    );

    return rows;
  }, []);

  const loadBranches = useCallback(async (companyId: string): Promise<OrganizationDto[]> => {
    const res = await orgApi.listBranches(companyId, { page: 1, pageSize: 500 });
    const rows = res.data.items ?? [];

    setBranches(rows);
    setSelectedBranchId((current) =>
      current && rows.some((x) => x.id === current) ? current : rows[0]?.id ?? null,
    );

    return rows;
  }, []);

  const loadStores = useCallback(
    async (companyId: string, branchId?: string | null): Promise<OrganizationDto[]> => {
      const res = await orgApi.listStores(companyId, branchId, { page: 1, pageSize: 500 });
      const rows = res.data.items ?? [];

      setStores(rows);
      setSelectedStoreId((current) =>
        current && rows.some((x) => x.id === current) ? current : null,
      );

      return rows;
    },
    [],
  );

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const companyRows = await loadCompanies();
      const nextCompanyId = selectedCompanyId ?? companyRows[0]?.id ?? null;

      if (!nextCompanyId) {
        setBranches([]);
        setStores([]);
        return;
      }

      const branchRows = await loadBranches(nextCompanyId);
      const nextBranchId = selectedBranchId ?? branchRows[0]?.id ?? null;

      await loadStores(nextCompanyId, nextBranchId);
    } catch (err) {
      setCompanies([]);
      setBranches([]);
      setStores([]);
      setError(errorMessage(err, "Failed to refresh organization data."));
    } finally {
      setLoading(false);
    }
  }, [loadBranches, loadCompanies, loadStores, selectedBranchId, selectedCompanyId]);

  useEffect(() => {
    void refresh();
    // refresh intentionally runs once on mount; selection changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedCompanyId) {
      setBranches([]);
      setStores([]);
      setSelectedBranchId(null);
      setSelectedStoreId(null);
      return;
    }

    setLoading(true);
    setError(null);
    setSelectedBranchId(null);
    setSelectedStoreId(null);

    loadBranches(selectedCompanyId)
      .then((rows) => loadStores(selectedCompanyId, rows[0]?.id ?? null))
      .catch((err) => {
        setBranches([]);
        setStores([]);
        setError(errorMessage(err, "Failed to load branches and stores."));
      })
      .finally(() => setLoading(false));
  }, [loadBranches, loadStores, selectedCompanyId]);

  useEffect(() => {
    if (!selectedCompanyId) return;

    setLoading(true);
    setError(null);
    setSelectedStoreId(null);

    loadStores(selectedCompanyId, selectedBranchId)
      .catch((err) => {
        setStores([]);
        setError(errorMessage(err, "Failed to load stores."));
      })
      .finally(() => setLoading(false));
  }, [loadStores, selectedBranchId, selectedCompanyId]);

  async function save(work: () => Promise<void>): Promise<void> {
    setSaving(true);
    setError(null);

    try {
      await work();
      closeModal();
      await refresh();
    } catch (err) {
      setError(errorMessage(err, "Failed to save organization record."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Administration</div>
          <div className="page-title">Organization & Locations</div>
          <div className="page-sub">
            Manage company, branch, store, and warehouse structure.
          </div>
        </div>

        <div className="row gap">
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving}
            onClick={() => setModal({ kind: "company.create" })}
          >
            + Company
          </button>

          <button
            type="button"
            className="btn"
            disabled={!currentCompany || saving}
            onClick={() => currentCompany && setModal({ kind: "company.edit", company: currentCompany })}
          >
            Edit Company
          </button>

          <button
            type="button"
            className="btn btn-primary"
            disabled={!selectedCompanyId || saving}
            onClick={() => setModal({ kind: "branch.create" })}
          >
            + Branch
          </button>

          <button
            type="button"
            className="btn"
            disabled={!currentBranch || saving}
            onClick={() => currentBranch && setModal({ kind: "branch.edit", branch: currentBranch })}
          >
            Edit Branch
          </button>

          <button
            type="button"
            className="btn btn-primary"
            disabled={!selectedCompanyId || !selectedBranchId || saving}
            onClick={() => setModal({ kind: "store.create" })}
          >
            + Store
          </button>

          <button
            type="button"
            className="btn"
            disabled={!currentStore || saving}
            onClick={() => currentStore && setModal({ kind: "store.edit", store: currentStore })}
          >
            Edit Store
          </button>

          <button
            type="button"
            className="btn"
            disabled={loading || saving}
            onClick={() => void refresh()}
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger">
          <strong>Error:</strong> {error}
        </div>
      )}
      {loading && <div className="alert alert-info">Loading organization data…</div>}

      <div className="two-col">
        <OrgTree
          companies={companies}
          branches={branches}
          stores={stores}
          selectedCompanyId={selectedCompanyId}
          selectedBranchId={selectedBranchId}
          selectedStoreId={selectedStoreId}
          onSelectCompany={setSelectedCompanyId}
          onSelectBranch={setSelectedBranchId}
          onSelectStore={setSelectedStoreId}
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
                  <strong>Branch:</strong> {currentBranch?.name ?? "—"}
                </div>
                <div>
                  <strong>City/Region:</strong>{" "}
                  {currentBranch
                    ? `${currentBranch.city ?? "—"} / ${currentBranch.region ?? "—"}`
                    : "—"}
                </div>

                <hr />

                <div>
                  <strong>Store:</strong> {currentStore?.name ?? "—"}
                </div>
                <div>
                  <strong>Store Type:</strong>{" "}
                  {currentStore ? (currentStore.isWarehouse ? "Warehouse" : "Store") : "—"}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {modal.kind !== "none" && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {modal.kind === "company.create" && (
              <CompanyForm
                mode="create"
                saving={saving}
                onCancel={closeModal}
                onSubmit={(dto: CreateCompanyDto) =>
                  save(async () => {
                    await orgApi.create(dto);
                  })
                }
              />
            )}

            {modal.kind === "company.edit" && (
              <CompanyForm
                mode="edit"
                saving={saving}
                initial={modal.company}
                onCancel={closeModal}
                onSubmit={(dto: UpdateCompanyDto) =>
                  save(async () => {
                    await orgApi.update(modal.company.id, dto);
                  })
                }
              />
            )}

            {modal.kind === "branch.create" && selectedCompanyId && (
              <BranchForm
                mode="create"
                companyId={selectedCompanyId}
                saving={saving}
                onCancel={closeModal}
                onSubmit={(dto: CreateBranchDto) =>
                  save(async () => {
                    await orgApi.create(dto);
                  })
                }
              />
            )}

            {modal.kind === "branch.edit" && (
              <BranchForm
                mode="edit"
                companyId={modal.branch.companyId}
                saving={saving}
                initial={modal.branch}
                onCancel={closeModal}
                onSubmit={(dto: UpdateBranchDto) =>
                  save(async () => {
                    await orgApi.update(modal.branch.id, dto);
                  })
                }
              />
            )}

            {modal.kind === "store.create" && selectedCompanyId && selectedBranchId && (
              <StoreForm
                mode="create"
                companyId={selectedCompanyId}
                branchId={selectedBranchId}
                saving={saving}
                onCancel={closeModal}
                onSubmit={(dto: CreateStoreDto) =>
                  save(async () => {
                    await orgApi.create(dto);
                  })
                }
              />
            )}

            {modal.kind === "store.edit" && (
              <StoreForm
                mode="edit"
                companyId={modal.store.companyId}
                branchId={modal.store.branchId}
                saving={saving}
                initial={modal.store}
                onCancel={closeModal}
                onSubmit={(dto: UpdateStoreDto) =>
                  save(async () => {
                    await orgApi.update(modal.store.id, dto);
                  })
                }
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
