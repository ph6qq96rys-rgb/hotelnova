import { useMemo, useState } from "react";
import { useAppScope } from "../../../../app/useAppScope";
import { useInventoryLedger } from "../hooks/useInventoryLedger";
import LedgerTable from "../components/LedgerTable";
import type { InventoryLedgerQuery } from "../api/inventoryLedgerApi";

export default function InventoryLedgerPage() {
  const { companyId } = useAppScope();

  const [locationId, setLocationId] = useState("");
  const [itemId, setItemId] = useState("");

  const query = useMemo<InventoryLedgerQuery>(
    () => ({
      locationId: cleanOrNull(locationId),
      itemId: cleanOrNull(itemId),
      page: 1,
      pageSize: 50,
    }),
    [locationId, itemId]
  );

  const { data, paging, loading, error } = useInventoryLedger(
    companyId ?? null,
    query
  );

  const items = data?.items ?? [];

  const hasFilters = Boolean(locationId.trim() || itemId.trim());

  function clearFilters() {
    setLocationId("");
    setItemId("");
  }

  if (!companyId) {
    return (
      <div style={pageStyle}>
        <div style={emptyStateStyle}>
          <div style={emptyTitleStyle}>Select Company</div>
          <div style={mutedStyle}>
            Please select a company before viewing the inventory ledger.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      {/* Page Header */}
      <section style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>Inventory Control</div>
          <h1 style={titleStyle}>Inventory Ledger</h1>
          <p style={mutedStyle}>
            Review real-time stock movements, costing trail, FIFO impact, and
            source document references.
          </p>
        </div>

        <div style={summaryBoxStyle}>
          <div style={summaryLabelStyle}>Rows Loaded</div>
          <div style={summaryValueStyle}>{items.length}</div>
        </div>
      </section>

      {/* Workflow Guide */}
      <section style={cardStyle}>
        <div style={sectionTitleStyle}>Ledger Workflow</div>

        <div style={workflowGridStyle}>
          <WorkflowStep
            number="1"
            title="Select Scope"
            text="The page reads the active company from AppScope."
          />
          <WorkflowStep
            number="2"
            title="Filter"
            text="Use LocationId and ItemId to narrow movements."
          />
          <WorkflowStep
            number="3"
            title="Review Ledger"
            text="Check movement type, quantity, cost, balance, and references."
          />
          <WorkflowStep
            number="4"
            title="Debug FIFO"
            text="Use filtered views to trace GRN, SIV, sales, transfers, and adjustments."
          />
        </div>
      </section>

      {/* Filters */}
      <section style={cardStyle}>
        <div style={cardHeaderStyle}>
          <div>
            <div style={sectionTitleStyle}>Filters</div>
            <div style={mutedStyle}>
              Paste IDs for now. Dropdowns can be wired later.
            </div>
          </div>

          <button
            type="button"
            style={secondaryBtnStyle(!hasFilters || loading)}
            onClick={clearFilters}
            disabled={!hasFilters || loading}
          >
            Clear
          </button>
        </div>

        <div style={filterGridStyle}>
          <Field
            label="LocationId"
            value={locationId}
            onChange={setLocationId}
            placeholder="Optional: paste warehouse / store / location id"
            helpText="Leave blank to view all locations."
            disabled={loading}
          />

          <Field
            label="ItemId"
            value={itemId}
            onChange={setItemId}
            placeholder="Optional: paste item id"
            helpText="Leave blank to view all items."
            disabled={loading}
          />
        </div>

        {loading && <div style={loadingStyle}>Loading ledger records…</div>}

        {error && (
          <div style={alertDangerStyle}>
            <strong>Error:</strong> {String(error)}
          </div>
        )}
      </section>

      {/* Ledger Table */}
      <section style={cardStyle}>
        <div style={cardHeaderStyle}>
          <div>
            <div style={sectionTitleStyle}>Ledger Movements</div>
            <div style={mutedStyle}>
              Stock movement history, quantities, costing, and document trail.
            </div>
          </div>
        </div>

        <div style={tableWrapStyle}>
          <LedgerTable items={items} />
        </div>

        <footer style={pagingFooterStyle}>
          <span>
            {paging?.totalCount ?? 0} records • Page {paging?.page ?? 1} /{" "}
            {paging?.totalPages ?? 1}
          </span>
        </footer>
      </section>

      {/* Sticky Debug Bar */}
      <div style={stickyBarStyle}>
        <div style={mutedStyle}>
          <strong>Debug Tip:</strong> Filter by both LocationId and ItemId to
          quickly trace FIFO, GRN, SIV, sales, transfers, and adjustments.
        </div>

        <button
          type="button"
          style={secondaryBtnStyle(!hasFilters || loading)}
          onClick={clearFilters}
          disabled={!hasFilters || loading}
        >
          Clear Filters
        </button>
      </div>
    </div>
  );
}

/* -----------------------------
 * Small Components
 * ----------------------------- */

function Field(props: {
  label: string;
  value: string;
  placeholder: string;
  helpText: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label style={labelStyle}>{props.label}</label>
      <input
        style={inputStyle}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        disabled={props.disabled}
      />
      <div style={helpStyle}>{props.helpText}</div>
    </div>
  );
}

function WorkflowStep(props: { number: string; title: string; text: string }) {
  return (
    <div style={workflowStepStyle}>
      <div style={workflowNumberStyle}>{props.number}</div>
      <div>
        <div style={{ fontWeight: 800 }}>{props.title}</div>
        <div style={mutedStyle}>{props.text}</div>
      </div>
    </div>
  );
}

/* -----------------------------
 * Helpers
 * ----------------------------- */

function cleanOrNull(value: string): string | null {
  const clean = value.trim();
  return clean ? clean : null;
}

/* -----------------------------
 * Inline Styles
 * ----------------------------- */

const pageStyle: React.CSSProperties = {
  padding: 16,
  maxWidth: 1200,
  margin: "0 auto",
  color: "#0f172a",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 14,
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 0.6,
  opacity: 0.65,
};

const titleStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  margin: "4px 0",
};

