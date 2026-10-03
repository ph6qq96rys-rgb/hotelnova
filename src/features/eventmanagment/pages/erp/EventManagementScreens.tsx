import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, BadgeDollarSign, Beef, CalendarDays, ChefHat, CheckCircle2, ClipboardCheck, ClipboardList, LayoutDashboard, PackageSearch, Printer, Receipt, Scale, Scissors, ShieldCheck, Tags, Users, Warehouse } from "lucide-react";
import { formatCurrency } from "../../../../shared/currency/currencyFormat";
import { useAppScope } from "../../../../app/useAppScope";
import { grnApi } from "../../../inventory/grn/api/grnApi";
import type { GrnDetailDto, GrnLineDto } from "../../../inventory/grn/types/grn.types";
import { butcheryManagementApi } from "../../api/butcheryManagementApi";
import type { ButcheryBatchTraceDto, ButcheryOperationDto, ButcheryProcessingBatchDto, MeatCutTemplateDto } from "../../api/butcheryManagementApi";
import type { CateringEventScopedSnapshot, CateringOperationalSnapshot, CateringPackageSummaryDto, EventInquiryDto, EventQuotationSummaryDto } from "../../api/cateringManagementApi";
import { demoRequirementLines, demoReservationLines } from "./eventManagementFallbacks";
import type { LiteMenuLine, LiteRequirement, LiteReservationLine, Risk } from "./eventManagementTypes";
import { formatDate, readinessLabel } from "./eventManagementUtils";
import { Checklist, PackageCard, PanelHeader, RiskItem, ScreenHeader, StatusBadge, SummaryCard } from "./EventManagementShared";

export function CommandScreen({ quotations, risks, selectedQuotationId, snapshot, eventWorkspace, onSelectQuotation }: { quotations: EventQuotationSummaryDto[]; risks: Risk[]; selectedQuotationId: string | null; snapshot: CateringOperationalSnapshot | null; eventWorkspace?: CateringEventScopedSnapshot | null; onSelectQuotation: (id: string) => void }) {
  return <section className="erp-screen"><ScreenHeader icon={<LayoutDashboard size={18} />} title="Operations command center" subtitle="One operating rhythm for quote conversion, BEO readiness, production, inventory, dispatch, and financial close." action="Open run sheet" /><EventSignalPanel eventWorkspace={eventWorkspace} /><StartHerePanel /><div className="erp-split erp-split--wide"><section className="erp-panel"><PanelHeader title="Live event ledger" meta={`${quotations.length} quotations`} /><div className="erp-data-table"><div className="erp-table-head erp-table-row--quote"><span>Reference</span><span>Customer</span><span>Date</span><span>Guests</span><span>Status</span><span>Value</span></div>{quotations.map((quote) => <button className={`erp-table-row erp-table-row--quote ${quote.id === selectedQuotationId ? "is-selected" : ""}`} key={quote.id} onClick={() => onSelectQuotation(quote.id)} type="button"><strong>{quote.reference}</strong><span>{quote.customerName}</span><span>{formatDate(quote.eventStartUtc)}</span><span>{quote.guestCount}</span><StatusBadge status={quote.status} /><span>{formatCurrency(quote.currentVersion?.totalAmount ?? 0)}</span></button>)}</div></section><section className="erp-panel"><PanelHeader title="Exceptions" meta={`${risks.length} items`} /><div className="erp-risk-list">{risks.map((risk) => <RiskItem key={risk.title} {...risk} />)}</div><div className="erp-timeline">{(snapshot?.liveWorkspace?.timeline ?? []).slice(0, 4).map((entry) => <article key={entry.id}><span>{formatDate(entry.occurredAtUtc)}</span><strong>{entry.title}</strong><small>{entry.area} / {entry.status}</small></article>)}{!snapshot?.liveWorkspace?.timeline?.length ? <article><span>Today</span><strong>Waiting for accepted quotation to create event workspace</strong><small>Facade endpoints create or resolve events behind the scenes.</small></article> : null}</div></section></div></section>;
}

export function SalesScreen({ inquiries, quotations, packages, selectedQuotationId, onSelectQuotation }: { inquiries: EventInquiryDto[]; quotations: EventQuotationSummaryDto[]; packages: CateringPackageSummaryDto[]; selectedQuotationId: string | null; onSelectQuotation: (id: string) => void }) {
  return <section className="erp-screen"><ScreenHeader icon={<Receipt size={18} />} title="Sales pipeline and package desk" subtitle="Qualify inquiries, compose quotations, capture deposit intent, and pass accepted quotes to operations." action="New inquiry" /><div className="erp-split"><section className="erp-panel"><PanelHeader title="Inbound service requests" meta={`${inquiries.length} leads`} /><div className="erp-stack">{inquiries.map((inquiry) => <article className="erp-record-card" key={inquiry.id}><div><strong>{inquiry.reference} / {inquiry.customerName}</strong><span>{inquiry.eventType} / {inquiry.guestCount} guests / {formatDate(inquiry.eventDate)}</span></div><StatusBadge status={inquiry.status} /><p>{inquiry.serviceStyle || "Service style pending"}</p><small>{inquiry.dietaryRequirements || inquiry.specialRequirements || "No special requirements captured yet"}</small></article>)}</div></section><section className="erp-panel"><PanelHeader title="Quote board" meta={`${quotations.length} active`} /><div className="erp-stack">{quotations.map((quote) => <button className={`erp-record-card erp-record-button ${quote.id === selectedQuotationId ? "is-selected" : ""}`} key={quote.id} onClick={() => onSelectQuotation(quote.id)} type="button"><div><strong>{quote.reference}</strong><span>{quote.customerName} / {formatCurrency(quote.currentVersion?.totalAmount ?? 0)}</span></div><StatusBadge status={quote.status} /></button>)}</div></section></div><section className="erp-panel"><PanelHeader title="Sellable packages" meta={`${packages.filter((item) => item.publishToPortal).length} published`} /><div className="erp-package-grid">{packages.map((item) => <PackageCard key={item.id} item={item} />)}</div></section></section>;
}

