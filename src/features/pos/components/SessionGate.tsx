import { useEffect, useMemo, useState } from "react";
import { Button, Card, EmptyState, Field, money, Pill, Spinner } from "./posUi";
import type { Guid, PosSessionDto } from "../types/posTypes";
import { useI18n } from "../../../i18n";

export type PosStoreOption = {
  id: Guid;
  code?: string | null;
  name: string;
  isActive?: boolean;
};


const sessionGateAmharicPhrases: Record<string, string> = {
  "Loading POS session...": "የPOS ሴሽን በመጫን ላይ...",
  "Open Cashier Session": "የካሸር ሴሽን ክፈት",
  "Select a branch POS store before taking orders.": "ትዕዛዝ ከመቀበል በፊት የቅርንጫፍ POS መደብር ይምረጡ።",
  "POS Store": "POS መደብር",
  "Loading stores...": "መደብሮች በመጫን ላይ...",
  "Select POS store": "POS መደብር ይምረጡ",
  "No active POS stores are configured for this branch.": "ለዚህ ቅርንጫፍ ንቁ POS መደብሮች አልተዋቀሩም።",
  "Cashier name": "የካሸር ስም",
  "Terminal": "ተርሚናል",
  "Opening float": "የመክፈቻ ጥሬ ገንዘብ",
  "Open Session": "ሴሽን ክፈት",
  "OPEN": "ክፍት",
  "Cashier": "ካሸር",
  "Opened": "ተከፍቷል",
  "Opening Float": "የመክፈቻ ጥሬ ገንዘብ",
  "Close Session": "ሴሽን ዝጋ"
};

function sgText(language: string, text: string): string {
  return language === "am" ? sessionGateAmharicPhrases[text] ?? text : text;
}
type SessionGateProps = {
  loading: boolean;
  session: PosSessionDto | null;
  busy: boolean;
  error?: string | null;

  stores?: PosStoreOption[];
  storesLoading?: boolean;
  storesError?: string | null;

  selectedStoreId?: Guid | null;
  onStoreChange?: (storeId: Guid) => void;

  onOpen: (
    storeId: Guid,
    cashierName: string,
    terminal: string,
    openingFloat: number
  ) => Promise<unknown>;

  onClose: (closingFloat: number) => Promise<unknown>;
  children: React.ReactNode;
};

function isEmptyGuid(value: string | null | undefined): boolean {
  return (
    !value ||
    value.trim() === "" ||
    value === "00000000-0000-0000-0000-000000000000"
  );
}

function storeLabel(store: PosStoreOption): string {
  const code = store.code?.trim();
  const name = store.name?.trim();

  if (code && name) return `${code} - ${name}`;
  if (name) return name;
  if (code) return code;
  return store.id;
}

