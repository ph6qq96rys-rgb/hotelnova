import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {companyApi}from "../../../features/company/api/companyApi";
import type { CompanyDto } from "../types";

export default function CompaniesPage() {
  const [items, setItems] = useState<CompanyDto[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    (async () => {
      const res = await companyApi.listCompanies(page, pageSize);
      setItems(res.items);
      setTotal(res.total);
    })();
  }, [page]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 style={{ margin: 0 }}>Companies</h2>
          <div style={{ color: "#666", fontSize: 13 }}>Manage tenants and onboarding</div>
        </div>
        <Link to="/companies/new" style={btnPrimary}>+ New Company</Link>
      </div>

      <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 2fr 1fr 1fr 2fr 1fr",
            background: "#fafafa",
            padding: 10,
            fontSize: 12,
            borderBottom: "1px solid #eee"
          }}
        >
          <b>Legal Name</b><b>Trade Name</b><b>Status</b><b>Currency</b><b>Timezone</b><b>Actions</b>
        </div>

        {items.map((c) => (
          <div
            key={c.id}
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 2fr 1fr 1fr 2fr 1fr",
              padding: 10,
              borderBottom: "1px solid #f3f3f3",
              alignItems: "center"
            }}
          >
            <div>{c.legalName}</div>
            <div>{c.tradeName ?? ""}</div>
            <div>{String(c.status)}</div>
            <div>{c.defaultCurrency}</div>
            <div>{c.timezone}</div>
            <div>
              <Link to={`/companies/${c.id}`} style={btnGhost}>View</Link>
            </div>
          </div>
        ))}

        {items.length === 0 ? (
          <div style={{ padding: 12, color: "#666" }}>No companies yet.</div>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button style={btnGhost} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Prev
        </button>
        <div style={{ color: "#666" }}>Page {page} • Total {total}</div>
        <button style={btnGhost} disabled={page * pageSize >= total} onClick={() => setPage((p) => p + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  background: "#111",
  color: "#fff",
  textDecoration: "none"
};

const btnGhost: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "#fff",
  cursor: "pointer",
  textDecoration: "none",
  color: "#111"
};