export function EventOpsScreen({ quotation, snapshot, eventWorkspace }: { quotation: EventQuotationSummaryDto | null; snapshot: CateringOperationalSnapshot | null; eventWorkspace?: CateringEventScopedSnapshot | null }) {
  const readiness = snapshot?.closureReadiness;
  const event = eventWorkspace?.event ?? null;
  const commandCenter = eventWorkspace?.commandCenter ?? null;
  return <section className="erp-screen"><ScreenHeader icon={<CalendarDays size={18} />} title="Event operations" subtitle="BEO control, readiness, staffing handoff, transport timing, and post-event close discipline." action="Generate BEO" /><section className="erp-panel"><PanelHeader title="Run sheet" meta={quotation?.reference ?? "No quotation selected"} /><div className="erp-summary-grid"><SummaryCard label="Event" value={event?.eventNo ?? quotation?.eventType ?? "Pending"} detail={event?.customerName ?? quotation?.customerName ?? "Select a quote"} /><SummaryCard label="Schedule" value={formatDate(event?.eventDateUtc ?? quotation?.eventStartUtc)} detail={event?.venueName ?? (quotation?.eventEndUtc ? `Ends ${formatDate(quotation.eventEndUtc)}` : "End time pending")} /><SummaryCard label="Guest count" value={`${event?.guestCount ?? quotation?.guestCount ?? 0}`} detail="BEO capacity baseline" /><SummaryCard label="Command readiness" value={commandCenter ? `${commandCenter.readinessPercent}%` : readinessLabel(readiness?.canClose)} detail={`${commandCenter?.outstandingIssueCount ?? readiness?.outstandingActions.length ?? 0} blockers`} /></div></section><div className="erp-split"><section className="erp-panel"><PanelHeader title="Readiness checklist" meta="Event ops" /><Checklist items={[["Accepted quotation linked", Boolean(event?.acceptedQuotationId || quotation?.acceptedVersionId || quotation?.status === "Accepted")], ["Event workspace resolved", Boolean(event?.id)], ["Command center loaded", Boolean(commandCenter)], ["Menu plan approved", snapshot?.menuPlan?.status === "Approved"], ["Inventory reservation complete", snapshot?.inventoryReservation?.status === "Reserved"], ["Closure gates clear", Boolean(readiness?.canClose)]]} /></section><section className="erp-panel"><PanelHeader title="Outstanding actions" meta="By area" /><div className="erp-stack">{(readiness?.outstandingActions ?? [{ area: "Kitchen", code: "MENU", message: "Approve menu plan before production forecast" }, { area: "Inventory", code: "RESERVE", message: "Reserve stock after consumption forecast" }, { area: "Finance", code: "DEPOSIT", message: "Verify deposit before dispatch release" }]).map((item) => <article className="erp-record-card" key={`${item.area}-${item.code}`}><div><strong>{item.area}</strong><span>{item.message}</span></div><StatusBadge status={item.code} /></article>)}</div></section></div></section>;
}

