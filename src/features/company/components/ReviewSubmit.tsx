import * as React from "react";
import type {
  CreateCompanyAdminUserDto,
  CreateCompanyDto,
  CompanySettingsDto,
  BranchVm,
  StoreVm,
} from "../types";

type Props = {
  company: CreateCompanyDto;
  branches: BranchVm[];
  stores: StoreVm[];
  settings: CompanySettingsDto;
  admin: CreateCompanyAdminUserDto;
};

export default function ReviewSubmit({
  company,
  branches,
  stores,
  settings,
  admin,
}: Props) {
  const branchById = React.useMemo(() => {
    const m = new Map<string, BranchVm>();
    for (const b of branches) m.set(String(b.id), b);
    return m;
  }, [branches]);

  const storeById = React.useMemo(() => {
    const m = new Map<string, StoreVm>();
    for (const s of stores) m.set(String(s.id), s);
    return m;
  }, [stores]);

  const branchScopeLabel = admin.branchId
    ? branchById.get(String(admin.branchId))?.name ?? `Branch #${admin.branchId}`
    : "All branches";

  const storeScopeLabel = admin.storeId
    ? storeById.get(String(admin.storeId))?.name ?? `Store #${admin.storeId}`
    : "All stores";

  return (
    <Stack gap={16}>
      <Header
        title="Review and submit"
        subtitle="Double-check the details below. You can go back to edit any section before creating the company."
      />

      <Grid cols={2} gap={16}>
        <Card>
          <CardHeader
            title="Company"
            meta={<Badge variant="soft">Required</Badge>}
          />
          <Divider />
          <CardBody>
            <DefinitionList
              items={[
                { term: "Legal name", detail: company.legalName || "-" },
                { term: "Trade name", detail: company.tradeName || "-" },
                { term: "Currency", detail: company.defaultCurrency },
                { term: "Timezone", detail: company.timezone },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Admin user"
            meta={<Badge variant="soft">Will have access</Badge>}
          />
          <Divider />
          <CardBody>
            <DefinitionList
              items={[
                { term: "Username", detail: admin.userName },
                { term: "Email", detail: admin.email },
                { term: "Branch scope", detail: branchScopeLabel },
                { term: "Store scope", detail: storeScopeLabel },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Branches"
            meta={<CountBadge count={branches.length} />}
          />
          <Divider />
          <CardBody>
            {branches.length === 0 ? (
              <EmptyState
                title="No branches added"
                description="Add at least one branch to organize your company structure."
              />
            ) : (
              <ChipList
                items={branches
                  .slice()
                  .sort((a, b) => Number(!!b.isMain) - Number(!!a.isMain))
                  .map((b) => ({
                    key: String(b.id),
                    label: `${b.code} — ${b.name}`,
                    tone: b.isMain ? "primary" : "neutral",
                    suffix: b.isMain ? "Main" : undefined,
                  }))}
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Stores" meta={<CountBadge count={stores.length} />} />
          <Divider />
          <CardBody>
            {stores.length === 0 ? (
              <EmptyState
                title="No stores added"
                description="Stores are optional. Add them if you want inventory and sales by location."
              />
            ) : (
              <ChipList
                items={stores.map((s) => ({
                  key: String(s.id),
                  label: `${s.code} — ${s.name}`,
                  tone: "neutral",
                }))}
              />
            )}
          </CardBody>
        </Card>

        <Card span={2}>
          <CardHeader
            title="Settings"
            meta={<Badge variant="soft">Default configuration</Badge>}
          />
          <Divider />
          <CardBody>
            <Grid cols={2} gap={16}>
              <DefinitionList
                items={[
                  {
                    term: "VAT",
                    detail: (
                      <Inline>
                        <StatusDot
                          tone={settings.vatEnabled ? "success" : "neutral"}
                        />
                        <span>{settings.vatEnabled ? "Enabled" : "Disabled"}</span>
                      </Inline>
                    ),
                  },
                  {
                    term: "VAT rate",
                    detail: settings.vatEnabled
                      ? formatPercent(settings.vatRate)
                      : "—",
                  },
                  {
                    term: "Prices include VAT",
                    detail: (
                      <Badge variant="outline" tone={settings.pricesIncludeVat ? "success" : "neutral"}>
                        {settings.pricesIncludeVat ? "Yes" : "No"}
                      </Badge>
                    ),
                  },
                  { term: "Invoice prefix", detail: settings.invoicePrefix || "—" },
                  { term: "Receipt prefix", detail: settings.receiptPrefix || "—" },
                  {
                    term: "Allow negative stock",
                    detail: (
                      <Badge variant="outline" tone={settings.allowNegativeStock ? "warning" : "neutral"}>
                        {settings.allowNegativeStock ? "Allowed" : "Not allowed"}
                      </Badge>
                    ),
                  },
                  {
                    term: "Fiscal year start",
                    detail: monthName(settings.fiscalYearStartMonth),
                  },
                ]}
              />
            </Grid>
          </CardBody>
        </Card>
      </Grid>
    </Stack>
  );
}

/* -----------------------------
   Design system primitives
   Replace these with your DS:
   - MUI/Chakra/Radix/shadcn etc.
-------------------------------- */

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.2 }}>
        {title}
      </div>
      {subtitle ? (
        <div style={{ marginTop: 6, color: "#667085", fontSize: 13 }}>
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}

function Stack({
  children,
  gap = 12,
}: {
  children: React.ReactNode;
  gap?: number;
}) {
  return <div style={{ display: "grid", gap }}>{children}</div>;
}

function Grid({
  children,
  cols,
  gap = 12,
  span,
}: {
  children: React.ReactNode;
  cols: 1 | 2 | 3;
  gap?: number;
  span?: 1 | 2;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap,
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridColumn: span ? `span ${span}` : undefined,
      }}
    >
      {children}
    </div>
  );
}

function Card({ children, span }: { children: React.ReactNode; span?: 1 | 2 }) {
  return (
    <div
      style={{
        gridColumn: span ? `span ${span}` : undefined,
        border: "1px solid #EAECF0",
        borderRadius: 14,
        background: "#fff",
        boxShadow: "0 1px 2px rgba(16,24,40,0.06)",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

function CardHeader({
  title,
  meta,
}: {
  title: string;
  meta?: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: 14,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div style={{ fontWeight: 700 }}>{title}</div>
      {meta}
    </div>
  );
}

function CardBody({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: 14 }}>{children}</div>;
}

function Divider() {
  return <div style={{ height: 1, background: "#EAECF0" }} />;
}

type BadgeTone = "neutral" | "primary" | "success" | "warning";
function Badge({
  children,
  variant = "soft",
  tone = "neutral",
}: {
  children: React.ReactNode;
  variant?: "soft" | "outline";
  tone?: BadgeTone;
}) {
  const cfg = badgeStyle(variant, tone);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 999,
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 600,
        lineHeight: "16px",
        ...cfg,
      }}
    >
      {children}
    </span>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <Badge variant="soft">
      {count} {count === 1 ? "item" : "items"}
    </Badge>
  );
}

function Inline({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      {children}
    </span>
  );
}

function StatusDot({ tone }: { tone: "neutral" | "success" | "warning" }) {
  const bg =
    tone === "success" ? "#12B76A" : tone === "warning" ? "#F79009" : "#98A2B3";
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: 999,
        background: bg,
        display: "inline-block",
      }}
    />
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div
      style={{
        border: "1px dashed #D0D5DD",
        borderRadius: 12,
        padding: 12,
        background: "#FCFCFD",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 13 }}>{title}</div>
      {description ? (
        <div style={{ marginTop: 4, color: "#667085", fontSize: 13 }}>
          {description}
        </div>
      ) : null}
    </div>
  );
}