const mutedStyle: React.CSSProperties = {
  fontSize: 13,
  opacity: 0.72,
  lineHeight: 1.45,
};

const summaryBoxStyle: React.CSSProperties = {
  minWidth: 120,
  border: "1px solid rgba(0,0,0,0.1)",
  borderRadius: 12,
  padding: 12,
  background: "white",
  textAlign: "right",
};

const summaryLabelStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.65,
};

const summaryValueStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
};

const cardStyle: React.CSSProperties = {
  marginTop: 14,
  border: "1px solid rgba(0,0,0,0.1)",
  borderRadius: 14,
  padding: 14,
  background: "white",
};

const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 12,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
};

const workflowGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginTop: 12,
};

const workflowStepStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  padding: 12,
  borderRadius: 12,
  background: "rgba(15, 23, 42, 0.04)",
};

const workflowNumberStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 999,
  background: "#0f172a",
  color: "white",
  fontSize: 13,
  fontWeight: 900,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flex: "0 0 auto",
};

const filterGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12,
  marginTop: 14,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 800,
  opacity: 0.75,
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.15)",
  outline: "none",
  background: "white",
  color: "#0f172a",
};

const helpStyle: React.CSSProperties = {
  fontSize: 12,
  marginTop: 6,
  opacity: 0.65,
};

const loadingStyle: React.CSSProperties = {
  marginTop: 10,
  fontSize: 13,
  opacity: 0.75,
};

const alertDangerStyle: React.CSSProperties = {
  marginTop: 10,
  borderRadius: 12,
  border: "1px solid rgba(220, 38, 38, 0.35)",
  background: "rgba(220, 38, 38, 0.08)",
  color: "rgb(220, 38, 38)",
  padding: "10px 12px",
};

const tableWrapStyle: React.CSSProperties = {
  marginTop: 12,
  overflowX: "auto",
};

const pagingFooterStyle: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontSize: 12,
  opacity: 0.75,
};

const stickyBarStyle: React.CSSProperties = {
  position: "sticky",
  bottom: 0,
  zIndex: 10,
  marginTop: 14,
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "rgba(255,255,255,0.95)",
  backdropFilter: "blur(6px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const emptyStateStyle: React.CSSProperties = {
  border: "1px solid rgba(0,0,0,0.1)",
  borderRadius: 14,
  padding: 20,
  background: "white",
};

const emptyTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  marginBottom: 4,
};

function secondaryBtnStyle(disabled?: boolean): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.15)",
    background: disabled ? "rgba(15,23,42,0.04)" : "white",
    color: "#0f172a",
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
  };
}