export function KitchenScreen({ packages, snapshot, eventWorkspace }: { packages: CateringPackageSummaryDto[]; snapshot: CateringOperationalSnapshot | null; eventWorkspace?: CateringEventScopedSnapshot | null }) {
  const menuLines: LiteMenuLine[] = snapshot?.menuPlan?.lines?.length ? snapshot.menuPlan.lines.map((line) => ({ id: line.id, courseName: line.courseName, menuItemName: line.menuItemName, quantity: line.quantity, expectedYieldQuantity: line.expectedYieldQuantity, requiresRecipe: line.requiresRecipe })) : packages.flatMap((pkg) => (pkg.currentVersion?.items ?? []).map((item) => ({ id: item.id, courseName: item.itemType, menuItemName: item.name, quantity: item.quantity, expectedYieldQuantity: item.quantity, requiresRecipe: item.itemType.toLowerCase() === "menu" })));
  const requirements: LiteRequirement[] = eventWorkspace?.requirements?.menuItems?.length ? eventWorkspace.requirements.menuItems.map((item) => ({ id: item.menuItemId, requirementType: item.hasActiveRecipe ? "Recipe ready" : "Missing recipe", description: `${item.menuItemName} / required ${item.requiredMenuQuantity}`, severity: item.hasActiveRecipe ? "Ready" : "Critical" })) : snapshot?.menuPlan?.requirements?.length ? snapshot.menuPlan.requirements.map((item) => ({ id: item.id, requirementType: item.requirementType, description: item.description, severity: item.severity })) : [];
  return <section className="erp-screen"><ScreenHeader icon={<ChefHat size={18} />} title="Kitchen and menu engineering" subtitle="Customer package selections become controlled menu plans, production requirements, and recipe checks." action="Revise menu" /><div className="erp-split erp-split--wide"><section className="erp-panel"><PanelHeader title="Menu plan" meta={snapshot?.menuPlan?.status ?? "Draft planning"} /><div className="erp-data-table"><div className="erp-table-head erp-table-row--menu"><span>Course</span><span>Item</span><span>Qty</span><span>Yield</span><span>Recipe</span></div>{menuLines.slice(0, 10).map((line) => <div className="erp-table-row erp-table-row--menu" key={line.id}><strong>{line.courseName}</strong><span>{line.menuItemName}</span><span>{line.quantity}</span><span>{line.expectedYieldQuantity}</span><StatusBadge status={line.requiresRecipe ? "Recipe" : "No recipe"} /></div>)}</div></section><section className="erp-panel"><PanelHeader title="Dietary and allergen controls" meta={`${requirements.length} requirements`} /><div className="erp-stack">{requirements.map((requirement) => <article className="erp-record-card" key={requirement.id}><div><strong>{requirement.requirementType}</strong><span>{requirement.description}</span></div><StatusBadge status={requirement.severity} /></article>)}</div></section></div></section>;
}
export function ButcheryScreen({ quotation, snapshot, sourceGrnId }: { quotation: EventQuotationSummaryDto | null; snapshot: CateringOperationalSnapshot | null; sourceGrnId?: string | null }) {
  const { companyId, branchId } = useAppScope();
  const [stage, setStage] = useState<ButcheryStageKey>(sourceGrnId ? "yield" : "batches");
  const [sourceGrn, setSourceGrn] = useState<GrnDetailDto | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [batches, setBatches] = useState<ButcheryProcessingBatchDto[]>([]);
  const [operations, setOperations] = useState<ButcheryOperationDto[]>([]);
  const [templates, setTemplates] = useState<MeatCutTemplateDto[]>([]);
  const [selectedOperationId, setSelectedOperationId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [trace, setTrace] = useState<ButcheryBatchTraceDto | null>(null);
  const [cuts, setCuts] = useState<ButcheryCutRow[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [batchMessage, setBatchMessage] = useState<string | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const sourcePanelRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const controlRef = useRef<HTMLElement | null>(null);
  const sourceLines = useMemo(() => (sourceGrn?.lines ?? []).filter(isCarcassSourceLine), [sourceGrn]);
  const sourceQty = useMemo(() => sourceLines.reduce((sum, line) => sum + Number(line.quantity ?? 0), 0), [sourceLines]);
  const selectedBatch = batches.find((item) => item.id === selectedBatchId) ?? batches[0] ?? null;
  const effectiveBranchId = sourceGrn?.branchId ?? branchId ?? null;
  const sourceItemId = sourceLines[0]?.itemId ?? sourceGrn?.lines?.find(isCarcassSourceLine)?.itemId ?? null;
  const matchingTemplates = sourceItemId ? templates.filter((template) => template.sourceItemId === sourceItemId) : templates;
  const selectedTemplate = matchingTemplates.find((template) => template.id === selectedTemplateId) ?? null;
  const selectedOperation = operations.find((operation) => operation.id === selectedOperationId) ?? null;
  const sourceWeight = (selectedBatch?.startingWeightBase ?? sourceQty) || 0;

  const refreshBatches = async (nextSelectedId?: string | null) => {
    if (!companyId) {
      setBatches([]);
      return;
    }

    setLoadingBatches(true);
    setBatchError(null);
    try {
      const rows = await butcheryManagementApi.listBatches(companyId, effectiveBranchId || undefined);
      setBatches(rows);
      const preferred = nextSelectedId || selectedBatchId || rows[0]?.id || "";
      setSelectedBatchId(rows.some((row) => row.id === preferred) ? preferred : rows[0]?.id || "");
    } catch (error: unknown) {
      setBatchError(readApiError(error, "Unable to load butchery batches."));
      setBatches([]);
    } finally {
      setLoadingBatches(false);
    }
  };

  const applyBatch = (batch: ButcheryProcessingBatchDto) => {
    setBatches((rows) => rows.some((row) => row.id === batch.id) ? rows.map((row) => row.id === batch.id ? batch : row) : [batch, ...rows]);
    setSelectedBatchId(batch.id);
    setCuts(mapBatchOutputs(batch));
  };

  useEffect(() => {
    void refreshBatches();
  }, [companyId, effectiveBranchId]);

  useEffect(() => {
    if (!companyId || !sourceGrnId) {
      setSourceGrn(null);
      setSourceError(null);
      return;
    }

    let cancelled = false;
    setSourceError(null);
    grnApi.getById({ companyId }, sourceGrnId)
      .then((grn) => {
        if (!cancelled) setSourceGrn(grn);
      })
      .catch((error: unknown) => {
        if (!cancelled) setSourceError(readApiError(error, "Unable to load source GRN."));
      });

    return () => { cancelled = true; };
  }, [companyId, sourceGrnId]);

  useEffect(() => {
    if (!selectedBatchId && batches[0]?.id) setSelectedBatchId(batches[0].id);
  }, [batches, selectedBatchId]);  useEffect(() => {
    if (matchingTemplates.length === 1 && !selectedTemplateId) {
      setSelectedTemplateId(matchingTemplates[0].id);
    }
    if (selectedTemplateId && !matchingTemplates.some((template) => template.id === selectedTemplateId)) {
      setSelectedTemplateId("");
    }
  }, [matchingTemplates, selectedTemplateId]);


  useEffect(() => {
    setCuts(selectedBatch ? mapBatchOutputs(selectedBatch) : []);
  }, [selectedBatch?.id]);

  useEffect(() => {
    if (!companyId || !selectedBatchId) {
      setTrace(null);
      return;
    }

    let cancelled = false;
    butcheryManagementApi.trace(companyId, selectedBatchId)
      .then((result) => {
        if (!cancelled) setTrace(result);
      })
      .catch(() => {
        if (!cancelled) setTrace(null);
      });

    return () => { cancelled = true; };
  }, [companyId, selectedBatchId]);

  const accountedKg = cuts.reduce((sum, row) => sum + row.actualKg, 0);
  const sellableKg = selectedBatch?.finishedCutsWeightBase ?? cuts.filter((row) => row.classification === "Sellable").reduce((sum, row) => sum + row.actualKg, 0);
  const wasteKg = selectedBatch?.wasteWeightBase ?? cuts.filter((row) => row.classification === "Waste").reduce((sum, row) => sum + row.actualKg, 0);
  const varianceKg = selectedBatch?.unaccountedVarianceWeightBase ?? sourceWeight - accountedKg;
  const variancePct = selectedBatch?.yieldVariancePercent ?? (sourceWeight > 0 ? (varianceKg / sourceWeight) * 100 : 0);
  const yieldPct = selectedBatch?.actualYieldPercent ?? (sourceWeight > 0 ? (sellableKg / sourceWeight) * 100 : 0);
  const labelsReady = cuts.filter((row) => row.labelStatus === "Ready").length;
  const batchValue = trace?.ledgerLines?.reduce((sum, line) => line.direction === "In" ? sum + Math.max(line.lineValue, 0) : sum, 0) ?? 0;
  const varianceTone = selectedBatch?.isVarianceWithinTolerance || Math.abs(variancePct) <= 1.5 ? "tone-success" : Math.abs(variancePct) <= 4 ? "tone-warning" : "tone-critical";

  const runBatchAction = async (action: string, call: () => Promise<ButcheryProcessingBatchDto>, nextStage?: ButcheryStageKey) => {
    if (!companyId || !selectedBatch) return;
    setBusyAction(action);
    setBatchMessage(null);
    setBatchError(null);
    try {
      const result = await call();
      applyBatch(result);
      if (nextStage) setStage(nextStage);
      setBatchMessage(`${formatStatus(result.status)} saved for ${result.batchNo}.`);
    } catch (error: unknown) {
      setBatchError(readApiError(error, "Butchery action failed."));
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreateYieldSheet = async () => {
    if (!companyId || !sourceGrnId) return;

    const firstLine = sourceLines.length === 1 ? sourceLines[0] : null;

    if (!sourceItemId || sourceLines.length === 0) {
      setBatchMessage(null);
      setBatchError("This GRN does not include a recognized carcass line. Confirm the received item is named or coded as a carcass item.");
      scrollToButcheryArea("source");
      return;
    }

    if (matchingTemplates.length === 0) {
      setBatchMessage(null);
      setBatchError(`Create an active meat cut template for ${getSourceLineIdentity(firstLine).code} before creating the yield sheet.`);
      scrollToButcheryArea("source");
      return;
    }

    if (!selectedTemplate) {
      setBatchMessage(null);
      setBatchError("Select the meat cut template to use for this carcass before creating the yield sheet.");
      scrollToButcheryArea("source");
      return;
    }

    setBusyAction("create");
    setBatchMessage(null);
    setBatchError(null);
    try {
      const result = await butcheryManagementApi.createBatchFromGrn(companyId, sourceGrnId, {
        branchId: null,
        grnLineId: firstLine?.id ?? null,
        butcheryOperationId: selectedOperation?.id ?? null,
        meatCutTemplateId: selectedTemplate.id,
        startingWeightBase: sourceQty > 0 ? sourceQty : null,
      });

      applyBatch(result);
      await refreshBatches(result.id);
      setBatchMessage(`Yield sheet ${result.batchNo} created from this GRN.`);
      setStage("yield");
    } catch (error: unknown) {
      setBatchError(readApiError(error, "Unable to create yield sheet."));
    } finally {
      setBusyAction(null);
    }
  };

  const updateCut = (id: string, field: "actualKg" | "pricePerKg", value: number) => {
    setCuts((rows) => rows.map((row) => row.id === id ? { ...row, [field]: Number.isFinite(value) ? value : 0 } : row));
  };

  const saveOutputs = () => runBatchAction("save", () => butcheryManagementApi.updateOutputs(companyId!, selectedBatchId, { outputs: cuts.map((row) => ({ meatCutTemplateLineId: row.templateLineId, actualWeightBase: row.actualKg, wasteReason: row.classification === "Waste" ? row.wasteReason || "Butchery trim/loss" : null, notes: row.notes || null })) }), "variance");
  const startBatch = () => runBatchAction("start", () => butcheryManagementApi.start(companyId!, selectedBatchId), "yield");
  const submitBatch = () => runBatchAction("submit", () => butcheryManagementApi.submit(companyId!, selectedBatchId), "variance");
  const approveVariance = () => runBatchAction("variance", () => butcheryManagementApi.approveVariance(companyId!, selectedBatchId, { approvedVarianceWeightBase: Math.max(varianceKg, 0), reason: "Approved from butchery control desk" }), "posting");
  const completeBatch = () => runBatchAction("complete", () => butcheryManagementApi.complete(companyId!, selectedBatchId), "posting");
  const postBatch = () => runBatchAction("post", () => butcheryManagementApi.post(companyId!, selectedBatchId), "posting");

  const scrollToButcheryArea = (target: "source" | "workspace" | "control") => {
    const ref = target === "source" ? sourcePanelRef : target === "control" ? controlRef : workspaceRef;
    window.requestAnimationFrame(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const openButcheryStage = (nextStage: ButcheryStageKey, target: "source" | "workspace" | "control" = "workspace") => {
    setStage(nextStage);
    setBatchError(null);
    setBatchMessage(nextStage === "yield" ? "Enter actual kg for each output cut, then save weights." : `Opened ${formatStatus(nextStage)} workspace.`);
    scrollToButcheryArea(target);
  };

  const requireButcheryStep = (message: string, nextStage: ButcheryStageKey, target: "source" | "workspace" | "control" = "workspace") => {
    setStage(nextStage);
    setBatchMessage(null);
    setBatchError(message);
    scrollToButcheryArea(target);
  };

  const saveWeightsFromChecklist = () => {
    if (accountedKg <= 0) {
      requireButcheryStep("Enter at least one actual output weight before saving weights.", "yield");
      return;
    }
    saveOutputs();
  };

  return (
    <section className="erp-screen erp-butchery-console">
      <ScreenHeader icon={<Beef size={18} />} title="Butchery control desk" subtitle="Manage carcass batches from GRN intake through yield sheet, cut weights, variance review, and inventory posting." action="Post batch" />
      <ButcheryStageTabs activeStage={stage} onChange={setStage} />
      <div ref={sourcePanelRef}><ButcherySourcePanel sourceGrn={sourceGrn} sourceGrnId={sourceGrnId} sourceError={sourceError} sourceLines={sourceLines} sourceQty={sourceQty} operations={operations} templates={matchingTemplates} selectedOperationId={selectedOperationId} selectedTemplateId={selectedTemplateId} onSelectOperation={setSelectedOperationId} onSelectTemplate={setSelectedTemplateId} creatingBatch={busyAction === "create"} batchMessage={batchMessage} onCreateYieldSheet={handleCreateYieldSheet} /></div>
      {batchError ? <div className="erp-event-alert"><AlertTriangle size={16} />{batchError}</div> : null}
      <div className="erp-butchery-kpis">
        <SummaryCard label="Open batches" value={loadingBatches ? "..." : `${batches.length}`} detail="Backend queue" />
        <SummaryCard label="Input weight" value={sourceWeight ? `${sourceWeight.toFixed(1)} kg` : "Pending"} detail={selectedBatch?.fifoLotBatchNo ?? selectedBatch?.batchNo ?? "No batch selected"} />
        <SummaryCard label="Sellable yield" value={`${yieldPct.toFixed(1)}%`} detail={`${sellableKg.toFixed(1)} kg saleable`} />
        <SummaryCard label="Variance" value={`${varianceKg.toFixed(1)} kg`} detail={`${variancePct.toFixed(1)}% against input`} />
        <SummaryCard label="Outputs" value={`${cuts.length}`} detail={`${labelsReady} labels ready`} />
        <SummaryCard label="Posted value" value={formatCurrency(batchValue)} detail="Trace ledger value" />
      </div>
      <div className="erp-butchery-layout">
        <section className="erp-panel erp-butchery-queue">
          <PanelHeader title="Batch queue" meta={loadingBatches ? "Loading" : `${batches.length} batches`} />
          <div className="erp-butchery-batch-list">
            {batches.map((batch) => (
              <button className={`erp-butchery-batch-row ${batch.id === selectedBatch?.id ? "is-selected" : ""}`} key={batch.id} onClick={() => setSelectedBatchId(batch.id)} type="button">
                <strong>{batch.batchNo}</strong>
                <span>{batch.sourceItemName}</span>
                <small>{batch.startingWeightBase.toFixed(1)} kg / {batch.sourceStockLocationName}</small>
                <StatusBadge status={formatStatus(batch.status)} />
              </button>
            ))}
            {!loadingBatches && batches.length === 0 ? <div className="erp-empty-state"><strong>No butchery batches</strong><span>Create one from a posted carcass GRN.</span></div> : null}
          </div>
        </section>
        <section className="erp-panel erp-butchery-workspace" ref={workspaceRef}>
          <PanelHeader title="Yield sheet workspace" meta={selectedBatch?.batchNo ?? "Select batch"} />
          <div className="erp-butchery-lifecycle">
            {buildMilestones(selectedBatch).map((item) => <span className={item.done ? "is-done" : ""} key={item.label}><CheckCircle2 size={15} />{item.label}</span>)}
          </div>
          <div className="erp-butchery-recon">
            <article><span>Input</span><strong>{sourceWeight ? sourceWeight.toFixed(1) : "0.0"} kg</strong></article>
            <article><span>Accounted</span><strong>{accountedKg.toFixed(1)} kg</strong></article>
            <article><span>Waste</span><strong>{wasteKg.toFixed(1)} kg</strong></article>
            <article className={varianceTone}><span>Variance</span><strong>{varianceKg.toFixed(1)} kg</strong></article>
          </div>
          <div className="erp-butchery-cut-table">
            <div className="erp-butchery-cut-row erp-butchery-cut-head"><span>Cut output</span><span>Class</span><span>Expected</span><span>Actual kg</span><span>Costing</span><span>Label</span></div>
            {cuts.map((row) => (
              <div className="erp-butchery-cut-row" key={row.id}>
                <strong>{row.cut}</strong>
                <span>{row.classification}</span>
                <span>{row.expectedKg.toFixed(1)}</span>
                <input aria-label={`${row.cut} actual kg`} min="0" step="0.1" type="number" value={row.actualKg} onChange={(event) => updateCut(row.id, "actualKg", Number(event.target.value))} />
                <span>{row.costing}</span>
                <button className="erp-icon-button" title="Print label" type="button"><Printer size={15} /></button>
              </div>
            ))}
            {!selectedBatch ? <div className="erp-empty-state"><strong>Select a batch</strong><span>Backend batch outputs will appear here.</span></div> : null}
          </div>
        </section>
        <section className="erp-panel erp-butchery-control" ref={controlRef}>
          <PanelHeader title="Control tower" meta={selectedBatch?.butcherName ?? selectedBatch?.supervisorName ?? "Butchery lead"} />
          <div className="erp-butchery-command-grid">
            <button className="erp-button erp-button--primary" disabled={!selectedBatch || busyAction === "start"} onClick={startBatch} type="button"><Scissors size={16} />Start breakdown</button>
            <button className="erp-button" disabled={!selectedBatch || busyAction === "save"} onClick={saveOutputs} type="button"><Scale size={16} />Save weights</button>
            <button className="erp-button" disabled={!selectedBatch || busyAction === "submit"} onClick={submitBatch} type="button"><ClipboardCheck size={16} />Submit batch</button>
            <button className="erp-button" disabled={!selectedBatch || busyAction === "variance"} onClick={approveVariance} type="button"><AlertTriangle size={16} />Approve variance</button>
            <button className="erp-button" disabled={!selectedBatch || busyAction === "complete"} onClick={completeBatch} type="button"><ShieldCheck size={16} />Complete</button>
            <button className="erp-button" disabled={!selectedBatch || busyAction === "post"} onClick={postBatch} type="button"><Warehouse size={16} />Post stock</button>
          </div>
          <div className="erp-butchery-trace">
            <h3>Traceability</h3>
            <dl>
              <div><dt>Source lot</dt><dd>{trace?.sourceLot.batchNo ?? selectedBatch?.fifoLotBatchNo ?? "Pending"}</dd></div>
              <div><dt>Location</dt><dd>{trace?.sourceLot.locationName ?? selectedBatch?.sourceStockLocationName ?? "Pending"}</dd></div>
              <div><dt>Template</dt><dd>{selectedBatch?.meatCutTemplateName ?? "Pending"}</dd></div>
              <div><dt>Tolerance</dt><dd>{selectedBatch?.toleranceWeightBase?.toFixed(1) ?? "0.0"} kg</dd></div>
            </dl>
          </div>
          <ButcheryReadinessActions sourceLocked={Boolean(sourceGrnId || selectedBatch?.fifoLotId)} outputsWeighed={accountedKg > 0} varianceReady={Boolean(selectedBatch?.isVarianceWithinTolerance || selectedBatch?.approvedVarianceWeightBase)} completed={formatStatus(selectedBatch?.status).toLowerCase() === "completed" || formatStatus(selectedBatch?.status).toLowerCase() === "posted"} posted={Boolean(selectedBatch?.status && formatStatus(selectedBatch.status).toLowerCase() === "posted")} busyAction={busyAction} hasBatch={Boolean(selectedBatch)} onOpenStage={openButcheryStage} onSaveWeights={saveWeightsFromChecklist} onApproveVariance={approveVariance} onComplete={completeBatch} onPost={postBatch} onNeedWeights={() => requireButcheryStep("Enter and save output weights before approving variance.", "yield")} onNeedVariance={() => requireButcheryStep("Approve the variance before completing this batch.", "variance")} onNeedComplete={() => requireButcheryStep("Complete the batch before posting stock.", "posting", "control")} />
        </section>
      </div>
    </section>
  );
}

type ButcheryStageKey = "batches" | "yield" | "labels" | "variance" | "posting";
type ButcheryCutClass = "Sellable" | "Byproduct" | "Waste";

type ButcheryCutRow = {
  id: string;
  templateLineId: string;
  cut: string;
  classification: ButcheryCutClass;
  expectedKg: number;
  actualKg: number;
  costing: string;
  labelStatus: "Ready" | "Queued" | "Blocked";
  wasteReason?: string | null;
  notes?: string | null;
};

function ButcheryStageTabs({ activeStage, onChange }: { activeStage: ButcheryStageKey; onChange: (stage: ButcheryStageKey) => void }) {
  const tabs: Array<{ key: ButcheryStageKey; label: string; icon: ReactNode }> = [
    { key: "batches", label: "Batches", icon: <ClipboardList size={15} /> },
    { key: "yield", label: "Yield sheet", icon: <Scale size={15} /> },
    { key: "labels", label: "Cuts & labels", icon: <Tags size={15} /> },
    { key: "variance", label: "Variance", icon: <AlertTriangle size={15} /> },
    { key: "posting", label: "Stock posting", icon: <ShieldCheck size={15} /> },
  ];

  return <div className="erp-butchery-stage-tabs" role="tablist">{tabs.map((tab) => <button className={tab.key === activeStage ? "is-active" : ""} key={tab.key} onClick={() => onChange(tab.key)} type="button">{tab.icon}<span>{tab.label}</span></button>)}</div>;
}

function ButcheryReadinessActions({ sourceLocked, outputsWeighed, varianceReady, completed, posted, busyAction, hasBatch, onOpenStage, onSaveWeights, onApproveVariance, onComplete, onPost, onNeedWeights, onNeedVariance, onNeedComplete }: { sourceLocked: boolean; outputsWeighed: boolean; varianceReady: boolean; completed: boolean; posted: boolean; busyAction: string | null; hasBatch: boolean; onOpenStage: (stage: ButcheryStageKey, target?: "source" | "workspace" | "control") => void; onSaveWeights: () => void; onApproveVariance: () => void; onComplete: () => void; onPost: () => void; onNeedWeights: () => void; onNeedVariance: () => void; onNeedComplete: () => void }) {
  const rows = [
    { label: "GRN source locked", done: sourceLocked, action: "View source", disabled: false, run: () => onOpenStage("batches", "source") },
    { label: "Output cuts weighed", done: outputsWeighed, action: outputsWeighed ? "Review weights" : "Enter weights", disabled: !hasBatch, run: () => onOpenStage("yield", "workspace") },
    { label: "Weights saved", done: outputsWeighed, action: busyAction === "save" ? "Saving" : "Save weights", disabled: !hasBatch || busyAction === "save", run: onSaveWeights },
    { label: "Variance inside tolerance", done: varianceReady, action: varianceReady ? "Review variance" : "Approve variance", disabled: !hasBatch || busyAction === "variance", run: varianceReady ? () => onOpenStage("variance", "workspace") : outputsWeighed ? onApproveVariance : onNeedWeights },
    { label: "Batch completed", done: completed, action: completed ? "Review posting" : "Complete batch", disabled: !hasBatch || busyAction === "complete", run: completed ? () => onOpenStage("posting", "control") : varianceReady ? onComplete : onNeedVariance },
    { label: "Stock posted", done: posted, action: posted ? "Trace stock" : "Post stock", disabled: !hasBatch || busyAction === "post", run: posted ? () => onOpenStage("posting", "control") : completed ? onPost : onNeedComplete },
  ];

  return (
    <div className="erp-butchery-action-list">
      {rows.map((row) => (
        <div className={row.done ? "is-done" : ""} key={row.label}>
          <span>{row.done ? <ClipboardCheck size={14} /> : <AlertTriangle size={14} />}</span>
          <strong>{row.label}</strong>
          <small>{row.done ? "Ready" : "Needs action"}</small>
          <button className="erp-button" disabled={row.disabled} onClick={row.run} type="button">{row.action}</button>
        </div>
      ))}
    </div>
  );
}

function isCarcassSourceLine(line: GrnLineDto): boolean {
  const text = `${line.itemCode ?? ""} ${line.itemName ?? ""} ${line.notes ?? ""}`.toLowerCase();
  return text.includes("carcass") || text.includes("carcase") || text.includes("beef side") || text.includes("half side");
}

function getGrnReference(grn: GrnDetailDto | null, fallback?: string | null): string {
  return grn?.grnNumber ?? grn?.grnNo ?? fallback ?? "Source GRN";
}

function getSourceLineIdentity(line: GrnLineDto | null): { code: string; name: string } {
  const explicitCode = line?.itemCode?.trim();
  const rawName = line?.itemName?.trim() || "Loading";
  if (explicitCode) return { code: explicitCode, name: rawName };

  const parts = rawName.split(/\s+\u00b7\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return { code: parts[0], name: parts.slice(1).join(" / ") };

  return { code: "Item code pending", name: rawName };
}

function ButcherySourcePanel({ sourceGrn, sourceGrnId, sourceError, sourceLines, sourceQty, operations, templates, selectedOperationId, selectedTemplateId, onSelectOperation, onSelectTemplate, creatingBatch, batchMessage, onCreateYieldSheet }: { sourceGrn: GrnDetailDto | null; sourceGrnId?: string | null; sourceError: string | null; sourceLines: GrnLineDto[]; sourceQty: number; operations: ButcheryOperationDto[]; templates: MeatCutTemplateDto[]; selectedOperationId: string; selectedTemplateId: string; onSelectOperation: (id: string) => void; onSelectTemplate: (id: string) => void; creatingBatch: boolean; batchMessage: string | null; onCreateYieldSheet: () => void }) {
  if (!sourceGrnId) return null;
  const firstLine = sourceLines[0] ?? sourceGrn?.lines?.[0] ?? null;
  const unit = firstLine?.uomCode || firstLine?.uomName || "KG";
  const itemIdentity = getSourceLineIdentity(firstLine);
  const hasMatchingTemplate = templates.length > 0;

  return (
    <section className="erp-butcher-source erp-panel">
      <PanelHeader title="Source carcass receipt" meta={sourceGrn ? getGrnReference(sourceGrn, sourceGrnId) : "Loading GRN"} />
      {sourceError ? <p className="erp-butcher-source__error">{sourceError}</p> : null}
      <div className="erp-butcher-source__grid">
        <article><span>GRN</span><strong>{getGrnReference(sourceGrn, sourceGrnId)}</strong><small>{sourceGrn?.supplierName ?? "Supplier loading"}</small></article>
        <article><span>Carcass item</span><strong>{itemIdentity.name}</strong><small>{itemIdentity.code}</small></article>
        <article><span>Received weight</span><strong>{sourceQty ? `${sourceQty.toLocaleString()} ${unit}` : "Loading"}</strong><small>Locked from posted receipt</small></article>
        <article><span>Next document</span><strong>{hasMatchingTemplate ? "Yield sheet draft" : "Template setup required"}</strong><small>Butchery batch</small></article>
      </div>
      <div className="erp-butcher-source__selectors">
        <label>
          <span>Butchery operation</span>
          <select value={selectedOperationId} onChange={(event) => onSelectOperation(event.target.value)}>
            <option value="">Auto select operation</option>
            {operations.map((operation) => <option key={operation.id} value={operation.id}>{operation.name}</option>)}
          </select>
        </label>
        <label>
          <span>Meat cut template</span>
          <select value={selectedTemplateId} onChange={(event) => onSelectTemplate(event.target.value)} disabled={!hasMatchingTemplate}>
            <option value="">{hasMatchingTemplate ? "Select active template" : `No template for ${itemIdentity.code}`}</option>
            {templates.map((template) => <option key={template.id} value={template.id}>{template.name} / {template.totalExpectedYieldPercent.toFixed(1)}%</option>)}
          </select>
        </label>
      </div>
      {!hasMatchingTemplate ? <div className="erp-butcher-source__setup"><AlertTriangle size={15} /><span>Create an active meat cut template for this carcass item, then return here to create the yield sheet.</span></div> : null}
      <div className="erp-butcher-source__actions">
        <button className="erp-button erp-button--primary" disabled={!sourceGrn || creatingBatch || !hasMatchingTemplate} onClick={onCreateYieldSheet} type="button"><ClipboardCheck size={16} />{creatingBatch ? "Creating" : "Create yield sheet"}</button>
        {batchMessage ? <small>{batchMessage}</small> : <small>{hasMatchingTemplate ? "Creates the controlled butchery batch from the posted GRN lot." : `Required setup: source item ${itemIdentity.code} must have active output cuts.`}</small>}
      </div>
    </section>
  );
}

function mapBatchOutputs(batch: ButcheryProcessingBatchDto): ButcheryCutRow[] {
  return [...(batch.outputs ?? [])].sort((a, b) => a.lineNo - b.lineNo).map((line) => ({
    id: line.id,
    templateLineId: line.meatCutTemplateLineId,
    cut: line.outputItemName,
    classification: normalizeClassification(line.classification),
    expectedKg: Number(line.expectedWeightBase ?? 0),
    actualKg: Number(line.actualWeightBase ?? 0),
    costing: formatStatus(line.costAllocationMethod),
    labelStatus: line.actualWeightBase > 0 ? "Ready" : "Queued",
    wasteReason: line.wasteReason,
    notes: line.notes,
  }));
}

function buildMilestones(batch: ButcheryProcessingBatchDto | null): Array<{ label: string; done: boolean }> {
  const status = formatStatus(batch?.status).toLowerCase();
  return [
    { label: "Source lot locked", done: Boolean(batch?.fifoLotId) },
    { label: "Output cuts weighed", done: Boolean(batch && batch.accountedWeightBase > 0) },
    { label: "Variance reviewed", done: Boolean(batch?.isVarianceWithinTolerance || batch?.approvedVarianceWeightBase) },
    { label: "Completed", done: status === "completed" || status === "posted" },
    { label: "Inventory posted", done: status === "posted" },
  ];
}

function normalizeClassification(value: unknown): ButcheryCutClass {
  const label = formatStatus(value).toLowerCase();
  if (label.includes("waste") || label === "3") return "Waste";
  if (label.includes("by") || label === "2") return "Byproduct";
  return "Sellable";
}

function formatStatus(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Pending";
  return String(value).replace(/([a-z])([A-Z])/g, "$1 $2");
}

function readApiError(error: unknown, fallback: string): string {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { status?: number; data?: unknown } }).response;
    const data = response?.data;
    if (typeof data === "string" && data.trim()) return data;
    if (typeof data === "object" && data) {
      const problem = data as { detail?: string; title?: string; message?: string; errors?: Record<string, string[] | string> };
      const firstError = problem.errors ? Object.values(problem.errors).flat()[0] : null;
      return problem.detail ?? problem.message ?? (typeof firstError === "string" ? firstError : null) ?? problem.title ?? fallback;
    }
    return response?.status ? `${fallback} HTTP ${response.status}.` : fallback;
  }
  return error instanceof Error ? error.message : fallback;
}
export function InventoryScreen({ snapshot, eventWorkspace }: { snapshot: CateringOperationalSnapshot | null; eventWorkspace?: CateringEventScopedSnapshot | null }) {
  const forecastLines = snapshot?.consumptionForecast?.lines ?? [];
  const reservationLines: LiteReservationLine[] = snapshot?.inventoryReservation?.lines?.length ? snapshot.inventoryReservation.lines.map((line) => ({ id: line.id, inventoryItemName: line.inventoryItemName, reservedQuantity: line.reservedQuantity, status: line.status })) : [];
  const displayLines = eventWorkspace?.requirements?.ingredients?.length ? eventWorkspace.requirements.ingredients.map((line) => ({ id: line.itemId+"-"+(line.consumptionLocationId??"legacy"), inventoryItemName: line.itemName+(line.consumptionLocationName?" — "+line.consumptionLocationName:""), requiredQuantity: line.requiredBaseQty, availableQuantity: line.availableBaseQty, shortageQuantity: line.shortageBaseQty })) : forecastLines.length ? forecastLines : reservationLines;
  const eventReservationCount = eventWorkspace?.reservations.length ?? snapshot?.stockIssueVouchers.length ?? 0;
  return <section className="erp-screen"><ScreenHeader icon={<PackageSearch size={18} />} title="Inventory execution" subtitle="Forecast consumption, reserve stock, issue SIVs, capture returns, record losses, and reconcile variances." action="Run forecast" /><div className="erp-split"><section className="erp-panel"><PanelHeader title="Consumption forecast" meta={snapshot?.consumptionForecast?.status ?? "Not calculated"} /><div className="erp-data-table"><div className="erp-table-head erp-table-row--inventory"><span>Item</span><span>Required</span><span>Available</span><span>Status</span></div>{displayLines.slice(0, 8).map((line) => <div className="erp-table-row erp-table-row--inventory" key={line.id}><strong>{line.inventoryItemName}</strong><span>{"requiredQuantity" in line ? line.requiredQuantity : line.reservedQuantity}</span><span>{"availableQuantity" in line ? line.availableQuantity : line.reservedQuantity}</span><StatusBadge status={"shortageQuantity" in line && line.shortageQuantity > 0 ? "Short" : "status" in line ? line.status : "Ready"} /></div>)}</div></section><section className="erp-panel"><PanelHeader title="Issue and return control" meta={`${eventReservationCount} event reservations`} /><div className="erp-summary-grid"><SummaryCard label="Reserved" value={snapshot?.inventoryReservation?.status ?? "Pending"} detail={`${reservationLines.length} reservation lines`} /><SummaryCard label="Issued cost" value={formatCurrency((snapshot?.stockIssueVouchers ?? []).reduce((sum, item) => sum + (item.totalIssuedCost ?? 0), 0))} detail="Posted SIV cost" /><SummaryCard label="Returns" value={`${eventWorkspace?.returns.length ?? snapshot?.inventoryReturns.length ?? 0}`} detail="Return documents" /><SummaryCard label="Losses" value={`${eventWorkspace?.waste.length ?? snapshot?.operationalLosses.length ?? 0}`} detail="Approval controlled" /></div></section></div></section>;
}

export function FinanceScreen({ quotation, snapshot, eventWorkspace }: { quotation: EventQuotationSummaryDto | null; snapshot: CateringOperationalSnapshot | null; eventWorkspace?: CateringEventScopedSnapshot | null }) {
  const profitability = snapshot?.profitability;
  const event = eventWorkspace?.event ?? null;
  const revenue = event?.contractValue ?? profitability?.revenueAmount ?? quotation?.currentVersion?.totalAmount ?? 0;
  const cost = profitability?.actualCosts.totalCostAmount ?? 0;
  const profit = profitability?.grossProfitAmount ?? revenue - cost;
  const costs = [["Food", profitability?.actualCosts.foodCostAmount ?? 0], ["Beverage", profitability?.actualCosts.beverageCostAmount ?? 0], ["Labor", profitability?.actualCosts.laborCostAmount ?? 0], ["Equipment", profitability?.actualCosts.equipmentCostAmount ?? 0], ["Waste and losses", (profitability?.actualCosts.wasteCostAmount ?? 0) + (profitability?.actualCosts.lossCostAmount ?? 0)]] as Array<[string, number]>;
  return <section className="erp-screen"><ScreenHeader icon={<BadgeDollarSign size={18} />} title="Finance and event closure" subtitle="Quotation value, deposits, actual cost, variance explanation, invoice coverage, and closure governance." action="Review closure" /><section className="erp-panel"><PanelHeader title="Commercial summary" meta={quotation?.reference ?? "No quote"} /><div className="erp-summary-grid"><SummaryCard label="Revenue" value={formatCurrency(revenue)} detail="Quoted or actual revenue" /><SummaryCard label="Actual cost" value={formatCurrency(cost)} detail="Food, labor, equipment, logistics, waste" /><SummaryCard label="Gross profit" value={formatCurrency(profit)} detail={`${(profitability?.contributionMarginPercent ?? 0).toFixed(1)}% contribution margin`} /><SummaryCard label="Outstanding" value={formatCurrency(event?.remainingBalance ?? snapshot?.closureReadiness?.outstandingBalanceAmount ?? quotation?.currentVersion?.depositAmount ?? 0)} detail={`Bills ${eventWorkspace?.finalBills.length ?? 0} / profit runs ${eventWorkspace?.profitability.length ?? 0}`} /></div></section><div className="erp-split"><section className="erp-panel"><PanelHeader title="Cost breakdown" meta="Actual" /><div className="erp-stack">{costs.map(([label, value]) => <SummaryCard key={label} label={label} value={formatCurrency(value)} detail="Actual ledger" />)}</div></section><section className="erp-panel"><PanelHeader title="Close blockers" meta={readinessLabel(snapshot?.closureReadiness?.canClose)} /><Checklist items={[["Inventory reconciliation submitted", Boolean(snapshot?.closureReadiness?.inventoryReconciliationCompleted)], ["Equipment ready", Boolean(snapshot?.closureReadiness?.equipmentReady)], ["Invoices recorded", Boolean(snapshot?.closureReadiness?.requiredInvoicesRecorded)], ["Payments recorded", Boolean(snapshot?.closureReadiness?.requiredPaymentsRecorded)]]} /></section></div></section>;
}

export function PortalScreen({ packages }: { packages: CateringPackageSummaryDto[] }) {
  const publishedPackages = packages.filter((item) => item.publishToPortal);
  const [selectedPackageId, setSelectedPackageId] = useState(publishedPackages[0]?.id ?? packages[0]?.id ?? "");
  const [request, setRequest] = useState({ customerName: "Aster Group", eventType: "Corporate gala dinner", guestCount: 240, eventDate: "2026-09-18T17:00", serviceStyle: "Buffet with VIP plated table", customization: "Add premium beef carving station, vegetarian entree, gluten-free dessert, coffee service, and nut-free preparation notes." });
  const [submitted, setSubmitted] = useState(false);
  const selectedPackage = publishedPackages.find((item) => item.id === selectedPackageId) ?? publishedPackages[0] ?? packages[0] ?? null;
  const estimatedValue = useMemo(() => (selectedPackage?.currentVersion?.basePrice ?? 0) * Math.max(Number(request.guestCount) || 0, 1), [request.guestCount, selectedPackage]);
  return <section className="erp-screen"><ScreenHeader icon={<Users size={18} />} title="Customer self-service portal" subtitle="Customers submit catering or event requests, select a package, customize menu needs, and send requirements to sales." action="Preview portal" /><div className="erp-portal-layout"><section className="erp-panel"><PanelHeader title="Service request" meta={submitted ? "Submitted to sales queue" : "Customer form"} /><div className="erp-form-grid"><label><span>Customer</span><input value={request.customerName} onChange={(event) => setRequest({ ...request, customerName: event.target.value })} /></label><label><span>Event type</span><input value={request.eventType} onChange={(event) => setRequest({ ...request, eventType: event.target.value })} /></label><label><span>Guest count</span><input type="number" min="1" value={request.guestCount} onChange={(event) => setRequest({ ...request, guestCount: Number(event.target.value) })} /></label><label><span>Event date</span><input type="datetime-local" value={request.eventDate} onChange={(event) => setRequest({ ...request, eventDate: event.target.value })} /></label><label className="wide"><span>Service style</span><input value={request.serviceStyle} onChange={(event) => setRequest({ ...request, serviceStyle: event.target.value })} /></label><label className="wide"><span>Menu customization</span><textarea value={request.customization} onChange={(event) => setRequest({ ...request, customization: event.target.value })} /></label></div><div className="erp-portal-actions"><SummaryCard label="Estimated package value" value={formatCurrency(estimatedValue)} detail={selectedPackage?.name ?? "Select a package"} /><button className="erp-button erp-button--primary" type="button" onClick={() => setSubmitted(true)}><ClipboardCheck size={16} />Submit request</button></div></section><section className="erp-panel"><PanelHeader title="Package picker" meta={`${publishedPackages.length || packages.length} available`} /><div className="erp-package-picker">{(publishedPackages.length ? publishedPackages : packages).map((item) => <button className={`erp-package-card erp-package-button ${item.id === selectedPackage?.id ? "is-selected" : ""}`} key={item.id} onClick={() => setSelectedPackageId(item.id)} type="button"><PackageCard item={item} /></button>)}</div></section></div></section>;
}

function EventSignalPanel({ eventWorkspace }: { eventWorkspace?: CateringEventScopedSnapshot | null }) {
  if (!eventWorkspace?.event) return null;
  const event = eventWorkspace.event;
  const command = eventWorkspace.commandCenter;
  const requirement = eventWorkspace.requirements;
  return (
    <section className="erp-panel">
      <PanelHeader title="Backend event workspace" meta={event.eventNo} />
      <div className="erp-summary-grid">
        <SummaryCard label="Status" value={formatStatus(event.status)} detail={event.customerName} />
        <SummaryCard label="Readiness" value={command ? `${command.readinessPercent}%` : "Pending"} detail={`${command?.outstandingIssueCount ?? 0} command issues`} />
        <SummaryCard label="Requirements" value={`${requirement?.menuItems.length ?? 0}`} detail={`${requirement?.ingredients.length ?? 0} ingredient lines`} />
        <SummaryCard label="Docs" value={`${eventWorkspace.productionPlans.length + eventWorkspace.equipmentPlans.length + eventWorkspace.staffingPlans.length}`} detail="Production, equipment, staffing" />
        <SummaryCard label="Execution" value={`${eventWorkspace.reservations.length + eventWorkspace.dispatches.length}`} detail="Reservations and dispatches" />
        <SummaryCard label="Close" value={`${eventWorkspace.reconciliations.length + eventWorkspace.finalBills.length}`} detail="Reconciliation and billing" />
      </div>
    </section>
  );
}
function StartHerePanel() {
  const steps = [
    { step: "1", owner: "Customer / Sales", title: "Capture request", detail: "Customer submits event details, guest count, package choice, menu notes, allergies, equipment, transport, and budget." },
    { step: "2", owner: "Catering Coordinator", title: "Qualify and quote", detail: "Review request, select package, price extras, send quotation, then follow up for approval and deposit." },
    { step: "3", owner: "Catering Manager", title: "Approve commercial plan", detail: "Approve discounts, high-value quotes, package exceptions, and operational readiness before event confirmation." },
    { step: "4", owner: "Chef / Butchery", title: "Build production plan", detail: "Finalize menu, dietary controls, recipes, butchery yield sheet, prep list, and production timing." },
    { step: "5", owner: "Store / Inventory", title: "Reserve and issue stock", detail: "Run consumption forecast, reserve stock, prepare SIV, approve variances, issue items, and collect returns." },
    { step: "6", owner: "Finance / Controller", title: "Reconcile and close", detail: "Post invoice, verify payments, reconcile consumption, approve losses, review profitability, and close event." },
  ];
  return <section className="erp-start-panel"><PanelHeader title="Start here" meta="Role-owned workflow" /><div className="erp-start-steps">{steps.map((item) => <article key={item.step}><span>{item.step}</span><div><strong>{item.title}</strong><small>{item.owner}</small><p>{item.detail}</p></div></article>)}</div></section>;
}
















