import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { companyApi } from "../api/companyApi";
import type { CompanyDto  } from "../types";
import {CompanyStatus} from "../types";

type CompanyUpdateRequest = {
  tradeName?: string | null;
  legalName?: string | null;
  country?: string | null;
  city?: string | null;
  defaultCurrency?: string | null;
  status?: CompanyStatus;
};

export default function CompanyDetailPage() {
  const { companyId } = useParams<{ companyId: string }>();

  const [company, setCompany] = useState<CompanyDto | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<CompanyUpdateRequest>({});

  const hasCompanyId = useMemo(() => !!companyId, [companyId]);

  useEffect(() => {
    if (!companyId) {
      setCompany(null);
      setError("Invalid company.");
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setNotice(null);

    companyApi
      .getCompany(companyId)
      .then((dto) => {
        if (cancelled) return;
        setCompany(dto ?? null);
        setDraft({
          tradeName: dto?.tradeName ?? "",
          legalName: dto?.legalName ?? "",
          country: dto?.country ?? "",
          city: dto?.city ?? "",
          defaultCurrency: dto?.defaultCurrency ?? "",
          status: dto?.status ?? CompanyStatus.Draft
        });
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.response?.data?.message ?? e?.message ?? "Failed to load company");
        setCompany(null);
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  function startEdit() {
    if (!company) return;
    setNotice(null);
    setError(null);
    setIsEditing(true);
    setDraft({
      tradeName: company.tradeName ?? "",
      legalName: company.legalName ?? "",
      country: company.country ?? "",
      city: company.city ?? "",
      defaultCurrency: company.defaultCurrency ?? "",
      status: company.status ?? false,
    });
  }

  function cancelEdit() {
    setError(null);
    setNotice(null);
    setIsEditing(false);
    if (!company) return;
    setDraft({
      tradeName: company.tradeName ?? "",
      legalName: company.legalName ?? "",
      country: company.country ?? "",
      city: company.city ?? "",
      defaultCurrency: company.defaultCurrency ?? "",
      status: company.status ?? false,
    });
  }

  async function save() {
    if (!companyId || !company) return;

    const legalName = (draft.legalName ?? "").toString().trim();
    if (!legalName) {
      setError("Legal name is required.");
      return;
    }

    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      // You implement this in your API layer
      const updated = await companyApi.updateCompany(companyId, {
        tradeName: (draft.tradeName ?? "").toString().trim() || null,
        legalName,
        country: (draft.country ?? "").toString().trim() || null,
        city: (draft.city ?? "").toString().trim() || null,
        defaultCurrency: (draft.defaultCurrency ?? "").toString().trim() || null,
        status: draft.status??CompanyStatus.Draft,
      } as CompanyUpdateRequest);

      setCompany(updated);
      setIsEditing(false);
      setNotice("Company updated successfully.");
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  }

  if (!hasCompanyId) return <div className="page">Invalid company</div>;
  if (isLoading) return <div className="page">Loading company…</div>;
  if (error && !company) {
    return (
      <div className="page">
        <Banner tone="danger" title="Could not load company" message={error} />
      </div>
    );
  }
  if (!company) return <div className="page">Company not found</div>;

  const createdText = company.createdAt ? new Date(company.createdAt).toLocaleDateString() : "—";

  return (
    <div className="page max-w-5xl mx-auto px-2 md:px-0">
      {/* Luxury background */}
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-6 md:px-8 py-6 border-b border-slate-200 bg-white">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className="text-xs tracking-widest uppercase text-slate-500">
                Company Profile
              </div>
              <h1 className="mt-1 text-2xl md:text-3xl font-semibold text-slate-900">
                {company.legalName ?? "—"}
              </h1>
              <div className="mt-1 text-sm text-slate-500">
                Configuration, identity, and operational defaults
              </div>
            </div>

            <div className="flex items-center gap-3">
              <StatusPill active={!!(isEditing ? draft.status : company.status)} />
              {!isEditing ? (
                <button className="btn-lux" onClick={startEdit}>
                  Edit
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button className="btn-lux" onClick={cancelEdit} disabled={isSaving}>
                    Cancel
                  </button>
                  <button className="btn-lux-primary" onClick={save} disabled={isSaving}>
                    {isSaving ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Notices */}
          <div className="mt-4 space-y-2">
            {notice && <Banner tone="success" title="Success" message={notice} />}
            {error && <Banner tone="danger" title="Action required" message={error} />}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 md:px-8 py-6">
          <Section title="General Information" subtitle="Editable company identity and defaults">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field
                label="Display name"
                value={company.tradeName ?? "—"}
                editable={isEditing}
                input={
                  <Input
                    value={(draft.tradeName ?? "") as string}
                    onChange={(v) => setDraft((d) => ({ ...d, tradeName: v }))}
                    placeholder="e.g., RestaurantFNB"
                  />
                }
              />
              <Field
                label="Legal name"
                value={company.legalName ?? "—"}
                editable={isEditing}
                input={
                  <Input
                    value={(draft.legalName ?? "") as string}
                    onChange={(v) => setDraft((d) => ({ ...d, legalName: v }))}
                    placeholder="e.g., RestaurantFNB PLC"
                    required
                  />
                }
              />
              <Field
                label="Country"
                value={company.country ?? "—"}
                editable={isEditing}
                input={
                  <Input
                    value={(draft.country ?? "") as string}
                    onChange={(v) => setDraft((d) => ({ ...d, country: v }))}
                    placeholder="e.g., Ethiopia"
                  />
                }
              />
              <Field
                label="City"
                value={company.city ?? "—"}
                editable={isEditing}
                input={
                  <Input
                    value={(draft.city ?? "") as string}
                    onChange={(v) => setDraft((d) => ({ ...d, city: v }))}
                    placeholder="e.g., Addis Ababa"
                  />
                }
              />
              <Field
                label="Default currency"
                value={company.defaultCurrency ?? "—"}
                editable={isEditing}
                input={
                  <Input
                    value={(draft.defaultCurrency ?? "") as string}
                    onChange={(v) => setDraft((d) => ({ ...d, defaultCurrency: v }))}
                    placeholder="e.g., ETB or USD"
                  />
                }
              />
              <Field
                label="Created"
                value={createdText}
                editable={false}
                input={null}
              />
            </div>

            <div className="mt-5 border-t border-slate-200 pt-5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">Operational Status</div>
                {isEditing ? (
                  <Toggle
                  checked={draft.status === CompanyStatus.Active}
                  onChange={(checked) =>
                    setDraft((d) => ({
                      ...d,
                    status: checked ? CompanyStatus.Active : CompanyStatus.Inactive,
                          }))
                        }
                        leftLabel="Inactive"
                        rightLabel="Active"
                      />

                ) : (
                  <div className="text-sm text-slate-600">
                    {company.status ? "Active" : "Inactive"}
                  </div>
                )}
              </div>
            </div>
          </Section>
          <div className="mt-6" />
          <Section title="Technical" subtitle="Identifiers for support and troubleshooting">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Company ID</div>
              <div className="mt-1 font-mono text-sm text-slate-900 break-all">{company.id}</div>
            </div>
          </Section>
        </div>
      </div>

      {/* Small local styles (keeps it luxury without extra libs) */}
      <style>{`
        .btn-lux{
          border: 1px solid rgb(226 232 240);
          background: white;
          padding: 10px 14px;
          border-radius: 14px;
          font-weight: 700;
          font-size: 14px;
          color: rgb(15 23 42);
          box-shadow: 0 1px 0 rgba(0,0,0,0.02);
        }
        .btn-lux:disabled{ opacity: .55; cursor: not-allowed; }
        .btn-lux-primary{
          border: 1px solid rgb(15 23 42);
          background: rgb(15 23 42);
          padding: 10px 14px;
          border-radius: 14px;
          font-weight: 800;
          font-size: 14px;
          color: white;
          box-shadow: 0 8px 24px rgba(15,23,42,0.18);
        }
        .btn-lux-primary:disabled{ opacity: .55; cursor: not-allowed; box-shadow:none; }
      `}</style>
    </div>
  );
}

/* ===================== UI PIECES ===================== */

function Section(props: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="px-5 py-4 border-b border-slate-200">
        <div className="text-sm font-semibold text-slate-900">{props.title}</div>
        {props.subtitle && <div className="text-xs text-slate-500 mt-1">{props.subtitle}</div>}
      </div>
      <div className="p-5">{props.children}</div>
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  editable: boolean;
  input: React.ReactNode | null;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
      <div className="text-xs font-semibold text-slate-500 mb-1">{props.label}</div>
      {!props.editable ? (
        <div className="text-sm text-slate-900">{props.value}</div>
      ) : (
        props.input
      )}
    </div>
  );
}

function Input(props: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <input
      className={
        "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 " +
        "focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300"
      }
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      aria-required={props.required ? "true" : "false"}
    />
  );
}

function Toggle(props: {
  checked: boolean;
  onChange: (v: boolean) => void;
  leftLabel?: string;
  rightLabel?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {props.leftLabel && <span className="text-xs text-slate-500">{props.leftLabel}</span>}
      <button
        type="button"
        className={
          "relative inline-flex h-7 w-12 items-center rounded-full border transition " +
          (props.checked ? "bg-slate-900 border-slate-900" : "bg-white border-slate-200")
        }
        onClick={() => props.onChange(!props.checked)}
        aria-pressed={props.checked}
      >
        <span
          className={
            "inline-block h-5 w-5 transform rounded-full bg-white shadow transition " +
            (props.checked ? "translate-x-6" : "translate-x-1")
          }
        />
      </button>
      {props.rightLabel && <span className="text-xs text-slate-500">{props.rightLabel}</span>}
    </div>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={
        "px-3 py-1.5 rounded-full text-xs font-extrabold tracking-wide " +
        (active ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-slate-100 text-slate-600 border border-slate-200")
      }
    >
      {active ? "ACTIVE" : "INACTIVE"}
    </span>
  );
}

function Banner(props: { tone: "success" | "danger"; title: string; message: string }) {
  const cls =
    props.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-rose-200 bg-rose-50 text-rose-800";

  return (
    <div className={`rounded-2xl border p-4 ${cls}`}>
      <div className="text-xs font-extrabold tracking-widest uppercase">{props.title}</div>
      <div className="text-sm mt-1">{props.message}</div>
    </div>
  );
}
