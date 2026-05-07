import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { companyApi } from "../../../features/company/api/companyApi";
import type { CompanyDto } from "../types";

const PAGE_SIZE = 20;

export default function CompaniesPage() {
  const [items, setItems] = useState<CompanyDto[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await companyApi.listCompanies(page, PAGE_SIZE);
        if (!alive) return;

        setItems(Array.isArray(res?.items) ? res.items : []);
        setTotal(typeof res?.total === "number" ? res.total : 0);
      } catch (e: unknown) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Failed to load companies.");
        setItems([]);
        setTotal(0);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [page]);

  const canPrev = page > 1;
  const canNext = page * PAGE_SIZE < total;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={headerRow}>
        <div>
          <h2 style={{ margin: 0 }}>Companies</h2>
          <div style={{ color: "#666", fontSize: 13 }}>
            Manage tenants and onboarding
          </div>
        </div>

        <Link to="/companies/new" style={btnPrimary}>
          + New Company
        </Link>
      </div>

      <div style={tableWrapper}>
        <div style={tableHeader}>
          <b>Legal Name</b>
          <b>Trade Name</b>
          <b>Status</b>
          <b>Currency</b>
          <b>Timezone</b>
          <b>Actions</b>
        </div>

        {loading && <div style={emptyState}>Loading companies…</div>}

        {!loading && error && (
          <div style={{ ...emptyState, color: "#c00" }}>{error}</div>
        )}

        {!loading &&
          !error &&
          items.map((c) => (
            <div key={c.id} style={tableRow}>
              <div>{c.legalName}</div>
              <div>{c.tradeName ?? "—"}</div>
              <div>{String(c.status)}</div>
              <div>{c.defaultCurrency}</div>
              <div>{c.timezone}</div>
              <div>
                <Link to={`/companies/${c.id}`} style={btnGhost}>
                  View
                </Link>
              </div>
            </div>
          ))}

        {!loading && !error && items.length === 0 && (
          <div style={emptyState}>No companies yet.</div>
        )}
      </div>

      <div style={paginationRow}>
        <button
          style={btnGhost}
          disabled={!canPrev}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Prev
        </button>

        <div style={{ color: "#666" }}>
          Page {page} • Total {total}
        </div>

        <button
          style={btnGhost}
          disabled={!canNext}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

const headerRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const tableWrapper: React.CSSProperties = {
  border: "1px solid #eee",
  borderRadius: 12,
  overflow: "hidden",
};

const tableHeader: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2fr 2fr 1fr 1fr 2fr 1fr",
  background: "#fafafa",
  padding: 10,
  fontSize: 12,
  borderBottom: "1px solid #eee",
};

const tableRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "2fr 2fr 1fr 1fr 2fr 1fr",
  padding: 10,
  borderBottom: "1px solid #f3f3f3",
  alignItems: "center",
};

const emptyState: React.CSSProperties = {
  padding: 12,
  color: "#666",
};

const paginationRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
};

const btnPrimary: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  background: "#111",
  color: "#fff",
  textDecoration: "none",
};

const btnGhost: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "#fff",
  cursor: "pointer",
  textDecoration: "none",
  color: "#111",
};