export function SessionGate({
  loading,
  session,
  busy,
  error,
  stores = [],
  storesLoading = false,
  storesError = null,
  selectedStoreId = null,
  onStoreChange,
  onOpen,
  onClose,
  children,
}: SessionGateProps) {
  const { language } = useI18n();
  const tx = (text: string) => sgText(language, text);
  const activeStores = useMemo(
    () => stores.filter((x) => x.isActive !== false && !isEmptyGuid(x.id)),
    [stores]
  );

  const [cashierName, setCashierName] = useState("");
  const [localStoreId, setLocalStoreId] = useState<Guid>("");
  const [terminal, setTerminal] = useState("POS-1");
  const [openingFloat, setOpeningFloat] = useState("0");

  const effectiveStoreId = selectedStoreId || localStoreId;

  const selectedStore = activeStores.find((x) => x.id === effectiveStoreId);

  useEffect(() => {
    if (!effectiveStoreId && activeStores.length === 1) {
      const onlyStore = activeStores[0];
      setLocalStoreId(onlyStore.id);
      onStoreChange?.(onlyStore.id);

      if (onlyStore.code?.trim()) {
        setTerminal(onlyStore.code.trim());
      }
    }
  }, [activeStores, effectiveStoreId, onStoreChange]);

  function handleStoreChange(nextStoreId: Guid) {
    setLocalStoreId(nextStoreId);
    onStoreChange?.(nextStoreId);

    const nextStore = activeStores.find((x) => x.id === nextStoreId);

    if (nextStore?.code?.trim()) {
      setTerminal(nextStore.code.trim());
    }
  }

  const openingFloatAmount = Number.parseFloat(openingFloat || "0");

  const canOpen =
    !busy &&
    !storesLoading &&
    !isEmptyGuid(effectiveStoreId) &&
    cashierName.trim().length > 0 &&
    Number.isFinite(openingFloatAmount) &&
    openingFloatAmount >= 0;

  async function openSession() {
    if (!canOpen) return;

    const resolvedTerminal =
      terminal.trim() ||
      selectedStore?.code?.trim() ||
      selectedStore?.name?.trim() ||
      "POS-1";

    await onOpen(
      effectiveStoreId,
      cashierName.trim(),
      resolvedTerminal,
      openingFloatAmount
    );
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: 420,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          color: "#71717A",
        }}
      >
        <Spinner /> {tx("Loading POS session...")}
      </div>
    );
  }

  if (!session) {
    return (
      <div
        style={{
          minHeight: "100%",
          display: "grid",
          placeItems: "center",
          padding: 24,
        }}
      >
        <Card style={{ width: 460, maxWidth: "95vw" }}>
          <EmptyState
            title={tx("Open Cashier Session")}
            detail={tx("Select a branch POS store before taking orders.")}
          />

          {error && (
            <div style={{ color: "#F87171", fontSize: 13, marginBottom: 12 }}>
              {error}
            </div>
          )}

          {storesError && (
            <div style={{ color: "#F87171", fontSize: 13, marginBottom: 12 }}>
              {storesError}
            </div>
          )}

          <label className="erp-pos-label">{tx("POS Store")}</label>
          <select
            className="erp-pos-input"
            value={effectiveStoreId}
            disabled={busy || storesLoading}
            onChange={(e) => handleStoreChange(e.target.value)}
          >
            <option value="">
              {storesLoading ? tx("Loading stores...") : tx("Select POS store")}
            </option>

            {activeStores.map((store) => (
              <option key={store.id} value={store.id}>
                {storeLabel(store)}
              </option>
            ))}
          </select>

          {!storesLoading && activeStores.length === 0 && (
            <div style={{ color: "#FBBF24", fontSize: 13, marginTop: 8 }}>
              {tx("No active POS stores are configured for this branch.")}
            </div>
          )}

          <div style={{ height: 12 }} />

          <label className="erp-pos-label">{tx("Cashier name")}</label>
          <input
            className="erp-pos-input"
            value={cashierName}
            disabled={busy}
            onChange={(e) => setCashierName(e.target.value)}
            placeholder={tx("Cashier name")}
          />

          <div style={{ height: 12 }} />

          <label className="erp-pos-label">{tx("Terminal")}</label>
          <input
            className="erp-pos-input"
            value={terminal}
            disabled={busy}
            onChange={(e) => setTerminal(e.target.value)}
            placeholder="POS-1"
          />

          <div style={{ height: 12 }} />

          <label className="erp-pos-label">{tx("Opening float")}</label>
          <input
            className="erp-pos-input"
            type="number"
            min="0"
            value={openingFloat}
            disabled={busy}
            onChange={(e) => setOpeningFloat(e.target.value)}
          />

          <Button
            variant="gold"
            loading={busy}
            disabled={!canOpen}
            style={{ width: "100%", marginTop: 16 }}
            onClick={openSession}
          >
            {tx("Open Session")}
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
  const { language } = useI18n();
  const tx = (text: string) => sgText(language, text);

  return (
    <Card
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "12px 16px",
      }}
    >
      <Pill tone="green">{tx("OPEN")}</Pill>

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>
          {session.terminal || "POS-1"} - {session.cashierName || tx("Cashier")}
        </div>

        <div style={{ color: "#71717A", fontSize: 12 }}>
          {session.storeName ? `${session.storeName} - ` : ""}
          {tx("Opened")} {new Date(session.openedAtUtc).toLocaleString()}
        </div>
      </div>

      <Field label={tx("Opening Float")} value={money(session.openingFloat)} accent />

      <Button variant="danger" onClick={onClose}>
        {tx("Close Session")}
      </Button>
    </Card>
  );
}