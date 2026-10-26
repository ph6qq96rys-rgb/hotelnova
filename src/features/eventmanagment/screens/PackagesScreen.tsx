import { CateringCommercialEditor } from "./CateringCommercialEditor";
import { Checkbox } from "../../../components/ui/checkbox";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import { CateringItemCostPreview } from "./CateringItemCostPreview";
import { Button } from "../../../components/ui/button";
import { packagePricing } from "./packagePricing";
import { formatAppDateTime } from "../../../shared/datetime/dateFormat";
import { Select } from "../../../components/ui/select";
import { CateringItemRecipeEditor } from "./CateringItemRecipeEditor";
import { StateMessage } from "../../../components/ui/Feedback";
import "../pages/catering-interactions.css";
import { CatalogCollection } from "./CatalogCollection";
import { CatalogWorkflow } from "./CatalogWorkflow";
import "./package-catalog.css";
import { useDialogFocus } from "../components/useDialogFocus";
import { useEffect, useMemo, useRef, useState } from "react";
import { http } from "../../../api/http";
import { useAuth } from "../../../auth/AuthProvider";
import { readApiError } from "../sales/ui";
import { formatCurrency as money } from "../../../shared/currency/currencyFormat";
import { useUnsavedChanges } from "../components/useUnsavedChanges";
import { WORKFLOW_LABEL, workflowTone, type WorkflowStatus } from "./packageWorkflow";
type Line = { name?: string; itemId: string; quantity: number; perGuest: boolean; additionalCharge: number };
type Section = {
  name: string;
  rule: string;
  selectCount: number;
  substitutionRequiresApproval: boolean;
  items: Line[];
};
export type Offering = {
  pricingSource?: string;
  category: string;
  serviceTier: string;
  pricingMode: string;
  fixedPrice: number;
  taxPercent: number;
  serviceChargePercent: number;
  approvedMarginPercent: number;
  effectiveDate: string | null;
  expiryDate: string | null;
  companyWide: boolean;
  archived: boolean;
  imageUrl: string | null;
  customerDescription: string | null;
  inclusions: string | null;
  exclusions: string | null;
  terms: string | null;
  notes: string | null;
  sections: Section[];
  /** Cost-based pricing: the share of the selling price the package cost may take. */
  targetCostPercent?: number | null;
  costingGuests?: number | null;
  priceRoundingStep?: number;
  priceOverridden?: boolean;
  calculatedCost?: number | null;
  calculatedPrice?: number | null;
  pricedAtUtc?: string | null;
};
export type CateringPackage = {
  id?: string;
  branchId: string;
  packageNo?: string;
  name: string;
  description: string | null;
  pricePerPerson: number;
  minimumGuests: number | null;
  maximumGuests: number | null;
  isActive: boolean;
  sections: {
    menuItems: {
      menuItemId: string;
      menuItemName?: string;
      quantityPerGuest: number;
      isOptional: boolean;
      sortOrder: number;
    }[];
  }[];
  offering: Offering | null;
  catalogVersion: number;
  changeReason?: string;
  packageCode?: string;
  /** Latest revision an approver signed off; the package is approved only while it equals catalogVersion. */
  approvedVersion?: number | null;
  approvedAtUtc?: string | null;
  isApproved?: boolean;
  workflowStatus?: WorkflowStatus;
  lastAction?: string | null;
  workflowNote?: string | null;
  lastActionBy?: string | null;
  lastActionByName?: string | null;
  lastActionAtUtc?: string | null;
};
type Item = {
  companyId?: string;
  visibilityScope?: string | null;
  updatedAt?: string | null;
  id?: string;
  branchId: string | null;
  code: string;
  name: string;
  description: string | null;
  itemType: string;
  estimatedUnitCost: number;
  sellingPrice: number;
  isActive: boolean;
  recipeId: string | null;
  inventoryItemId: string | null;
  uomId: string | null;
  supplierId: string | null;
  consumptionLocationId?: string | null;
};
type Resource = { id: string; name: string; baseUomId?: string; itemType?: string; units?: string[] };
const freshSection = (): Section => ({
  name: "Main courses",
  rule: "All",
  selectCount: 1,
  substitutionRequiresApproval: false,
  items: [],
});
const STEPS = ["Details", "Menu", "Costing & price", "Guest experience", "Review & submit"];
const PRICE_METHODS: [string, string, string][] = [
  ["CostPercent", "Target cost %", "Price = package cost ÷ target cost %. Follows your costs. Recommended."],
  ["MenuItems", "Catering item prices", "Adds up each item's own selling price."],
  ["Manual", "Manual price", "You type the package price."],
];
const ROUNDING_STEPS = [0.01, 0.05, 0.1, 0.5, 1, 5, 10, 50, 100];
const GUEST_FIELD_LABEL: Record<string, string> = {
  customerDescription: "Description for the customer",
  imageUrl: "Image URL (https)",
  inclusions: "What is included",
  exclusions: "What is not included",
  terms: "Terms",
  notes: "Internal notes",
};
const freshOffering = (): Offering => ({
  pricingSource: "CostPercent",
  targetCostPercent: 35,
  priceRoundingStep: 1,
  category: "Lunch",
  serviceTier: "Custom",
  pricingMode: "PerPerson",
  fixedPrice: 0,
  taxPercent: 15,
  serviceChargePercent: 0,
  approvedMarginPercent: 30,
  effectiveDate: null,
  expiryDate: null,
  companyWide: false,
  archived: false,
  imageUrl: null,
  customerDescription: null,
  inclusions: null,
  exclusions: null,
  terms: null,
  notes: null,
  sections: [freshSection()],
});
export function PackagesScreen({ companyId, branchId }: { companyId: string; branchId: string }) {
  const { hasPermission, roles, permissions, isSystemAdmin } = useAuth();
  const manageCompanyCatalog = isSystemAdmin || roles.some(role => role.trim().toLowerCase() === "companyadmin") ||
    permissions.some(permission => ["company.fullaccess", "company.admin", "system.fullaccess"].includes(permission.trim().toLowerCase()));
  const manage = hasPermission("catering.manage"),
    approve = hasPermission("catering.approve");
  const base = "/companies/" + companyId + "/catering",
    catalog = base + "/catalog";
  const [rows, setRows] = useState<CateringPackage[]>([]),
    [items, setItems] = useState<Item[]>([]),
    [rawResources, setResources] = useState<Record<string, Resource[]>>({});
  const resources = useMemo<Record<string, Resource[]>>(() => {
    const byName = (a: Resource, b: Resource) =>
      a.name.trim().localeCompare(b.name.trim(), undefined, { sensitivity: "base", numeric: true }) ||
      a.id.localeCompare(b.id);
    return {
      ...rawResources,
      inventory: [...(rawResources.inventory ?? [])].sort(byName),
      recipes: [...(rawResources.recipes ?? [])].sort(byName),
    };
  }, [rawResources]);
  const [draft, setDraft] = useState<CateringPackage | null>(null),
    [item, setItem] = useState<Item | null>(null),
    [tab, setTab] = useState("packages"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  const [recipeItem, setRecipeItem] = useState<Item | null>(null);
  const [catalogView, setCatalogView] = useState<"workflow" | "catalog">("workflow");
  const [removeItemPrompt, setRemoveItemPrompt] = useState<Item | null>(null);
  const [approvePrompt, setApprovePrompt] = useState<CateringPackage | null>(null);
  const [returnPrompt, setReturnPrompt] = useState<CateringPackage | null>(null);
  const [deletePrompt, setDeletePrompt] = useState<CateringPackage | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [step, setStep] = useState(0);
  const [submitNote, setSubmitNote] = useState("");
  const [versionConflict, setVersionConflict] = useState(false);
  const [commercialItem,setCommercialItem] = useState<Item|null>(null);
  const [itemSearch, setItemSearch] = useState("");
  const [undo, setUndo] = useState<{ offering: Offering; message: string } | null>(null);
  const requestScope = useRef(0);
  const [loading, setLoading] = useState(true),
    [success, setSuccess] = useState("");
  const [guests, setGuests] = useState(100),
    [report, setReport] = useState<Record<string, unknown> | null>(null),
    [history, setHistory] = useState<
      { version: number; action: string; reason: string; createdAt: string; createdBy: string }[] | null
    >(null);
  useEffect(() => {
    if (report || history)
      document.getElementById(report ? "pk-estimate" : "pk-history")?.scrollIntoView({ block: "start" });
  }, [report, history]);
  useEffect(() => {
    if (!draft) {
      setVersionConflict(false);
      setUndo(null);
      setItemSearch("");
    }
  }, [draft]);
  useEffect(() => setRecipeItem(null), [companyId, branchId]);
  const guard = useUnsavedChanges(!!draft || !!item);
  useDialogFocus(!!draft || !!item, busy, () => {
    if (guard.confirmDiscard()) {
      setDraft(null);
      setItem(null);
    }
  });
  useEffect(() => {
    const scope = ++requestScope.current;
    const c = new AbortController();
    setVersionConflict(false);
    setDraft(null);
    setItem(null);
    setError("");
    setLoading(true);
    if (!branchId) {
      setLoading(false);
      return;
    }
    Promise.all([
      http.get(base + "/packages", { params: { branchId, includeInactive: true }, signal: c.signal }),
      http.get(catalog + "/items", { params: { branchId }, signal: c.signal }),
      http.get(catalog + "/resources", { params: { branchId }, signal: c.signal }),
    ])
      .then(([p, i, r]) => {
        if (c.signal.aborted || scope !== requestScope.current) return;
        setRows(p.data);
        setItems(i.data);
        setResources(r.data);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(readApiError(e));
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [companyId, branchId, revision]);
  async function run(action: () => Promise<unknown>, reload = true) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
      if (reload) {
        setRevision((x) => x + 1);
        setSuccess("Your changes have been saved.");
      }
    } catch (e) {
      setError(readApiError(e));
    } finally {
      setBusy(false);
    }
  }
  async function openPackage(id: string, reload = false) {
    if (busy || (reload && !guard.confirmDiscard())) return;
    const scope = requestScope.current;
    setBusy(true);
    setError("");
    try {
      const { data } = await http.get<CateringPackage>(base + "/packages/" + id);
      if (scope !== requestScope.current) return;
      if (!Number.isInteger(data.catalogVersion))
        throw new Error("Package version is unavailable. Refresh the app after restarting the API.");
      setRows((rows) => rows.map((row) => (row.id === id ? data : row)));
      setDraft({ ...data, changeReason: "", offering: { ...(data.offering ?? freshOffering()), pricingSource: data.offering?.pricingSource ?? "Manual" } });
      setStep(0);
      setSubmitNote("");
      setVersionConflict(false);
    } catch (e) {
      if (scope === requestScope.current) setError(readApiError(e, "Unable to load the latest package."));
    } finally {
      setBusy(false);
    }
  }
  const change = (p: Partial<CateringPackage>) => {
    setUndo(null);
    setDraft((d) => (d ? { ...d, ...p } : d));
  };
  const offering = (p: Partial<Offering>) => change({ offering: { ...draft!.offering!, ...p } });
  const section = (n: number, p: Partial<Section>) =>
    offering({ sections: draft!.offering!.sections.map((s, i) => (i === n ? { ...s, ...p } : s)) });
  const line = (n: number, j: number, p: Partial<Line>) =>
    section(n, { items: draft!.offering!.sections[n].items.map((x, i) => (i === j ? { ...x, ...p } : x)) });
  function removeLine(n: number, j: number) {
    const before = draft!.offering!;
    section(n, { items: before.sections[n].items.filter((_, i) => i !== j) });
    setUndo({ offering: before, message: "Item removed from this package." });
  }
  function removeSection(n: number) {
    const before = draft!.offering!;
    offering({ sections: before.sections.filter((_, i) => i !== n) });
    setUndo({ offering: before, message: "Section removed from this package." });
  }
  /** What stops a step from being complete, if anything. */
  function stepProblem(n: number): string | null {
    if (!draft?.offering) return null;
    const o = draft.offering;
    if (n === 0) {
      if (!draft.name.trim()) return "Enter the package name.";
      if (!o.category.trim()) return "Enter the package category.";
      if (draft.minimumGuests != null && draft.maximumGuests != null && draft.minimumGuests > draft.maximumGuests)
        return "The minimum guests cannot be more than the maximum.";
    }
    if (n === 1 && (!o.sections.length || o.sections.some((x) => !x.items.length || x.items.some((l) => !l.itemId))))
      return "Add at least one catering item to every section, and remove any unused sections.";
    if (n === 2 && o.pricingSource === "CostPercent") {
      const t = o.targetCostPercent;
      if (t == null || t < 5 || t > 95) return "Set a target cost between 5% and 95%.";
      if (o.priceOverridden && !(draft.changeReason ?? "").trim()) return "Say why the calculated price is overridden.";
    }
    return null;
  }
  function goTo(n: number, checkCurrent = false) {
    const problem = checkCurrent ? stepProblem(step) : null;
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    setStep(n);
  }
  async function persist(submit: boolean) {
    if (!draft || busy || versionConflict) return;
    for (const n of [0, 1, 2]) {
      const problem = stepProblem(n);
      if (problem) {
        setError(problem);
        setStep(n);
        return;
      }
    }
    setBusy(true);
    setError("");
    try {
      if (draft.id && !Number.isInteger(draft.catalogVersion)) {
        setVersionConflict(true);
        setError("Package version is missing. Load the latest version before saving.");
        return;
      }
      const payload = { ...draft, changeReason: draft.changeReason?.trim() || null, expectedVersion: draft.catalogVersion, sections: [] };
      const { data } = await (draft.id
        ? http.put<CateringPackage>(base + "/packages/" + draft.id, payload)
        : http.post<CateringPackage>(base + "/packages", payload));
      guard.markSaved();
      setDraft(null);
      setVersionConflict(false);
      setRevision((x) => x + 1);
      if (!submit) {
        setSuccess("Package saved as a draft. Submit it for approval when it is ready to quote.");
        return;
      }
      try {
        await http.post(catalog + "/packages/" + data.id + "/submit", { reason: submitNote.trim() || null, expectedVersion: data.catalogVersion });
        setSuccess(`${data.name} was submitted for approval.`);
      } catch (e) {
        setError("The package was saved as a draft but not submitted: " + readApiError(e));
      }
    } catch (e) {
      const failure = e as { response?: { status?: number; data?: { code?: string } } };
      if (
        failure.response?.data?.code === "PackageVersionConflict" ||
        failure.response?.data?.code === "PackageVersionRequired" ||
        failure.response?.data?.code === "RecordChanged"
      )
        setVersionConflict(true);
      setError(readApiError(e));
    } finally {
      setBusy(false);
    }
  }
  const freshItem = (): Item => ({
    branchId: manageCompanyCatalog ? null : branchId,
    visibilityScope: manageCompanyCatalog ? "COMPANY" : "BRANCH",
    code: "",
    name: "",
    description: null,
    itemType: "Food",
    estimatedUnitCost: 0,
    sellingPrice: 0,
    isActive: true,
    recipeId: null,
    inventoryItemId: null,
    uomId: null,
    supplierId: null,
    consumptionLocationId: null,
  });
  const estimateGuests = Math.max(1, guests);
  const included =
    draft?.offering?.sections.flatMap((s) =>
      s.rule === "AddOn" ? [] : s.rule === "Choose" ? s.items.slice(0, s.selectCount) : s.items,
    ) ?? [];
  type LivePricing = { calculatedCost?: number | null; calculatedPrice?: number | null; costingGuests?: number | null; pricePerPerson: number; fixedPrice: number; priceOverridden?: boolean };
  const [liveCost, setLiveCost] = useState<{
    key: string; totalCost: number; missingCostCount: number; sellingPrice?: number; error?: string; warnings?: string[];
    pricing?: LivePricing | null; aboveTargetCost?: boolean;
    items?: { name: string; unitCost: number; costComplete?: boolean }[];
  } | null>(null);
  const costingKey = JSON.stringify({ branchId, guests: estimateGuests, pricePerPerson: draft?.pricePerPerson ?? 0, minimumGuests: draft?.minimumGuests ?? null, offering: draft?.offering });
  useEffect(() => {
    if (!draft?.offering || stepProblem(1)) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      http.post(catalog + "/packages/draft-estimate", JSON.parse(costingKey), { signal: controller.signal })
        .then((r) => { if (!controller.signal.aborted) setLiveCost({ key: costingKey, ...r.data }); })
        .catch((e) => { if (!controller.signal.aborted) setLiveCost({ key: costingKey, totalCost: 0, missingCostCount: 1, error: readApiError(e) }); });
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, costingKey]);
  const liveReady = liveCost?.key === costingKey && !liveCost.error;
  const pricing = liveReady ? liveCost!.pricing ?? null : null;
  const source = draft?.offering?.pricingSource ?? "Manual";
  const costingGuests = Math.max(1, draft?.offering?.costingGuests ?? draft?.minimumGuests ?? 1);
  const draftCost = liveReady ? liveCost!.totalCost : 0;
  const extraCharges = included.reduce((sum, l) => sum + l.additionalCharge * (l.perGuest ? estimateGuests : 1), 0);
  const menuItemsBase =
    included.reduce(
      (sum, l) => sum + (items.find((i) => i.id === l.itemId)?.sellingPrice ?? 0) * l.quantity * (l.perGuest ? Math.max(1, draft?.minimumGuests ?? 1) : 1),
      0,
    ) / (draft?.offering?.pricingMode === "Fixed" ? 1 : Math.max(1, draft?.minimumGuests ?? 1));
  /** The price per person (or per package) the package is sold at, as the server will save it. */
  const effectivePrice =
    source === "MenuItems"
      ? menuItemsBase
      : source === "CostPercent" && !draft?.offering?.priceOverridden
        ? (draft?.offering?.pricingMode === "Fixed" ? pricing?.fixedPrice : pricing?.pricePerPerson) ?? 0
        : draft?.offering?.pricingMode === "Fixed" ? draft.offering.fixedPrice : (draft?.pricePerPerson ?? 0);
  const localSale =
    (source === "MenuItems"
      ? included.reduce((sum, l) => sum + (items.find((i) => i.id === l.itemId)?.sellingPrice ?? 0) * l.quantity * (l.perGuest ? estimateGuests : 1), 0)
      : draft?.offering?.pricingMode === "Fixed" ? effectivePrice : effectivePrice * estimateGuests) + extraCharges;
  const draftSale = liveReady && liveCost!.sellingPrice != null ? liveCost!.sellingPrice : localSale;
  const draftMargin = draftSale > 0 ? ((draftSale - draftCost) / draftSale) * 100 : 0;
  const draftPricing = packagePricing(draftSale, draft?.offering?.taxPercent ?? 0, draft?.offering?.serviceChargePercent ?? 0);
  const missingCosts = liveReady ? liveCost!.missingCostCount : liveCost?.key === costingKey ? 1 : 0;
  /** Included items that have no cost from stock, receipts, default cost or the catering item itself. */
  const uncosted = liveReady
    ? [...new Set((liveCost!.items ?? []).filter((x) => x.costComplete === false || !(x.unitCost > 0)).map((x) => x.name))]
    : [];
  const belowTarget =
    liveReady && missingCosts === 0 && draftSale > 0 &&
    (source === "CostPercent" ? !!liveCost!.aboveTargetCost : draftMargin < (draft?.offering?.approvedMarginPercent ?? 0));
  const reviewChecks: { label: string; ok: boolean; blocking: boolean; step: number }[] = draft?.offering
    ? [
        { label: "Name, category and guest limits are filled in", ok: !stepProblem(0), blocking: true, step: 0 },
        { label: "Every menu section has catering items", ok: !stepProblem(1), blocking: true, step: 1 },
        {
          label: liveReady && missingCosts > 0 && uncosted.length
            ? `No cost yet for: ${uncosted.join(", ")}`
            : liveReady ? "Every included item has a cost" : "Checking item costs…",
          ok: liveReady && missingCosts === 0, blocking: true, step: 1,
        },
        { label: source === "CostPercent" ? "Target cost is set" + (draft.offering.priceOverridden ? " and the override is explained" : "") : "Pricing is set", ok: !stepProblem(2), blocking: true, step: 2 },
        { label: "A selling price is set", ok: effectivePrice > 0, blocking: true, step: 2 },
        {
          label: source === "CostPercent" ? `Cost stays within the ${draft.offering.targetCostPercent ?? "—"}% target at ${estimateGuests} guests` : `Margin meets the approved ${draft.offering.approvedMarginPercent}% at ${estimateGuests} guests`,
          ok: !belowTarget, blocking: false, step: 2,
        },
        { label: "The customer description is written", ok: !!draft.offering.customerDescription?.trim(), blocking: false, step: 3 },
      ]
    : [];
  /** One line about where the package is in the approval workflow. */
  function workflowBanner(p: CateringPackage) {
    const by = p.lastActionByName ? ` by ${p.lastActionByName}` : "";
    const when = p.lastActionAtUtc ? ` on ${formatAppDateTime(p.lastActionAtUtc)}` : "";
    const note = (p.workflowNote ?? "").trim().replace(/[.!\s]+$/, "");
    switch (p.workflowStatus) {
      case "Returned":
        return `Returned for changes${by}${when}: “${note}”. Make the changes, save, and submit again.`;
      case "PendingApproval":
        return `Submitted for approval${by}${when}${note ? `: “${note}”` : ""}. Saving changes takes it back to draft.`;
      case "Approved":
        return `Revision ${p.catalogVersion} is approved and can be quoted. Saving creates a new revision that needs approval again.`;
      case "Archived":
        return "This package is archived and cannot be quoted.";
      default:
        return p.approvedVersion
          ? `Draft. Revision ${p.approvedVersion} was the last approved one; these changes have not been submitted.`
          : "Draft. Submit it for approval when it is ready to quote.";
    }
  }

  function newRecord(kind = tab) {
    setError("");
    setSuccess("");
    setStep(0);
    setSubmitNote("");
    if (kind === "items") setItem(freshItem());
    else
      setDraft({
        branchId,
        name: "",
        description: null,
        pricePerPerson: 0,
        minimumGuests: 1,
        maximumGuests: null,
        isActive: false,
        sections: [],
        offering: freshOffering(),
        catalogVersion: 0,
      });
  }
  async function packageAction(r: CateringPackage, action: string, confirmed = false) {
    // Approval is confirmed in the app's own dialog (no browser confirm box).
    if (action === "approve" && !confirmed) {
      setApprovePrompt(r);
      return;
    }
    if (action === "delete" && !confirmed) {
      setDeletePrompt(r);
      return;
    }
    if (action === "return" && !confirmed) {
      setReturnReason("");
      setReturnPrompt(r);
      return;
    }
    await run(
      async () => {
        const url = catalog + "/packages/" + r.id + "/" + action;
        if (action === "estimate")
          setReport({
            ...(await http.post(url, { guests, branchId })).data,
            guestCount: guests,
            packageName: r.name,
            minimumGuests: r.minimumGuests,
            maximumGuests: r.maximumGuests,
          });
        else if (action === "history") setHistory((await http.get(url)).data);
        else if (action === "return") await http.post(url, { expectedVersion: r.catalogVersion, reason: returnReason.trim() });
        else if (action === "delete") await http.delete(base + "/packages/" + r.id, { params: { expectedVersion: r.catalogVersion } });
        else await http.post(url, ["approve", "submit"].includes(action) ? { expectedVersion: r.catalogVersion } : undefined);
      },
      action !== "estimate" && action !== "history",
    );
  }
  async function removeItem(value: Item) {
    if (!value.id || busy) return;
    setRemoveItemPrompt(value);
  }
  return (
    <section className="co-workspace pk-workspace">
      {!branchId && <p className="co-notice">Select a branch to manage its catering catalog.</p>}
      {error && !draft && !item && <StateMessage tone="error">{error}</StateMessage>}
      {success && (
        <div className="pk-success ci-feedback" role="status">
          <span>{success}</span>
          <Button variant="outline" aria-label="Dismiss success message" onClick={() => setSuccess("")}>
            Dismiss
          </Button>
        </div>
      )}
      <nav className="pk-flow-view" aria-label="Menus and packages view">
        <Button variant={catalogView === "workflow" ? "default" : "outline"} aria-pressed={catalogView === "workflow"} onClick={() => setCatalogView("workflow")}>Workflow</Button>
        <Button variant={catalogView === "catalog" ? "default" : "outline"} aria-pressed={catalogView === "catalog"} onClick={() => setCatalogView("catalog")}>Catalog</Button>
      </nav>
      {catalogView === "workflow" ? <CatalogWorkflow key={`${companyId}:${branchId}`}
        rows={rows} items={items} loading={loading} busy={busy} manage={manage} approve={approve}
        branchId={branchId} guests={guests} setGuests={setGuests} onNew={newRecord}
        onEdit={id => void openPackage(id)} onRefresh={() => setRevision(x => x + 1)}
        onBrowseItems={() => { setTab("items"); setCatalogView("catalog"); }}
        onItem={value => { setError(""); if (value.companyId && value.companyId !== companyId) setCommercialItem(value); else setItem(value); }}
        onAction={(row, action) => void packageAction(row, action)}
      /> : <CatalogCollection
        companyId={companyId??undefined}
        onRecipe={manage && hasPermission("recipes.manage") ? value => { if(value.companyId && value.companyId!==companyId) setCommercialItem(value); else setRecipeItem(value); } : undefined}
        rows={rows}
        items={items}
        tab={tab}
        setTab={setTab}
        loading={loading}
        busy={busy}
        manage={manage}
        approve={approve}
        branchId={branchId}
        guests={guests}
        setGuests={setGuests}
        onNew={() => newRecord()}
        onRefresh={() => setRevision((x) => x + 1)}
        onEdit={(id) => void openPackage(id)}
        onItem={(value) => {
          setError("");
          if(value.companyId && value.companyId!==companyId) setCommercialItem(value); else setItem(value);
        }}
        onRemoveItem={(value) => void removeItem(value)}
        onAction={(r, action) => void packageAction(r, action)}
        onSeed={(kind) => void run(() => http.post(base + "/packages/" + kind, { branchId }))}
      />}
      {report && (
        <section id="pk-estimate" className="co-card pk-estimate" aria-label="Package cost estimate">
          {(report.warnings as string[] | undefined)?.map((w) => (
            <p key={w} role="alert" className="co-notice">{w}</p>
          ))}
          {Number(report.missingCostCount) > 0 && (
            <p role="alert" className="co-notice">
              Some items have no estimated cost. Complete their costs before relying on this margin.
            </p>
          )}
          <h2>
            {String(report.packageName)} — estimated cost for {Number(report.guestCount)} guests
          </h2>
          {((report.minimumGuests != null && Number(report.guestCount) < Number(report.minimumGuests)) ||
            (report.maximumGuests != null && Number(report.guestCount) > Number(report.maximumGuests))) && (
            <p role="alert" className="co-notice">
              This package is sold for {String(report.minimumGuests ?? 1)}–{String(report.maximumGuests ?? "unlimited")} guests.
              A quotation for {Number(report.guestCount)} guests will be refused.
            </p>
          )}
          <p>Choice sections use their first options for this preview; final quotations use the selected items.</p>
          <div className="pk-estimate-grid">
            {["foodCost", "serviceCost", "totalCost", "sellingPrice", "grossProfit", "tax", "serviceCharge", "grandTotal"].map(
              (k) => (
                <p key={k}>
                  {k === "grandTotal" ? "Total menu price including VAT & service charge" : k === "tax" ? "VAT" : k === "sellingPrice" ? "Menu subtotal" : k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}:{" "}
                  <strong>{money(k === "grandTotal" ? Number(report.sellingPrice) + Number(report.serviceCharge) + Number(report.tax) : Number(report[k]))}</strong>
                </p>
              ),
            )}
          </div>
          <p>
            Margin: {Number(report.margin).toFixed(1)}%
            {report.costPercent != null && <> · Cost share: {Number(report.costPercent).toFixed(1)}%</>}
            {report.targetCostPercent != null && <> · Target cost: {Number(report.targetCostPercent)}%</>}
          </p>
          {!!report.aboveTargetCost && (
            <p role="alert" className="co-notice">
              At {Number(report.guestCount)} guests the cost is above the {Number(report.targetCostPercent)}% target.
              Costs may have risen since the price was set — edit the package to recalculate the price.
            </p>
          )}
          <div className="pk-suggested-price">
            <div>
              <small>Suggested selling price before tax & service charge</small>
              <strong>
                {report.targetCostPercent != null
                  ? report.costTargetSellingPrice == null ? "Complete costing" : money(Number(report.costTargetSellingPrice))
                  : report.suggestedSellingPrice == null
                  ? "Complete costing and set a margin below 100%"
                  : money(Number(report.suggestedSellingPrice))}
              </strong>
              {report.targetCostPercent != null && report.costTargetSellingPrice != null && (
                <p>
                  {money(Number(report.costTargetSellingPrice) / Number(report.guestCount))} per person at today's costs ·{" "}
                  {Number(report.targetCostPercent)}% target cost
                </p>
              )}
              {report.targetCostPercent == null && report.suggestedPricePerPerson != null && (
                <p>
                  {money(Number(report.suggestedPricePerPerson))} per person · {Number(report.targetMarginPercent)}%
                  target margin
                </p>
              )}
            </div>
          </div>
          {!!report.belowApprovedMargin && (
            <p role="alert" className="co-notice">
              Below the approved margin. Review the package price or costs.
            </p>
          )}
          <div className="co-table-wrap"><table><thead><tr><th>Item</th><th>Required portions</th><th>Batches</th><th>Recipe version</th><th>Batch cost</th><th>Production cost</th><th>Cost basis</th></tr></thead><tbody>{(report.items as {itemId:string;name:string;quantity:number;requiredBatches?:number;recipeVersion?:number;batchCost?:number;productionCost?:number;unitCost:number;costComplete?:boolean;costBasis?:string}[]??[]).map((line,index)=><tr key={line.itemId+index}><td>{line.name}</td><td>{line.quantity}</td><td>{line.requiredBatches??'—'}</td><td>{line.recipeVersion??'—'}</td><td>{line.batchCost!=null?money(line.batchCost):'—'}</td><td>{line.costComplete===false?'Incomplete':money(line.productionCost??line.quantity*line.unitCost)}</td><td>{line.costBasis??'—'}</td></tr>)}</tbody></table></div>
          <p>Production cost per guest: {Number(report.missingCostCount)>0?'Incomplete':money(Number(report.totalCost)/Number(report.guestCount))}</p>
          <Button variant="outline" onClick={() => setReport(null)}>Close estimate</Button>
        </section>
      )}
      {history && (
        <section id="pk-history" className="co-card">
          <h2>Package audit history</h2>
          {!history.length && <p>No revision history is available for this package.</p>}
          {history.map((h) => (
            <p key={h.version}>
              v{h.version} · {h.action} · {formatAppDateTime(h.createdAt)} · {h.createdBy} · {h.reason}
            </p>
          ))}
          <Button variant="outline" onClick={() => setHistory(null)}>Close history</Button>
        </section>
      )}
      {draft && (
        <div className="co-modal-backdrop">
          <section className="co-modal pk-builder" role="dialog" aria-modal="true" aria-label="Package builder">
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void persist(false);
              }}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                  e.preventDefault();
                  if (!busy) void persist(false);
                }
              }}
            >
              <header className="co-toolbar">
                <div className="pk-builder-title">
                  <h2>{draft.id ? draft.name || "Edit package" : "New package"}</h2>
                  {draft.id && (
                    <span className={`pk-wf pk-wf--${workflowTone(draft.workflowStatus)}`}>
                      {WORKFLOW_LABEL[draft.workflowStatus ?? "Draft"] ?? draft.workflowStatus}
                    </span>
                  )}
                </div>
                <Button variant="outline"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (guard.confirmDiscard()) setDraft(null);
                  }}
                >
                  Close
                </Button>
              </header>
              <ol className="pk-stepper" aria-label="Package builder steps">
                {STEPS.map((label, i) => (
                  <li key={label}>
                    <Button variant="bare"
                      type="button"
                      aria-current={i === step ? "step" : undefined}
                      className={stepProblem(i) && i < step ? "has-problem" : i < step ? "is-done" : ""}
                      onClick={() => goTo(i)}
                    >
                      <span aria-hidden="true">{i < step && !stepProblem(i) ? "✓" : i + 1}</span>
                      {label}
                    </Button>
                  </li>
                ))}
              </ol>
              {draft.id && workflowBanner(draft) && (
                <p className={`pk-wf-banner pk-wf-banner--${workflowTone(draft.workflowStatus)}`} role="note">
                  {workflowBanner(draft)}
                </p>
              )}
              {undo && (
                <div className="ci-undo" role="status">
                  <span>{undo.message}</span>
                  <Button variant="outline" type="button" disabled={busy} onClick={() => offering(undo.offering)}>
                    Undo removal
                  </Button>
                </div>
              )}
              {liveCost?.key === costingKey && liveCost.error && step >= 1 && <p role="alert" className="co-notice">{liveCost.error}</p>}
              {liveCost?.key === costingKey && step >= 1 && liveCost.warnings?.map((w) => <p key={w} role="alert" className="co-notice">{w}</p>)}

              <fieldset disabled={busy || !manage}>
                {step === 0 && (
                  <section className="pk-editor-section" id="pk-details">
                    <h3>Package details</h3>
                    <p>Name the package, say who it is for and when it can be sold. New packages start inactive until you are ready to offer them.</p>
                    <div className="co-form-grid">
                      <label>
                        Name
                        <Input
                          required
                          autoFocus
                          maxLength={150}
                          value={draft.name}
                          onChange={(e) => change({ name: e.target.value })}
                        />
                      </label>
                      <label>
                        Code
                        <Input
                          maxLength={40}
                          disabled={!!draft.id}
                          placeholder="Automatic if blank"
                          value={draft.packageCode ?? draft.packageNo ?? ""}
                          onChange={(e) => change({ packageCode: e.target.value })}
                        />
                      </label>
                      <label>
                        Category
                        <Input
                          required
                          list="catering-categories"
                          value={draft.offering!.category}
                          onChange={(e) => offering({ category: e.target.value })}
                        />
                        <datalist id="catering-categories">
                          {["Breakfast", "Lunch", "Dinner", "Coffee Break", "Cocktail", "Wedding"].map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </datalist>
                      </label>
                      <label>
                        Service tier
                        <Select
                          value={draft.offering!.serviceTier}
                          onChange={(e) => offering({ serviceTier: e.target.value })}
                        >
                          {["Bronze", "Gold", "Premium", "Custom"].map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </Select>
                      </label>
                      {(["minimumGuests", "maximumGuests"] as const).map((k) => (
                        <label key={k}>
                          {k === "minimumGuests" ? "Minimum guests" : "Maximum guests"}
                          <Input
                            type="number"
                            min="1"
                            placeholder={k === "maximumGuests" ? "No limit" : undefined}
                            value={draft[k] ?? ""}
                            onChange={(e) => change({ [k]: e.target.value ? Number(e.target.value) : null })}
                          />
                        </label>
                      ))}
                      {(["effectiveDate", "expiryDate"] as const).map((k) => (
                        <label key={k}>
                          {k === "effectiveDate" ? "Available from" : "Available until"}
                          <Input
                            type="date"
                            value={draft.offering![k]?.slice(0, 10) ?? ""}
                            onChange={(e) => offering({ [k]: e.target.value ? e.target.value + "T00:00:00Z" : null })}
                          />
                        </label>
                      ))}
                      <label>
                        Status
                        <Select
                          value={draft.offering!.archived ? "Archived" : draft.isActive ? "Active" : "Inactive"}
                          onChange={(e) =>
                            change({
                              isActive: e.target.value === "Active",
                              offering: { ...draft.offering!, archived: e.target.value === "Archived" },
                            })
                          }
                        >
                          {["Active", "Inactive", "Archived"].map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </Select>
                      </label>
                      {(manageCompanyCatalog || draft.offering!.companyWide) && (
                        <label className="co-check">
                          <Checkbox
                            checked={draft.offering!.companyWide}
                            disabled={!manageCompanyCatalog}
                            onChange={(e) => offering({ companyWide: e.target.checked })}
                          />
                          Available to every branch (company-wide)
                        </label>
                      )}
                    </div>
                  </section>
                )}
                {step === 1 && (
                  <section className="pk-editor-section" id="pk-composition">
                    <h3>Menu</h3>
                    <div className="ci-composition-tools">
                      <label>
                        Find catering items
                        <Input
                          type="search"
                          value={itemSearch}
                          placeholder="Search by name or item code…"
                          onChange={(e) => setItemSearch(e.target.value)}
                        />
                      </label>
                      <span>
                        {draft.offering!.sections.length} sections ·{" "}
                        {draft.offering!.sections.reduce((n, s) => n + s.items.length, 0)} item entries ·{" "}
                        cost {missingCosts > 0 ? "incomplete" : money(draftCost)} for {estimateGuests} guests
                      </span>
                    </div>
                    {uncosted.length > 0 && (
                      <p role="alert" className="co-notice">
                        No cost yet for {uncosted.join(", ")}. Under Catering items, link each to a recipe or stock
                        item. If the stock has never been received, set a default cost on the inventory item or an
                        estimated cost on the catering item. Nothing is taken from stock until a package is sold and issued.
                      </p>
                    )}
                    <p>
                      Organise courses, guest choices and optional extras. Choice sections are costed on their most
                      expensive options, so any guest selection stays within the target cost; optional add-ons are not
                      part of the package price.
                    </p>
                    {draft.offering!.sections.map((s, n) => (
                      <section className="co-editor-section" key={n}>
                        <div className="co-form-grid">
                          <label>
                            Section name
                            <Input required value={s.name} onChange={(e) => section(n, { name: e.target.value })} />
                          </label>
                          <label>
                            Selection rule
                            <Select value={s.rule} onChange={(e) => section(n, { rule: e.target.value })}>
                              <option value="All">Include all</option>
                              <option value="Choose">Choose a set number</option>
                              <option value="AddOn">Optional add-ons</option>
                            </Select>
                          </label>
                          {s.rule === "Choose" && (
                            <label>
                              Select count
                              <Input
                                type="number"
                                min="1"
                                max={s.items.length}
                                value={s.selectCount}
                                onChange={(e) => section(n, { selectCount: Number(e.target.value) })}
                              />
                            </label>
                          )}
                          <label className="co-check">
                            <Checkbox
                              checked={s.substitutionRequiresApproval}
                              onChange={(e) => section(n, { substitutionRequiresApproval: e.target.checked })}
                            />
                            Substitutions require approval
                          </label>
                        </div>
                        {!s.items.length && (
                          <p className="ci-help">
                            This section is empty. Use “+ Catering item” below to start building the menu.
                          </p>
                        )}
                        {s.items.map((l, j) => (
                          <div className="co-menu-line" key={j}>
                            <label>
                              Catering item
                              <Select required value={l.itemId} onChange={(e) => line(n, j, { itemId: e.target.value })}>
                                <option value="">Select catering item</option>
                                {l.itemId && !items.some((i) => i.id === l.itemId && i.isActive) && (
                                  <option value={l.itemId}>{l.name ?? "Existing item"} (inactive)</option>
                                )}
                                {items
                                  .filter(
                                    (i) =>
                                      i.isActive &&
                                      (!draft.offering!.companyWide || !i.branchId) &&
                                      (i.id === l.itemId ||
                                        (i.name + " " + i.code).toLowerCase().includes(itemSearch.trim().toLowerCase())),
                                  )
                                  .map((i) => (
                                    <option
                                      key={i.id}
                                      value={i.id}
                                      disabled={s.items.some((other, k) => k !== j && other.itemId === i.id)}
                                    >
                                      {i.name}
                                    </option>
                                  ))}
                              </Select>
                            </label>
                            <label>
                              Quantity
                              <Input
                                required
                                type="number"
                                min=".001"
                                step=".001"
                                value={l.quantity}
                                onChange={(e) => line(n, j, { quantity: Number(e.target.value) })}
                              />
                            </label>
                            <label>
                              Scaling
                              <Select
                                value={l.perGuest ? "guest" : "fixed"}
                                onChange={(e) => line(n, j, { perGuest: e.target.value === "guest" })}
                              >
                                <option value="guest">Per guest</option>
                                <option value="fixed">Fixed quantity</option>
                              </Select>
                            </label>
                            <label>
                              Extra charge ({l.perGuest ? "per guest" : "fixed"})
                              <Input
                                type="number"
                                min="0"
                                step=".01"
                                value={l.additionalCharge}
                                onChange={(e) => line(n, j, { additionalCharge: Number(e.target.value) })}
                              />
                            </label>
                            <Button variant="outline"
                              type="button"
                              aria-label={"Remove " + (items.find((i) => i.id === l.itemId)?.name ?? "catering item")}
                              onClick={() => removeLine(n, j)}
                            >
                              Remove
                            </Button>
                            <div className="pk-line-cost">
                              <span>
                                Item selling price:{" "}
                                <strong>{money(items.find((i) => i.id === l.itemId)?.sellingPrice ?? 0)}</strong>
                              </span>
                              <span>
                                Unit cost:{" "}
                                <strong>{money(items.find((i) => i.id === l.itemId)?.estimatedUnitCost ?? 0)}</strong>
                              </span>
                              <span>
                                Cost for {l.quantity * (l.perGuest ? estimateGuests : 1)} units:{" "}
                                <strong>
                                  {money(
                                    (items.find((i) => i.id === l.itemId)?.estimatedUnitCost ?? 0) *
                                      l.quantity *
                                      (l.perGuest ? estimateGuests : 1),
                                  )}
                                </strong>
                              </span>
                              {s.rule === "AddOn" && <span>Optional · excluded from base estimate</span>}
                            </div>
                          </div>
                        ))}
                        <div className="co-actions">
                          <Button variant="outline"
                            type="button"
                            onClick={() =>
                              section(n, {
                                items: [...s.items, { itemId: "", quantity: 1, perGuest: true, additionalCharge: 0 }],
                              })
                            }
                          >
                            + Catering item
                          </Button>
                          <Button variant="outline"
                            type="button"
                            disabled={n === 0}
                            onClick={() => {
                              const next = [...draft.offering!.sections];
                              [next[n - 1], next[n]] = [next[n], next[n - 1]];
                              offering({ sections: next });
                            }}
                          >
                            Move up
                          </Button>
                          <Button variant="outline"
                            type="button"
                            disabled={n === draft.offering!.sections.length - 1}
                            onClick={() => {
                              const next = [...draft.offering!.sections];
                              [next[n], next[n + 1]] = [next[n + 1], next[n]];
                              offering({ sections: next });
                            }}
                          >
                            Move down
                          </Button>
                          <Button variant="outline" type="button" onClick={() => removeSection(n)}>
                            Remove section
                          </Button>
                        </div>
                      </section>
                    ))}
                    <Button variant="outline"
                      type="button"
                      onClick={() => offering({ sections: [...draft.offering!.sections, freshSection()] })}
                    >
                      + Section
                    </Button>
                  </section>
                )}
                {step === 2 && (
                  <section className="pk-editor-section" id="pk-commercial">
                    <h3>Costing & selling price</h3>
                    <p>
                      Choose how the selling price is set. With a target cost, the price is the package cost divided by
                      the share of the price the cost may take — for example a 35% target turns a cost of 35 into a
                      price of 100.
                    </p>
                    <div className="pk-method" role="radiogroup" aria-label="How the selling price is set">
                      {PRICE_METHODS.map(([value, title, help]) => (
                        <Button
                          key={value}
                          type="button"
                          variant="bare"
                          role="radio"
                          aria-checked={source === value}
                          className={`pk-method-option${source === value ? " is-selected" : ""}`}
                          onClick={() =>
                            offering({
                              pricingSource: value,
                              priceOverridden: false,
                              ...(value === "CostPercent" && !draft.offering!.targetCostPercent ? { targetCostPercent: 35 } : {}),
                            })
                          }
                        >
                          <strong>{title}</strong>
                          <small>{help}</small>
                        </Button>
                      ))}
                    </div>
                    <div className="co-form-grid">
                      <label>
                        Charge
                        <Select value={draft.offering!.pricingMode} onChange={(e) => offering({ pricingMode: e.target.value })}>
                          <option value="PerPerson">Per person</option>
                          <option value="Fixed">One price for the package</option>
                        </Select>
                      </label>
                      {source === "CostPercent" && (
                        <>
                          <label>
                            Target cost (% of selling price)
                            <Input
                              type="number"
                              min="5"
                              max="95"
                              step="0.5"
                              value={draft.offering!.targetCostPercent ?? ""}
                              onChange={(e) => offering({ targetCostPercent: e.target.value === "" ? null : Number(e.target.value) })}
                            />
                            <span className="pk-chips" role="group" aria-label="Common targets">
                              {[25, 30, 35, 40].map((v) => (
                                <Button key={v} type="button" variant="outline" size="sm"
                                  aria-pressed={draft.offering!.targetCostPercent === v}
                                  onClick={() => offering({ targetCostPercent: v })}>{v}%</Button>
                              ))}
                            </span>
                          </label>
                          <label>
                            Cost it for (guests)
                            <Input
                              type="number"
                              min="1"
                              value={draft.offering!.costingGuests ?? draft.minimumGuests ?? 1}
                              onChange={(e) => offering({ costingGuests: e.target.value ? Math.max(1, Math.floor(Number(e.target.value))) : null })}
                            />
                            <small>Fixed-quantity items are spread over this many guests. Defaults to the minimum guests.</small>
                          </label>
                          <label>
                            Round the price up to
                            <Select
                              value={String(draft.offering!.priceRoundingStep ?? 1)}
                              onChange={(e) => offering({ priceRoundingStep: Number(e.target.value) })}
                            >
                              {ROUNDING_STEPS.map((s) => (
                                <option key={s} value={String(s)}>{s === 0.01 ? "The nearest cent" : `The next ${money(s)}`}</option>
                              ))}
                            </Select>
                          </label>
                        </>
                      )}
                      {(source === "Manual" || (source === "CostPercent" && draft.offering!.priceOverridden)) && (
                        <label>
                          {draft.offering!.pricingMode === "Fixed" ? "Package price" : "Price per person"}
                          <Input type="number" min="0" step="0.01"
                            value={draft.offering!.pricingMode === "Fixed" ? draft.offering!.fixedPrice : draft.pricePerPerson}
                            onChange={(e) => draft.offering!.pricingMode === "Fixed"
                              ? offering({ fixedPrice: Number(e.target.value) })
                              : change({ pricePerPerson: Number(e.target.value) })} />
                        </label>
                      )}
                      {source === "MenuItems" && (
                        <label>
                          Calculated price (at minimum guests)
                          <Input readOnly value={money(menuItemsBase)} />
                          <small>Each item's selling price × quantity. Final quotations use the chosen options and add-ons.</small>
                        </label>
                      )}
                      {(["taxPercent", "serviceChargePercent"] as const).map((k) => (
                        <label key={k}>
                          {k === "taxPercent" ? "VAT (%)" : "Service charge (%)"}
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step=".01"
                            value={draft.offering![k]}
                            onChange={(e) => offering({ [k]: Number(e.target.value) })}
                          />
                        </label>
                      ))}
                      {source !== "CostPercent" && (
                        <label>
                          Approved margin (%)
                          <Input type="number" min="0" max="100" step=".01"
                            value={draft.offering!.approvedMarginPercent}
                            onChange={(e) => offering({ approvedMarginPercent: Number(e.target.value) })} />
                        </label>
                      )}
                    </div>
                    {source === "CostPercent" && (
                      <div className="pk-calc" aria-live="polite" aria-label="Price calculation">
                        <div>
                          <small>Package cost for {pricing?.costingGuests ?? costingGuests} guests</small>
                          <strong>{pricing?.calculatedCost != null ? money(pricing.calculatedCost) : "Incomplete"}</strong>
                          {pricing?.calculatedCost != null && (
                            <span>{money(pricing.calculatedCost / Math.max(1, pricing.costingGuests ?? costingGuests))} per guest</span>
                          )}
                        </div>
                        <b aria-hidden="true">÷</b>
                        <div>
                          <small>Target cost</small>
                          <strong>{draft.offering!.targetCostPercent ?? "—"}%</strong>
                          <span>of the selling price</span>
                        </div>
                        <b aria-hidden="true">=</b>
                        <div className="pk-calc-result">
                          <small>Suggested selling price</small>
                          <strong>
                            {pricing?.calculatedPrice != null ? money(pricing.calculatedPrice) : liveReady ? "Complete item costs" : "Calculating…"}
                          </strong>
                          <span>
                            per {draft.offering!.pricingMode === "Fixed" ? "package" : "person"}, before VAT and service charge,
                            rounded up
                          </span>
                        </div>
                      </div>
                    )}
                    {source === "CostPercent" && missingCosts > 0 && liveReady && (
                      <p role="alert" className="co-notice">
                        {missingCosts} included item entries have no cost yet, so no price can be calculated. Add their
                        costs (or recipes) under Catering items.
                      </p>
                    )}
                    {source === "CostPercent" && approve && (
                      <label className="co-check pk-override">
                        <Checkbox
                          checked={!!draft.offering!.priceOverridden}
                          onChange={(e) =>
                            change({
                              offering: { ...draft.offering!, priceOverridden: e.target.checked,
                                ...(e.target.checked && draft.offering!.pricingMode === "Fixed" && pricing?.calculatedPrice != null ? { fixedPrice: pricing.calculatedPrice } : {}) },
                              ...(e.target.checked && draft.offering!.pricingMode !== "Fixed" && pricing?.calculatedPrice != null ? { pricePerPerson: pricing.calculatedPrice } : {}),
                            })
                          }
                        />
                        Set a different selling price (manager override)
                      </label>
                    )}
                    {source === "CostPercent" && draft.offering!.priceOverridden && (
                      <label className="pk-wide">
                        Why is the calculated price overridden?
                        <Textarea
                          required
                          maxLength={1000}
                          value={draft.changeReason ?? ""}
                          onChange={(e) => change({ changeReason: e.target.value })}
                        />
                      </label>
                    )}
                    <p className="pk-pricing-help">
                      {source === "CostPercent"
                        ? approve
                          ? "Catering sales can change the target cost; the price follows it. Overrides, VAT, service charge and extra-charge changes on an existing package are for catering managers."
                          : "The price follows the cost calculation. A catering manager can override it, and approves every package before it can be quoted."
                        : !approve && draft.id
                          ? "Changing the price of an existing package needs a catering manager and a reason. Use a target cost to let the price follow the cost."
                          : "Every revision needs a catering manager's approval before it can be quoted."}
                    </p>
                    <div className="pk-cost-summary">
                      <label>
                        Check the price for
                        <Input
                          type="number"
                          min="1"
                          value={guests}
                          onChange={(e) => setGuests(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
                        />
                        guests
                      </label>
                      <div>
                        <small>Cost</small>
                        <strong>{missingCosts > 0 ? "Incomplete" : money(draftCost)}</strong>
                      </div>
                      <div>
                        <small>Menu subtotal</small>
                        <strong>{money(draftSale)}</strong>
                      </div>
                      <div>
                        <small>Cost share</small>
                        <strong>{draftSale > 0 && missingCosts === 0 ? `${((draftCost / draftSale) * 100).toFixed(1)}%` : "—"}</strong>
                      </div>
                      <div>
                        <small>Gross margin</small>
                        <strong>{draftSale > 0 && missingCosts === 0 ? `${draftMargin.toFixed(1)}%` : "—"}</strong>
                      </div>
                      <div aria-live="polite">
                        <small>Customer pays (VAT {draft.offering!.taxPercent}%, service {draft.offering!.serviceChargePercent}%)</small>
                        <strong>{money(draftPricing.total)}</strong>
                        {draft.offering!.pricingMode !== "Fixed" && <small>{money(draftPricing.total / estimateGuests)} per person</small>}
                      </div>
                    </div>
                    {belowTarget && (
                      <p role="alert" className="co-notice">
                        {source === "CostPercent"
                          ? `At ${estimateGuests} guests the cost takes more than the ${draft.offering!.targetCostPercent}% target. Fixed-quantity items cost more per guest at smaller events.`
                          : `Below the approved margin of ${draft.offering!.approvedMarginPercent}%. Review the price or the costs.`}
                      </p>
                    )}
                  </section>
                )}
                {step === 3 && (
                  <section className="pk-editor-section" id="pk-presentation">
                    <h3>Guest experience</h3>
                    <p>Describe the menu, what is included and the terms your customer will receive on the quotation.</p>
                    <div className="co-form-grid">
                      <label>
                        Internal description
                        <Textarea
                          maxLength={1000}
                          value={draft.description ?? ""}
                          onChange={(e) => change({ description: e.target.value })}
                        />
                      </label>
                      {(["customerDescription", "imageUrl", "inclusions", "exclusions", "terms", "notes"] as const).map(
                        (k) => (
                          <label key={k}>
                            {GUEST_FIELD_LABEL[k]}
                            <Textarea
                              value={draft.offering![k] ?? ""}
                              onChange={(e) => offering({ [k]: e.target.value })}
                            />
                          </label>
                        ),
                      )}
                    </div>
                  </section>
                )}
                {step === 4 && (
                  <section className="pk-editor-section" id="pk-review">
                    <h3>Review & submit</h3>
                    <p>
                      Check the package, then submit it to a catering manager. Once approved it can be quoted; any later
                      change creates a new revision that needs approval again.
                    </p>
                    <ul className="pk-checklist">
                      {reviewChecks.map((c) => (
                        <li key={c.label} className={c.ok ? "is-ok" : c.blocking ? "is-bad" : "is-warn"}>
                          <span aria-hidden="true">{c.ok ? "✓" : "!"}</span>
                          <span>{c.label}</span>
                          {!c.ok && (
                            <Button variant="link" type="button" onClick={() => setStep(c.step)}>
                              Fix in {STEPS[c.step]}
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                    <dl className="pk-review">
                      <div><dt>Package</dt><dd>{draft.name || "—"}<small>{draft.offering!.category} · {draft.offering!.serviceTier}</small></dd></div>
                      <div><dt>Menu</dt><dd>{draft.offering!.sections.length} sections<small>{draft.offering!.sections.reduce((n, s) => n + s.items.length, 0)} item entries</small></dd></div>
                      <div><dt>Guests</dt><dd>{draft.minimumGuests ?? 1}–{draft.maximumGuests ?? "no limit"}</dd></div>
                      <div><dt>Pricing</dt><dd>{PRICE_METHODS.find(([v]) => v === source)?.[1]}<small>{source === "CostPercent" ? `${draft.offering!.targetCostPercent ?? "—"}% target cost${draft.offering!.priceOverridden ? " · price overridden" : ""}` : ""}</small></dd></div>
                      <div><dt>Selling price</dt><dd>{effectivePrice > 0 ? money(effectivePrice) : "Not set"}<small>per {draft.offering!.pricingMode === "Fixed" ? "package" : "person"}, before VAT and service charge</small></dd></div>
                      <div><dt>Customer pays</dt><dd>{money(packagePricing(effectivePrice, draft.offering!.taxPercent, draft.offering!.serviceChargePercent).total)}<small>with VAT {draft.offering!.taxPercent}% and service {draft.offering!.serviceChargePercent}%</small></dd></div>
                      <div><dt>Cost share</dt><dd>{draftSale > 0 && missingCosts === 0 ? `${((draftCost / draftSale) * 100).toFixed(1)}%` : "—"}<small>at {estimateGuests} guests</small></dd></div>
                      <div><dt>Availability</dt><dd>{draft.offering!.archived ? "Archived" : draft.isActive ? "Active" : "Inactive"}<small>{draft.offering!.effectiveDate ? `from ${draft.offering!.effectiveDate.slice(0, 10)}` : "from now"}{draft.offering!.expiryDate ? ` until ${draft.offering!.expiryDate.slice(0, 10)}` : ""}</small></dd></div>
                    </dl>
                    <div className="co-form-grid">
                      <label>
                        Note for the approver (optional)
                        <Textarea maxLength={1000} value={submitNote} onChange={(e) => setSubmitNote(e.target.value)} />
                      </label>
                      {!draft.offering!.priceOverridden && (
                        <label>
                          Change note for the history (optional)
                          <Textarea maxLength={1000} value={draft.changeReason ?? ""} onChange={(e) => change({ changeReason: e.target.value })} />
                        </label>
                      )}
                    </div>
                  </section>
                )}
              </fieldset>
              {error && <StateMessage tone="error">{error}</StateMessage>}
              {versionConflict && (
                <div className="co-notice">
                  <p>Your draft is still here. Loading the latest version will ask before discarding it.</p>
                  <Button variant="outline" type="button" disabled={busy} onClick={() => void openPackage(draft.id!, true)}>
                    Load latest version
                  </Button>
                </div>
              )}
              <footer className="pk-stepper-footer">
                <Button variant="outline" type="button" disabled={busy || step === 0} onClick={() => setStep(step - 1)}>
                  Back
                </Button>
                <span className="pk-spacer" />
                <Button variant="outline" type="submit" disabled={busy || !manage || versionConflict}>
                  {busy ? "Saving…" : "Save draft"}
                </Button>
                {step < STEPS.length - 1 ? (
                  <Button type="button" className="co-primary" disabled={busy} onClick={() => goTo(step + 1, true)}>
                    Next: {STEPS[step + 1]}
                  </Button>
                ) : (
                  <Button type="button" className="co-primary" disabled={busy || !manage || versionConflict || reviewChecks.some((c) => c.blocking && !c.ok)}
                    onClick={() => void persist(true)}>
                    Save and submit for approval
                  </Button>
                )}
              </footer>
            </form>
          </section>
        </div>
      )}
      {recipeItem && (
        <CateringItemRecipeEditor
          companyId={companyId}
          branchId={branchId}
          item={recipeItem}
          resources={resources}
          onClose={() => setRecipeItem(null)}
          onSaved={() => {
            setRecipeItem(null);
            setRevision((x) => x + 1);
            setSuccess("Catering recipe saved as a new revision.");
          }}
        />
      )}
      {approvePrompt && (
        <div className="co-modal-backdrop">
          <section className="co-modal pk-dialog" role="dialog" aria-modal="true" aria-label="Approve package">
            <header className="co-toolbar">
              <h2>Approve package</h2>
              <Button variant="outline" type="button" disabled={busy} onClick={() => setApprovePrompt(null)}>Close</Button>
            </header>
            <p>
              Approve <strong>{approvePrompt.name}</strong> revision {approvePrompt.catalogVersion}? Once approved it
              can be quoted to customers.
            </p>
            {approvePrompt.workflowStatus === "PendingApproval" && (
              <p className="pk-pricing-help">
                Submitted{approvePrompt.lastActionByName ? ` by ${approvePrompt.lastActionByName}` : ""}
                {approvePrompt.workflowNote ? `: “${approvePrompt.workflowNote}”` : "."}
              </p>
            )}
            <dl className="pk-review">
              <div><dt>Pricing</dt><dd>{PRICE_METHODS.find(([v]) => v === (approvePrompt.offering?.pricingSource ?? "Manual"))?.[1]}
                <small>{approvePrompt.offering?.pricingSource === "CostPercent" ? `${approvePrompt.offering.targetCostPercent}% target cost${approvePrompt.offering.priceOverridden ? " · manager override" : ""}` : `${approvePrompt.offering?.approvedMarginPercent ?? 0}% approved margin`}</small></dd></div>
              <div><dt>Selling price</dt><dd>{money(approvePrompt.offering?.pricingMode === "Fixed" ? approvePrompt.offering.fixedPrice : approvePrompt.pricePerPerson)}
                <small>per {approvePrompt.offering?.pricingMode === "Fixed" ? "package" : "person"}, before VAT ({approvePrompt.offering?.taxPercent ?? 0}%) and service ({approvePrompt.offering?.serviceChargePercent ?? 0}%)</small></dd></div>
              {approvePrompt.offering?.calculatedCost != null && (
                <div><dt>Cost at pricing</dt><dd>{money(approvePrompt.offering.calculatedCost)}
                  <small>for {approvePrompt.offering.costingGuests} guests{approvePrompt.offering.calculatedPrice != null ? ` · calculated price ${money(approvePrompt.offering.calculatedPrice)}` : ""}</small></dd></div>
              )}
            </dl>
            <p className="pk-pricing-help">Use Cost & margin on the package card to check today's costs before approving.</p>
            <div className="co-actions">
              <Button variant="outline" disabled={busy} onClick={() => setApprovePrompt(null)}>Cancel</Button>
              <Button
                disabled={busy}
                onClick={() => {
                  const target = approvePrompt;
                  setApprovePrompt(null);
                  void packageAction(target, "approve", true);
                }}
              >
                Approve package
              </Button>
            </div>
          </section>
        </div>
      )}
      {deletePrompt && (
        <div className="co-modal-backdrop">
          <section className="co-modal pk-dialog" role="dialog" aria-modal="true" aria-label="Delete package">
            <header className="co-toolbar">
              <h2>Delete package</h2>
              <Button variant="outline" type="button" disabled={busy} onClick={() => setDeletePrompt(null)}>Close</Button>
            </header>
            <p>
              Delete <strong>{deletePrompt.name}</strong> ({deletePrompt.packageNo}) and its revision history? This
              cannot be undone.
            </p>
            <p className="pk-pricing-help">
              A package that has been quoted cannot be deleted; set its status to Archived instead so its quotations keep
              their history. The catering items in it are not affected.
            </p>
            <div className="co-actions">
              <Button variant="outline" disabled={busy} onClick={() => setDeletePrompt(null)}>Cancel</Button>
              <Button
                className="pk-danger"
                disabled={busy}
                onClick={() => {
                  const target = deletePrompt;
                  setDeletePrompt(null);
                  void packageAction(target, "delete", true);
                }}
              >
                Delete package
              </Button>
            </div>
          </section>
        </div>
      )}
      {returnPrompt && (
        <div className="co-modal-backdrop">
          <section className="co-modal pk-dialog" role="dialog" aria-modal="true" aria-label="Return package for changes">
            <header className="co-toolbar">
              <h2>Return for changes</h2>
              <Button variant="outline" type="button" disabled={busy} onClick={() => setReturnPrompt(null)}>Close</Button>
            </header>
            <p>
              Send <strong>{returnPrompt.name}</strong> back to{" "}
              {returnPrompt.lastActionByName ?? "the person who submitted it"}. It cannot be quoted until it is changed
              and approved.
            </p>
            <label className="pk-wide">
              What needs to change?
              <Textarea autoFocus maxLength={1000} value={returnReason} onChange={(e) => setReturnReason(e.target.value)} />
            </label>
            <div className="co-actions">
              <Button variant="outline" disabled={busy} onClick={() => setReturnPrompt(null)}>Cancel</Button>
              <Button
                disabled={busy || returnReason.trim().length < 5}
                onClick={() => {
                  const target = returnPrompt;
                  setReturnPrompt(null);
                  void packageAction(target, "return", true);
                }}
              >
                Return package
              </Button>
            </div>
          </section>
        </div>
      )}
      {removeItemPrompt && (
        <div className="co-modal-backdrop">
          <section className="co-modal pk-dialog" role="dialog" aria-modal="true" aria-label="Remove catering item">
            <header className="co-toolbar">
              <h2>Remove catering item</h2>
              <Button variant="outline" type="button" disabled={busy} onClick={() => setRemoveItemPrompt(null)}>Close</Button>
            </header>
            <p>Remove <strong>{removeItemPrompt.name}</strong> from the catering catalog? This cannot be undone.</p>
            <div className="co-actions">
              <Button variant="outline" disabled={busy} onClick={() => setRemoveItemPrompt(null)}>Cancel</Button>
              <Button disabled={busy} onClick={() => void run(async () => {
                await http.delete(catalog + "/items/" + removeItemPrompt.id);
                setRemoveItemPrompt(null);
              })}>{busy ? "Removing…" : "Remove catering item"}</Button>
            </div>
          </section>
        </div>
      )}
      {commercialItem && companyId && branchId && <CateringCommercialEditor companyId={companyId} branchId={branchId} item={commercialItem} locations={resources.consumptionLocations??[]} onClose={()=>setCommercialItem(null)} onSaved={()=>setRevision(x=>x+1)}/> }
      {item && (
        <div className="co-modal-backdrop">
          <section className="co-modal" role="dialog" aria-modal="true" aria-label="Catering item editor">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await (item.id ? http.put(catalog + "/items/" + item.id, item) : http.post(catalog + "/items", item));
                  guard.markSaved();
                  setItem(null);
                });
              }}
            >
              <header className="co-toolbar">
                <h2>Catering item</h2>
                <Button variant="outline"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (guard.confirmDiscard()) setItem(null);
                  }}
                >
                  Close
                </Button>
              </header>
              {item.id && approve && <Button type="button" onClick={()=>{setCommercialItem(item);setItem(null);}}>Branch pricing and company access</Button>}
              <fieldset disabled={busy || !manage}>
                <div className="co-form-grid">
                  {(["name", "code", "description"] as const).map((k) => (
                    <label key={k}>
                      {k === "name" ? "Name" : k === "code" ? "Code" : "Description"}
                      <Input
                        required={k !== "description"}
                        value={item[k] ?? ""}
                        onChange={(e) => setItem({ ...item, [k]: e.target.value })}
                      />
                    </label>
                  ))}
                  <label>
                    Type
                    <Select value={item.itemType} onChange={(e) => setItem({ ...item, itemType: e.target.value })}>
                      {[
                        "Food",
                        "Beverage",
                        "BulkProduction",
                        "Service",
                        "Equipment",
                        "Staffing",
                        "Transport",
                        "Decoration",
                        "Custom",
                      ].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </Select>
                  </label>
                  {(["estimatedUnitCost", "sellingPrice"] as const)
                    .filter((k) => k !== "estimatedUnitCost" || (!item.recipeId && !item.inventoryItemId))
                    .map((k) => (
                      <label key={k}>
                        {k === "sellingPrice" ? "Selling price" : "Manual estimated cost (unlinked items only)"}
                        <Input
                          disabled={k === "estimatedUnitCost" && !!(item.recipeId || item.inventoryItemId)}
                          required
                          type="number"
                          min="0"
                          step=".01"
                          value={item[k]}
                          onChange={(e) => setItem({ ...item, [k]: Number(e.target.value) })}
                        />
                      </label>
                    ))}
                  {(["recipeId", "inventoryItemId", "uomId", "supplierId"] as const).map((k, n) => (
                    <label key={k}>
                      {["Recipe / production recipe", "Inventory item", "Unit of measure", "Supplier"][n]}
                      <Select
                        value={item[k] ?? ""}
                        onChange={(e) =>
                          setItem({
                            ...item,
                            [k]: e.target.value || null,
                            ...(k === "inventoryItemId"
                              ? { uomId: resources.inventory?.find((x) => x.id === e.target.value)?.baseUomId ?? null }
                              : {}),
                          })
                        }
                      >
                        <option value="">None</option>
                        {(resources[["recipes", "inventory", "units", "suppliers"][n]] ?? [])
                          .filter(
                            (r) =>
                              k !== "uomId" ||
                              !item.inventoryItemId ||
                              r.id === resources.inventory?.find((x) => x.id === item.inventoryItemId)?.baseUomId ||
                              resources.inventory?.find((x) => x.id === item.inventoryItemId)?.units?.includes(r.id),
                          )
                          .map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                      </Select>
                    </label>
                  ))}
                  <label>
                    Consumption location
                    <Select
                      required
                      value={item.consumptionLocationId ?? ""}
                      onChange={(e) => setItem({ ...item, consumptionLocationId: e.target.value || null })}
                    >
                      <option value="">Select consumption location</option>
                      {(resources.consumptionLocations ?? []).map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                    </Select>
                    <small>
                      Ingredients are reserved from this branch location. Company-wide items require this location to be
                      authorized in each event branch.
                    </small>
                  </label>
                  <CateringItemCostPreview
                    companyId={companyId}
                    request={{
                      branchId: branchId,
                      consumptionLocationId: item.consumptionLocationId,
                      recipeId: item.recipeId,
                      inventoryItemId: item.inventoryItemId,
                      uomId: item.uomId,
                    }}
                  />
                  <label className="co-check">
                    <Checkbox
                      checked={item.isActive}
                      onChange={(e) => setItem({ ...item, isActive: e.target.checked })}
                    />
                    Active
                  </label>
                  <label>Visibility<Select disabled={!manageCompanyCatalog} value={item.visibilityScope ?? (item.branchId?'BRANCH':'COMPANY')} onChange={e=>setItem({...item,visibilityScope:e.target.value,branchId:e.target.value==='BRANCH'?branchId:null})}><option value="BRANCH">This branch</option><option value="COMPANY">All company branches</option><option value="SHARED_COMPANIES">Selected companies in this tenant</option></Select>
                    {!manageCompanyCatalog && <small>Company-wide visibility and shared item editing require a company administrator. Cost previews use the selected branch.</small>}
                  </label>
                </div>
              </fieldset>
              {error && <p role="alert">{error}</p>}
              <Button variant="outline" disabled={busy || !manage || (!item.branchId && !manageCompanyCatalog)}>Save catering item</Button>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
