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

export default function ReviewSubmitTailwind({
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

  const vatEnabled = !!settings.vatEnabled;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              Review & submit
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Confirm everything below looks right. You can go back to edit before creating the company.
            </p>
          </div>

          {/* Confidence cue / “Checklist” vibe */}
          <div className="mt-3 flex items-center gap-2 sm:mt-0">
            <Pill tone="neutral">Step 5 of 5</Pill>
            <Pill tone="success">Ready to submit</Pill>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Company" meta={<Pill tone="neutral">Required</Pill>}>
          <Dl
            items={[
              { k: "Legal name", v: company.legalName || "—" },
              { k: "Trade name", v: company.tradeName || "—" },
              { k: "Currency", v: company.defaultCurrency || "—" },
              { k: "Timezone", v: company.timezone || "—" },
            ]}
          />
        </Card>

        <Card title="Admin user" meta={<Pill tone="neutral">Access</Pill>}>
          <Dl
            items={[
              { k: "Username", v: admin.userName || "—" },
              { k: "Email", v: admin.email || "—" },
              { k: "Branch scope", v: branchScopeLabel },
              { k: "Store scope", v: storeScopeLabel },
            ]}
          />
        </Card>

        <Card
          title="Branches"
          meta={<Pill tone="neutral">{branches.length} {branches.length === 1 ? "branch" : "branches"}</Pill>}
        >
          {branches.length === 0 ? (
            <EmptyState
              title="No branches added"
              desc="Add at least one branch to organize your company structure."
            />
          ) : (
            <ChipGrid>
              {branches
                .slice()
                .sort((a, b) => Number(!!b.isMain) - Number(!!a.isMain))
                .map((b) => (
                  <Chip key={String(b.id)}>
                    <span className="font-mono text-[12px] text-slate-500">{b.code}</span>
                    <span className="mx-2 h-3 w-px bg-slate-200" />
                    <span className="truncate">{b.name}</span>
                    {b.isMain ? (
                      <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-100">
                        Main
                      </span>
                    ) : null}
                  </Chip>
                ))}
            </ChipGrid>
          )}
        </Card>

        <Card
          title="Stores"
          meta={<Pill tone="neutral">{stores.length} {stores.length === 1 ? "store" : "stores"}</Pill>}
        >
          {stores.length === 0 ? (
            <EmptyState
              title="No stores added"
              desc="Stores are optional. Add them if you want inventory and sales by location."
            />
          ) : (
            <ChipGrid>
              {stores.map((s) => (
                <Chip key={String(s.id)}>
                  <span className="font-mono text-[12px] text-slate-500">{s.code}</span>
                  <span className="mx-2 h-3 w-px bg-slate-200" />
                  <span className="truncate">{s.name}</span>
                </Chip>
              ))}
            </ChipGrid>
          )}
        </Card>

        <Card
          title="Settings"
          meta={
            <div className="flex items-center gap-2">
              <Pill tone={vatEnabled ? "success" : "neutral"}>
                VAT {vatEnabled ? "Enabled" : "Disabled"}
              </Pill>
              <Pill tone="neutral">Defaults</Pill>
            </div>
          }
          className="lg:col-span-2"
        >
          {/* “At-a-glance” row */}
          <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-100 sm:grid-cols-3">
            <Kpi
              label="VAT"
              value={
                <span className="inline-flex items-center gap-2">
                  <Dot tone={vatEnabled ? "success" : "neutral"} />
                  <span className="font-semibold text-slate-900">
                    {vatEnabled ? "Enabled" : "Disabled"}
                  </span>
                </span>
              }
              hint={vatEnabled ? `Rate: ${formatPercent(settings.vatRate)}` : "No VAT rate applied"}
            />
            <Kpi
              label="Prices include VAT"
              value={<Pill tone={settings.pricesIncludeVat ? "success" : "neutral"}>{settings.pricesIncludeVat ? "Yes" : "No"}</Pill>}
              hint={settings.pricesIncludeVat ? "Displayed prices include tax" : "Tax added at checkout/invoice"}
            />
            <Kpi
              label="Negative stock"
              value={<Pill tone={settings.allowNegativeStock ? "warning" : "neutral"}>{settings.allowNegativeStock ? "Allowed" : "Not allowed"}</Pill>}
              hint={settings.allowNegativeStock ? "Can go below zero" : "Stock is enforced"}
            />
          </div>

          {/* Details */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Dl
              items={[
                { k: "VAT rate", v: vatEnabled ? formatPercent(settings.vatRate) : "—" },
                { k: "Invoice prefix", v: settings.invoicePrefix || "—" },
                { k: "Receipt prefix", v: settings.receiptPrefix || "—" },
                { k: "Fiscal year start", v: monthName(settings.fiscalYearStartMonth) },
              ]}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------- UI building blocks (Tailwind) ---------- */

function Card({
  title,
  meta,
  children,
  className = "",
}: {
  title: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        "rounded-2xl border border-slate-200 bg-white shadow-sm",
        className,
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {meta}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function Dl({ items }: { items: { k: string; v: React.ReactNode }[] }) {
  return (
    <dl className="divide-y divide-slate-100">
      {items.map((it) => (
        <div
          key={it.k}
          className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[180px_1fr] sm:items-center sm:gap-4"
        >
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {it.k}
          </dt>
          <dd className="text-sm font-semibold text-slate-900 sm:text-right break-words">
            {it.v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function EmptyState({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      {desc ? <div className="mt-1 text-sm text-slate-600">{desc}</div> : null}
    </div>
  );
}

function ChipGrid({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex max-w-full items-center rounded-full bg-slate-50 px-3 py-1.5 text-sm text-slate-800 ring-1 ring-inset ring-slate-200">
      <span className="truncate">{children}</span>
    </div>
  );
}

type PillTone = "neutral" | "success" | "warning";
function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: PillTone }) {
  const cls =
    tone === "success"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
      : tone === "warning"
      ? "bg-amber-50 text-amber-700 ring-amber-100"
      : "bg-slate-50 text-slate-700 ring-slate-200";

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${cls}`}>
      {children}
    </span>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="text-sm">{value}</div>
      {hint ? <div className="text-xs text-slate-600">{hint}</div> : null}
    </div>
  );
}

function Dot({ tone }: { tone: PillTone | "neutral" }) {
  const cls =
    tone === "success"
      ? "bg-emerald-500"
      : tone === "warning"
      ? "bg-amber-500"
      : "bg-slate-400";
  return <span className={`h-2 w-2 rounded-full ${cls}`} />;
}

/* ---------- Formatting helpers ---------- */

function monthName(month: number) {
  const names = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December",
  ];
  const idx = Math.max(1, Math.min(12, month)) - 1;
  return names[idx];
}

function formatPercent(v: number) {
  const n = v > 1 ? v : v * 100;
  return `${n.toFixed(2)}%`;
}
