// src/features/company/onboarding/SystemAdmin/pages/SystemAdminCompaniesPage.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { systemAdminApi } from "../api/systemAdminApi";
import type { CompanyListItemDto } from "../types/systemAdmin.types";

const DEFAULT_PAGE_SIZE = 25;

type PageState = {
  items: CompanyListItemDto[];
  totalCount: number;
  page: number;
  pageSize: number;
};

function emptyPage(page = 1, pageSize = DEFAULT_PAGE_SIZE): PageState {
  return {
    items: [],
    totalCount: 0,
    page,
    pageSize,
  };
}

function extractError(error: unknown, fallback: string): string {
  const err = error as {
    response?: {
      data?: {
        message?: string;
        title?: string;
      };
    };
    message?: string;
  };

  return (
    err?.response?.data?.message ??
    err?.response?.data?.title ??
    err?.message ??
    fallback
  );
}

function statusClass(company: CompanyListItemDto): string {
  if (!company.isActive) return "status-badge status-badge--danger";

  const status = String(company.status ?? "").toLowerCase();

  if (status === "active") return "status-badge status-badge--success";
  if (status === "pending") return "status-badge status-badge--warning";

  return "status-badge status-badge--neutral";
}

function companyDisplayName(company: CompanyListItemDto): string {
  return company.tradeName?.trim() || company.legalName || "Company";
}

function persistCompanyContext(context: {
  companyId: string;
  companyName: string;
  tenantSlug?: string | null;
}) {
  localStorage.setItem("companyId", context.companyId);
  localStorage.setItem("companyName", context.companyName);

  if (context.tenantSlug) {
    localStorage.setItem("tenantSlug", context.tenantSlug);
  } else {
    localStorage.removeItem("tenantSlug");
  }

  window.dispatchEvent(
    new CustomEvent("company:changed", {
      detail: {
        companyId: context.companyId,
        companyName: context.companyName,
        tenantSlug: context.tenantSlug ?? null,
      },
    })
  );
}

export default function SystemAdminCompaniesPage() {
  const navigate = useNavigate();

  const [pageState, setPageState] = useState<PageState>(() => emptyPage());
  const [busy, setBusy] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { items, totalCount, page, pageSize } = pageState;

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize))),
    [totalCount, pageSize]
  );

  const activeCount = useMemo(
    () => items.filter((item) => item.isActive).length,
    [items]
  );

  const canPrev = page > 1 && !busy;
  const canNext = page < totalPages && !busy;

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setBusy(true);
      setError(null);

      try {
        const result = await systemAdminApi.listCompanies(
          page,
          pageSize,
          signal
        );

        if (signal?.aborted) return;

        setPageState({
          items: result.items ?? [],
          totalCount: result.totalCount ?? 0,
          page: Number(result.page ?? page),
          pageSize: Number(result.pageSize ?? pageSize),
        });
      } catch (err) {
        if (signal?.aborted) return;

        setPageState(emptyPage(page, pageSize));
        setError(extractError(err, "Failed to load company workspaces."));
      } finally {
        if (!signal?.aborted) {
          setBusy(false);
        }
      }
    },
    [page, pageSize]
  );

  useEffect(() => {
    const controller = new AbortController();

    void load(controller.signal);

    return () => controller.abort();
  }, [load]);

  async function handleOpenWorkspace(company: CompanyListItemDto) {
    if (!company.id || switchingId || !company.isActive) return;

    setSwitchingId(company.id);
    setError(null);

    try {
      const context = await systemAdminApi.switchCompany(company.id);

      const companyId = context.companyId || company.id;
      const companyName =
        context.companyName || companyDisplayName(company);

      persistCompanyContext({
        companyId,
        companyName,
        tenantSlug: context.tenantSlug,
      });

      navigate(`/companies/${companyId}/dashboard`, { replace: true });
    } catch (err) {
      setError(extractError(err, "Failed to switch company context."));
    } finally {
      setSwitchingId(null);
    }
  }

  function goPrev() {
    setPageState((current) => ({
      ...current,
      page: Math.max(1, current.page - 1),
    }));
  }

  function goNext() {
    setPageState((current) => ({
      ...current,
      page: Math.min(totalPages, current.page + 1),
    }));
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-kicker">Platform Administration</div>
          <div className="page-title">Company Workspace Selector</div>
          <div className="page-sub">
            Select a company context for onboarding, configuration, security,
            inventory, sales, and operations.
          </div>
        </div>

        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => void load()}
        >
          {busy ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <section className="kpi-grid" style={{ marginBottom: 16 }}>
        <div className="kpi">
          <div className="kpi-label">Companies</div>
          <div className="kpi-val">{totalCount}</div>
          <div className="kpi-sub">available workspaces</div>
        </div>

        <div className="kpi">
          <div className="kpi-label">Shown</div>
          <div className="kpi-val">{items.length}</div>
          <div className="kpi-sub">current page</div>
        </div>

        <div className="kpi">
          <div className="kpi-label">Page</div>
          <div className="kpi-val">
            {page} / {totalPages}
          </div>
          <div className="kpi-sub">page size {pageSize}</div>
        </div>

        <div className="kpi">
          <div className="kpi-label">Active</div>
          <div className="kpi-val">{activeCount}</div>
          <div className="kpi-sub">on this page</div>
        </div>
      </section>

      <div className="card">
        <div className="card-header">
          <div>
            <h2>Company workspaces</h2>
            <p>
              Open a company workspace to configure ERP modules and tenant
              settings.
            </p>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Trade Name</th>
                <th>Currency</th>
                <th>Timezone</th>
                <th>Status</th>
                <th>Active</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>

            <tbody>
              {busy ? (
                <tr>
                  <td colSpan={7}>Loading company workspaces…</td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7}>No companies found.</td>
                </tr>
              ) : (
                items.map((company) => (
                  <tr key={company.id}>
                    <td>
                      <strong>{company.legalName}</strong>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>
                        {company.id}
                      </div>
                    </td>

                    <td>{company.tradeName || "—"}</td>
                    <td>{company.defaultCurrency || "—"}</td>
                    <td>{company.timezone || "—"}</td>

                    <td>
                      <span className={statusClass(company)}>
                        {company.status || "Unknown"}
                      </span>
                    </td>

                    <td>{company.isActive ? "Yes" : "No"}</td>

                    <td className="text-right">
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={
                          !company.isActive || switchingId === company.id
                        }
                        onClick={() => void handleOpenWorkspace(company)}
                      >
                        {switchingId === company.id
                          ? "Opening…"
                          : "Open workspace"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination">
          <button
            type="button"
            className="btn"
            disabled={!canPrev}
            onClick={goPrev}
          >
            Previous
          </button>

          <span>
            Page {page} of {totalPages}
          </span>

          <button
            type="button"
            className="btn"
            disabled={!canNext}
            onClick={goNext}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}