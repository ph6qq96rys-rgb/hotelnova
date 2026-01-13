import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import WizardSteps from "../components/WizardSteps";
import CompanyForm from "../components/CompanyForm";
import BranchesForm from "../components/BranchesForm";
import StoresForm from "../components/StoresForm";
import SettingsForm from "../components/SettingsForm";
import AdminUserForm from "../components/AdminUserForm";
import ReviewSubmit from "../components/ReviewSubmit";
import { companyApi } from "../api/companyApi";
import type {
  BranchVm,
  CompanySettingsDto,
  CreateCompanyAdminUserDto,
  CreateCompanyDto,
  StoreVm
} from "../types";

const labels = ["Company", "Branches", "Stores", "Settings", "Admin User", "Review"];

export default function CompanyOnboardingWizardPage() {
  const nav = useNavigate();

  const [step, setStep] = useState(0);
  const [companyId, setCompanyId] = useState<string>("");

  const [company, setCompany] = useState<CreateCompanyDto>({
    legalName: "",
    tradeName: "",
    tinNumber: "",
    vatNumber: "",
    phone: "",
    email: "",
    country: "Ethiopia",
    city: "",
    addressLine: "",
    defaultCurrency: "ETB",
    timezone: "Africa/Addis_Ababa",
  });

  const [branches, setBranches] = useState<BranchVm[]>([]);
  const [stores, setStores] = useState<StoreVm[]>([]);
  const [settings, setSettings] = useState<CompanySettingsDto>({
    vatEnabled: false,
    vatRate: 0,
    pricesIncludeVat: false,
    invoicePrefix: "INV",
    receiptPrefix: "RCPT",
    allowNegativeStock: false,
    fiscalYearStartMonth: 1,
  });

  const [admin, setAdmin] = useState<CreateCompanyAdminUserDto>({
    userName: "",
    email: "",
    password: "",
  });

  const [busy, setBusy] = useState(false);
  const canNext =
    (step === 0 ? company.legalName.trim().length > 0 : true) &&
    (step === 1 ? branches.length > 0 : true);

  async function ensureCompanyCreated() {
    if (companyId) return companyId;
    const created = await companyApi.createCompany(company);
    setCompanyId(created.id);
    return created.id;
  }

  async function refresh(companyId: string) {
    const [b, s, set] = await Promise.all([
      companyApi.listBranches(companyId),
      companyApi.listStores(companyId),
      companyApi.getSettings(companyId),
    ]);
    setBranches(b);
    setStores(s);
    setSettings(set);
  }

  useEffect(() => {
    if (!companyId) return;
    refresh(companyId);
  }, [companyId]);

  async function next() {
    if (!canNext) return;
    setStep((x) => Math.min(x + 1, labels.length - 1));
  }

  async function prev() {
    setStep((x) => Math.max(x - 1, 0));
  }

  async function addBranch(dto: any) {
    const id = await ensureCompanyCreated();
    await companyApi.addBranch(id, dto);
    await refresh(id);
  }

  async function addStore(dto: any) {
    const id = await ensureCompanyCreated();
    await companyApi.addStore(id, dto);
    await refresh(id);
  }

  async function saveSettings() {
    const id = await ensureCompanyCreated();
    await companyApi.updateSettings(id, settings);
    await refresh(id);
  }

  async function complete() {
    setBusy(true);
    try {
      const id = await ensureCompanyCreated();

      // Save settings
      await companyApi.updateSettings(id, settings);

      // Create company admin
      await companyApi.createCompanyAdmin(id, admin);

      // Activate (seeds defaults + activates in API)
      await companyApi.activateCompany(id);

      nav(`/companies/${id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div>
        <h2 style={{ margin: 0 }}>Company Onboarding</h2>
        <div style={{ color: "#666", fontSize: 13 }}>
          Create company → add branches/stores → configure → create admin → activate
        </div>
      </div>

      <WizardSteps step={step} setStep={setStep} labels={labels} />

      <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
        {step === 0 && <CompanyForm value={company} onChange={setCompany} />}
        {step === 1 && <BranchesForm branches={branches} onAdd={addBranch} />}
        {step === 2 && <StoresForm companyId={companyId} branches={branches} stores={stores} onAdd={addStore} />}
        {step === 3 && (
          <div style={{ display: "grid", gap: 12 }}>
            <SettingsForm value={settings} onChange={setSettings} />
            <button style={btnGhost} onClick={saveSettings} disabled={busy}>
              Save Settings
            </button>
          </div>
        )}
        {step === 4 && <AdminUserForm branches={branches} stores={stores} value={admin} onChange={setAdmin} />}
        {step === 5 && <ReviewSubmit company={company} branches={branches} stores={stores} settings={settings} admin={admin} />}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button style={btnGhost} onClick={prev} disabled={step === 0 || busy}>Back</button>

        {step < 5 ? (
          <button style={btnPrimary} onClick={next} disabled={!canNext || busy}>
            Next
          </button>
        ) : (
          <button style={btnPrimary} onClick={complete} disabled={busy}>
            Complete & Activate
          </button>
        )}
      </div>

      {step === 1 && branches.length === 0 ? (
        <div style={{ color: "crimson", fontSize: 13 }}>
          You must add at least one branch before activating.
        </div>
      ) : null}
    </div>
  );
}

const btnPrimary: React.CSSProperties = { padding: "10px 12px", borderRadius: 10, background: "#111", color: "#fff", border: "none", cursor: "pointer" };
const btnGhost: React.CSSProperties = { padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", background: "#fff", cursor: "pointer" };
