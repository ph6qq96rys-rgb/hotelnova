import { useEffect, useMemo, useState } from "react";
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
  CreateBranchDto,
  CreateCompanyAdminUserDto,
  CreateCompanyDto,
  CreateStoreDto,
  StoreVm,
} from "../types";

const labels = ["Company", "Branches", "Stores", "Settings", "Admin User", "Review"] as const;

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

  const canNext = useMemo(() => {
    if (step === 0) return company.legalName.trim().length > 0;
    if (step === 1) return branches.length > 0;
    return true;
  }, [step, company.legalName, branches.length]);

  async function ensureCompanyCreated(): Promise<string> {
    if (companyId) return companyId;
    const created = await companyApi.createCompany(company);
    setCompanyId(created.id);
    return created.id;
  }

  async function refreshBranches(id: string) {
    const b = await companyApi.listBranches(id);
    setBranches(b);
  }

  async function refreshStores(id: string) {
    const s = await companyApi.listStores(id);
    setStores(s);
  }

  async function refreshSettings(id: string) {
    const s = await companyApi.getSettings(id);
    setSettings(s);
  }

  // Step-driven refresh so the UI is always up-to-date when user enters a step.
  useEffect(() => {
    if (!companyId) return;

    if (step === 1) {
      refreshBranches(companyId);
    } else if (step === 2) {
      // Stores depend on branches + company
      refreshBranches(companyId);
      refreshStores(companyId);
    } else if (step === 3) {
      refreshSettings(companyId);
    } else if (step === 4) {
      // Admin form usually needs branches/stores
      refreshBranches(companyId);
      refreshStores(companyId);
    } else if (step === 5) {
      // Review wants everything current
      refreshBranches(companyId);
      refreshStores(companyId);
      refreshSettings(companyId);
    }
  }, [companyId, step]);

  async function next() {
    if (!canNext) return;
    setStep((x) => Math.min(x + 1, labels.length - 1));
  }

  function prev() {
    setStep((x) => Math.max(x - 1, 0));
  }

  async function addBranch(dto: CreateBranchDto) {
    const id = await ensureCompanyCreated();
    await companyApi.addBranch(id, dto);
    await refreshBranches(id);
  }

  async function addStore(dto: CreateStoreDto) {
    const id = await ensureCompanyCreated();
    await companyApi.addStore(id, dto);
    await refreshStores(id);
  }

  async function saveSettings() {
    const id = await ensureCompanyCreated();
    await companyApi.updateSettings(id, settings);
    await refreshSettings(id);
  }

  async function complete() {
    setBusy(true);
    try {
      const id = await ensureCompanyCreated();

      await companyApi.updateSettings(id, settings);
      await companyApi.createCompanyAdmin(id, admin);
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

      <WizardSteps step={step} setStep={setStep} labels={[...labels]} />

      <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
        {step === 0 && <CompanyForm value={company} onChange={setCompany} />}

        {step === 1 && <BranchesForm branches={branches} onAdd={addBranch} />}

        {step === 2 && (
          <StoresForm
            companyId={companyId}
            branches={branches}
            stores={stores}
            onAdd={addStore}
          />
        )}

        {step === 3 && (
          <div style={{ display: "grid", gap: 12 }}>
            <SettingsForm value={settings} onChange={setSettings} />
            <button style={btnGhost} onClick={saveSettings} disabled={busy}>
              Save Settings
            </button>
          </div>
        )}

        {step === 4 && (
          <AdminUserForm
            branches={branches}
            stores={stores}
            value={admin}
            onChange={setAdmin}
          />
        )}

        {step === 5 && (
          <ReviewSubmit
            company={company}
            branches={branches}
            stores={stores}
            settings={settings}
            admin={admin}
          />
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button style={btnGhost} onClick={prev} disabled={step === 0 || busy}>
          Back
        </button>

        {step < labels.length - 1 ? (
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

const btnPrimary: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  background: "#111",
  color: "#fff",
  border: "none",
  cursor: "pointer",
};

const btnGhost: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "#fff",
  cursor: "pointer",
};
