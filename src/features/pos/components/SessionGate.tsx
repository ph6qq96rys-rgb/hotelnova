import { useState } from "react";
import { Button, Card, EmptyState, Field, money, Pill, Spinner } from "./posUi";
import type { PosSessionDto } from "../types/posTypes";

export function SessionGate({
  loading,
  session,
  busy,
  error,
  onOpen,
  onClose,
  children,
}: {
  loading: boolean;
  session: PosSessionDto | null;
  busy: boolean;
  error?: string | null;
  onOpen: (cashierName: string, terminal: string, openingFloat: number) => Promise<unknown>;
  onClose: (closingFloat: number) => Promise<unknown>;
  children: React.ReactNode;
}) {
  const [cashierName, setCashierName] = useState("");
  const [terminal, setTerminal] = useState("POS-1");
  const [openingFloat, setOpeningFloat] = useState("0");

  if (loading) {
    return (
      <div style={{ minHeight: 420, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "#71717A" }}>
        <Spinner /> Loading POS session…
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ minHeight: "100%", display: "grid", placeItems: "center", padding: 24 }}>
        <Card style={{ width: 390, maxWidth: "95vw" }}>
          <EmptyState title="Open Cashier Session" detail="A POS session is required before taking orders." />
          {error && <div style={{ color: "#F87171", fontSize: 13, marginBottom: 12 }}>{error}</div>}

          <label className="erp-pos-label">Cashier name</label>
          <input className="erp-pos-input" value={cashierName} onChange={(e) => setCashierName(e.target.value)} placeholder="Cashier name" />

          <div style={{ height: 12 }} />

          <label className="erp-pos-label">Terminal</label>
          <input className="erp-pos-input" value={terminal} onChange={(e) => setTerminal(e.target.value)} placeholder="POS-1" />

          <div style={{ height: 12 }} />

          <label className="erp-pos-label">Opening float</label>
          <input className="erp-pos-input" type="number" min="0" value={openingFloat} onChange={(e) => setOpeningFloat(e.target.value)} />

          <Button
            variant="gold"
            loading={busy}
            disabled={!cashierName.trim()}
            style={{ width: "100%", marginTop: 16 }}
            onClick={() => onOpen(cashierName.trim(), terminal.trim() || "POS-1", Number(openingFloat || 0))}
          >
            Open Session
          </Button>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

export function SessionBanner({
  session,
  onClose,
}: {
  session: PosSessionDto;
  onClose: () => void;
}) {
  return (
    <Card style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 16px" }}>
      <Pill tone="green">OPEN</Pill>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{session.terminal || "POS-1"} · {session.cashierName || "Cashier"}</div>
        <div style={{ color: "#71717A", fontSize: 12 }}>Opened {new Date(session.openedAtUtc).toLocaleString()}</div>
      </div>
      <Field label="Opening Float" value={money(session.openingFloat)} accent />
      <Button variant="danger" onClick={onClose}>Close Session</Button>
    </Card>
  );
}
