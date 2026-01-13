import type { CreateCompanyAdminUserDto, CreateCompanyDto, CompanySettingsDto, BranchVm, StoreVm } from "../types";

type Props = {
  company: CreateCompanyDto;
  branches: BranchVm[];
  stores: StoreVm[];
  settings: CompanySettingsDto;
  admin: CreateCompanyAdminUserDto;
};

export default function ReviewSubmit({ company, branches, stores, settings, admin }: Props) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Section title="Company">
        <Kv k="Legal Name" v={company.legalName} />
        <Kv k="Trade Name" v={company.tradeName ?? "-"} />
        <Kv k="Currency" v={company.defaultCurrency} />
        <Kv k="Timezone" v={company.timezone} />
      </Section>

      <Section title="Branches">
        {branches.length === 0 ? <div style={{ color: "#666" }}>No branches added.</div> : (
          <ul>{branches.map(b => <li key={b.id}>{b.code} - {b.name} {b.isMain ? "(Main)" : ""}</li>)}</ul>
        )}
      </Section>

      <Section title="Stores">
        {stores.length === 0 ? <div style={{ color: "#666" }}>No stores added.</div> : (
          <ul>{stores.map(s => <li key={s.id}>{s.code} - {s.name}</li>)}</ul>
        )}
      </Section>

      <Section title="Settings">
        <Kv k="VAT Enabled" v={String(settings.vatEnabled)} />
        <Kv k="VAT Rate" v={String(settings.vatRate)} />
        <Kv k="Prices Include VAT" v={String(settings.pricesIncludeVat)} />
        <Kv k="Invoice Prefix" v={settings.invoicePrefix} />
        <Kv k="Receipt Prefix" v={settings.receiptPrefix} />
        <Kv k="Allow Negative Stock" v={String(settings.allowNegativeStock)} />
        <Kv k="Fiscal Start Month" v={String(settings.fiscalYearStartMonth)} />
      </Section>

      <Section title="Admin User">
        <Kv k="Username" v={admin.userName} />
        <Kv k="Email" v={admin.email} />
        <Kv k="Branch Scope" v={admin.branchId ?? "-"} />
        <Kv k="Store Scope" v={admin.storeId ?? "-"} />
      </Section>
    </div>
  );
}

function Section({ title, children }: any) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}
function Kv({ k, v }: any) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f3f3f3" }}>
      <div style={{ color: "#555" }}>{k}</div>
      <div style={{ fontWeight: 600 }}>{v}</div>
    </div>
  );
}