function DefinitionList({
  items,
}: {
  items: { term: string; detail: React.ReactNode }[];
}) {
  return (
    <dl style={{ margin: 0, display: "grid", gap: 10 }}>
      {items.map((it) => (
        <div
          key={it.term}
          style={{
            display: "grid",
            gridTemplateColumns: "160px minmax(0, 1fr)",
            gap: 12,
            alignItems: "baseline",
            paddingBottom: 10,
            borderBottom: "1px solid #F2F4F7",
          }}
        >
          <dt style={{ margin: 0, color: "#667085", fontSize: 13 }}>
            {it.term}
          </dt>
          <dd
            style={{
              margin: 0,
              fontWeight: 600,
              fontSize: 13,
              color: "#101828",
              textAlign: "right",
              wordBreak: "break-word",
            }}
          >
            {it.detail}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ChipList({
  items,
}: {
  items: {
    key: string;
    label: string;
    tone: BadgeTone;
    suffix?: string;
  }[];
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {items.map((it) => (
        <Badge key={it.key} variant="soft" tone={it.tone}>
          <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
            {it.label}
          </span>
          {it.suffix ? <span style={{ marginLeft: 8, opacity: 0.85 }}>• {it.suffix}</span> : null}
        </Badge>
      ))}
    </div>
  );
}

function badgeStyle(
  variant: "soft" | "outline",
  tone: BadgeTone
): React.CSSProperties {
  const tones: Record<BadgeTone, { bg: string; border: string; fg: string }> = {
    neutral: { bg: "#F2F4F7", border: "#EAECF0", fg: "#344054" },
    primary: { bg: "#EEF4FF", border: "#C7D7FE", fg: "#2D5BFF" },
    success: { bg: "#ECFDF3", border: "#ABEFC6", fg: "#027A48" },
    warning: { bg: "#FFFAEB", border: "#FEDF89", fg: "#B54708" },
  };

  const t = tones[tone];

  if (variant === "outline") {
    return {
      background: "#FFFFFF",
      color: t.fg,
      border: `1px solid ${t.border}`,
    };
  }
  return {
    background: t.bg,
    color: t.fg,
    border: `1px solid ${t.border}`,
  };
}

/* -----------------------------
   Formatting helpers
-------------------------------- */

function monthName(month: number) {
  // month expected 1-12
  const names = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];
  const idx = Math.max(1, Math.min(12, month)) - 1;
  return names[idx];
}

function formatPercent(v: number) {
  // Handles both 0.2 and 20 style inputs reasonably
  const n = v > 1 ? v : v * 100;
  return `${n.toFixed(2)}%`;
}
