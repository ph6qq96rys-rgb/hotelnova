import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Button } from "../../../components/ui/button";
import { packagePricing } from "./packagePricing";
import { useEffect, useState } from "react";
import {
  ChefHat,
  Package,
  Search,
  RefreshCw,
  LayoutGrid,
  List,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  Users,
  SlidersHorizontal,
} from "lucide-react";
import type { CateringPackage } from "./PackagesScreen";
import { WORKFLOW_LABEL, workflowTone } from "./packageWorkflow";
import { formatCurrency as money } from "../../../shared/currency/currencyFormat";
export type CatalogItem = {
  companyId?: string;
  visibilityScope?: string | null;
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
type Props = {
  companyId?: string;
  onRecipe?: (item: CatalogItem) => void;
  rows: CateringPackage[];
  items: CatalogItem[];
  tab: string;
  setTab: (tab: string) => void;
  loading: boolean;
  busy: boolean;
  manage: boolean;
  approve: boolean;
  branchId: string;
  guests: number;
  setGuests: (n: number) => void;
  onNew: () => void;
  onRefresh: () => void;
  onEdit: (id: string) => void;
  onItem: (item: CatalogItem) => void;
  onRemoveItem: (item: CatalogItem) => void;
  onAction: (p: CateringPackage, action: string) => void;
  onSeed: (kind: string) => void;
};
const statusOf = (p: CateringPackage) => (p.offering?.archived ? "Archived" : p.isActive ? "Active" : "Inactive");
const priceOf = (p: CateringPackage) =>
  packagePricing(p.offering?.pricingMode === "Fixed" ? p.offering.fixedPrice : p.pricePerPerson,
    p.offering?.taxPercent ?? 0, p.offering?.serviceChargePercent ?? 0).total;
const human = (s: string) => s.replace(/([a-z])([A-Z])/g, "$1 $2");
/** Where the current revision is in the approval workflow. */
const flowOf = (p: CateringPackage) =>
  p.workflowStatus ?? (p.offering?.archived ? "Archived" : p.isApproved ? "Approved" : "Draft");
/** Menu-priced packages are quoted from item prices at the actual guest count, even in fixed mode. */
const scalesWithGuests = (p: CateringPackage) => p.offering?.pricingSource === "MenuItems";
export function CatalogCollection(p: Props) {
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [tier, setTier] = useState(""),
    [status, setStatus] = useState(""),
    [flow, setFlow] = useState(""),
    [min, setMin] = useState(""),
    [max, setMax] = useState(""),
    [date, setDate] = useState(""),
    [sort, setSort] = useState("name"),
    [view, setView] = useState("grid"),
    [advanced, setAdvanced] = useState(false),
    [page, setPage] = useState(1);
  useEffect(
    () => setPage(1),
    [search, category, tier, status, flow, min, max, date, sort, p.tab, p.branchId, p.rows.length, p.items.length],
  );
  const reset = () => {
    setSearch("");
    setCategory("");
    setTier("");
    setStatus("");
    setFlow("");
    setMin("");
    setMax("");
    setDate("");
  };
  const matches = (name: string, code: string) =>
    (name + " " + code).toLowerCase().includes(search.trim().toLowerCase());
  const packages = p.rows
    .filter(
      (r) =>
        matches(r.name, r.packageNo ?? "") &&
        (!category || r.offering?.category === category) &&
        (!tier || r.offering?.serviceTier === tier) &&
        (!status || statusOf(r) === status) &&
        (!flow || flowOf(r) === flow) &&
        (!min || priceOf(r) >= Number(min)) &&
        (!max || priceOf(r) <= Number(max)) &&
        (!date ||
          ((!r.offering?.effectiveDate || r.offering.effectiveDate.slice(0, 10) <= date) &&
            (!r.offering?.expiryDate || r.offering.expiryDate.slice(0, 10) >= date))),
    )
    .sort((a, b) =>
      sort === "price"
        ? priceOf(a) - priceOf(b)
        : sort === "price-desc"
          ? priceOf(b) - priceOf(a)
          : a.name.localeCompare(b.name),
    );
  const items = p.items
    .filter((i) => matches(i.name, i.code) && (!status || (i.isActive ? "Active" : "Inactive") === status))
    .sort((a, b) => a.name.localeCompare(b.name));
  const count = p.tab === "packages" ? packages.length : items.length,
    pages = Math.max(1, Math.ceil(count / 9)),
    current = Math.min(page, pages),
    start = (current - 1) * 9;
  const health = (r: CateringPackage) => {
    const lines = r.offering?.sections.flatMap((s) => s.items) ?? [];
    return lines.filter((l) => !p.items.some((i) => i.id === l.itemId && i.isActive && i.estimatedUnitCost > 0)).length;
  };
  const active = p.rows.filter((r) => statusOf(r) === "Active").length;
  const awaitingApproval = p.rows.filter((r) => flowOf(r) === "PendingApproval").length;
  const returned = p.rows.filter((r) => flowOf(r) === "Returned").length;
  return (
    <>
      <header className="pk-heading">
        <div>
          <span className="pk-eyebrow">CATERING / COMMERCIAL CATALOG</span>
          <h1>Menus & packages</h1>
          <p>Thoughtfully composed menus. Confidently priced occasions.</p>
        </div>
        <div className="pk-head-actions">
          <Button variant="outline" disabled={p.busy || p.loading} onClick={p.onRefresh} aria-label="Refresh catalog">
            <RefreshCw size={16} />
          </Button>
          <Button variant="default" className="pk-primary" disabled={!p.branchId || !p.manage || p.busy || p.loading} onClick={p.onNew}>
            + New {p.tab === "items" ? "catering item" : "package"}
          </Button>
        </div>
      </header>
      <div className="pk-metrics" aria-label="Catalog overview">
        {[
          ["Packages", p.rows.length, "Across this branch and company", <Package size={18} />],
          [
            "Active packages",
            active,
            awaitingApproval || returned
              ? [awaitingApproval && `${awaitingApproval} waiting for approval`, returned && `${returned} returned for changes`].filter(Boolean).join(" · ")
              : "Nothing waiting for approval",
            <CheckCircle2 size={18} />,
          ],
          [
            "Catering items",
            p.items.filter((i) => i.isActive).length,
            "Active food, service and equipment",
            <ChefHat size={18} />,
          ],
          [
            "Cost review",
            p.rows.filter((r) => r.offering && !r.offering.archived && health(r) > 0).length,
            "Packages with missing costs or inactive items",
            <AlertCircle size={18} />,
          ],
        ].map(([label, value, caption, icon]) => (
          <article key={String(label)}>
            <div>
              {icon}
              <span>{label}</span>
            </div>
            <strong>{p.loading ? "—" : value}</strong>
            <small>{caption}</small>
          </article>
        ))}
      </div>
      <section className="pk-catalog">
        <div className="pk-catalog-top">
          <div className="pk-tabs" role="group" aria-label="Catalog type">
            <Button variant="bare"
              aria-pressed={p.tab === "packages"}
              onClick={() => {
                p.setTab("packages");
                reset();
              }}
            >
              <Package size={16} />
              Packages <span>{p.rows.length}</span>
            </Button>
            <Button variant="bare"
              aria-pressed={p.tab === "items"}
              onClick={() => {
                p.setTab("items");
                reset();
              }}
            >
              <ChefHat size={16} />
              Catering items <span>{p.items.length}</span>
            </Button>
          </div>
          <span className="pk-scope">Branch & company offerings</span>
        </div>
        <div className="pk-filters">
          <label className="pk-search">
            <Search size={17} />
            <Input
              aria-label="Search catalog"
              placeholder={p.tab === "packages" ? "Find a package by name or code…" : "Find a catering item…"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <Select aria-label="Status filter" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {(p.tab === "packages" ? ["Active", "Inactive", "Archived"] : ["Active", "Inactive"]).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
          {p.tab === "packages" && (
            <>
              <Select aria-label="Approval filter" value={flow} onChange={(e) => setFlow(e.target.value)}>
                <option value="">Any approval state</option>
                {["Draft", "PendingApproval", "Returned", "Approved"].map((f) => (
                  <option key={f} value={f}>{WORKFLOW_LABEL[f]}</option>
                ))}
              </Select>
              <Select aria-label="Category filter" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Every occasion</option>
                {[...new Set(p.rows.map((r) => r.offering?.category).filter(Boolean))].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
              <Button variant="outline" aria-expanded={advanced} onClick={() => setAdvanced(!advanced)}>
                <SlidersHorizontal size={15} />
                Filters
              </Button>
            </>
          )}
          <div className="pk-view" role="group" aria-label="Catalog layout">
            <Button variant="bare" aria-label="Card view" aria-pressed={view === "grid"} onClick={() => setView("grid")}>
              <LayoutGrid size={16} />
            </Button>
            <Button variant="bare" aria-label="Compact view" aria-pressed={view === "list"} onClick={() => setView("list")}>
              <List size={16} />
            </Button>
          </div>
        </div>
        {advanced && p.tab === "packages" && (
          <div className="pk-advanced">
            <label>
              Service tier
              <Select value={tier} onChange={(e) => setTier(e.target.value)}>
                <option value="">Every tier</option>
                {["Bronze", "Gold", "Premium", "Custom"].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </label>
            <label>
              Minimum price
              <Input type="number" min="0" value={min} onChange={(e) => setMin(e.target.value)} />
            </label>
            <label>
              Maximum price
              <Input type="number" min="0" value={max} onChange={(e) => setMax(e.target.value)} />
            </label>
            <label>
              Available on
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label>
              Sort by
              <Select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="name">Name A–Z</option>
                <option value="price">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
              </Select>
            </label>
            <Button variant="outline" onClick={reset}>Reset filters</Button>
          </div>
        )}
        <div className="pk-results">
          <span>
            {p.loading ? "Loading catalog…" : `${count} ${p.tab === "packages" ? "packages" : "items"} found`}
          </span>
          {p.tab === "packages" && (
            <label>
              <Users size={14} />
              Cost estimates for{" "}
              <Input
                aria-label="Estimate guest count"
                type="number"
                min="1"
                max="100000"
                value={p.guests}
                onChange={(e) => p.setGuests(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
              />{" "}
              guests
            </label>
          )}
        </div>
        {p.loading ? (
          <div className="pk-empty" role="status">
            Loading your catering collection…
          </div>
        ) : !count ? (
          <div className="pk-empty">
            <ChefHat size={32} />
            <h2>
              {search || status || flow || category || tier || min || max || date
                ? "No matching offerings"
                : "Your next signature menu starts here"}
            </h2>
            <p>
              {search || status || flow || category || tier || min || max || date
                ? "Try another search or clear the filters."
                : "Create catering items, then compose them into a package for your guests."}
            </p>
            <Button variant="outline" onClick={reset}>Clear filters</Button>
          </div>
        ) : (
          <div className={`pk-collection pk-collection--${view}`}>
            {p.tab === "packages"
              ? packages.slice(start, start + 9).map((r) => (
                  <article className="pk-package" key={r.id}>
                    <div className="pk-package-cover">
                      {r.offering?.imageUrl ? (
                        <img src={r.offering.imageUrl} alt="" loading="lazy" />
                      ) : (
                        <div className="pk-cover-art">
                          <ChefHat size={34} />
                          <span>{r.offering?.category ?? "Catering collection"}</span>
                        </div>
                      )}
                      <span className={`pk-status pk-status--${statusOf(r).toLowerCase()}`}>{statusOf(r)}</span>
                    </div>
                    <div className="pk-package-body">
                      <div className="pk-package-meta">
                        <span>
                          {r.offering?.category ?? "Legacy package"} · {r.offering?.serviceTier ?? "Custom"}
                        </span>
                        <span className={`pk-wf pk-wf--${workflowTone(flowOf(r))}`}
                          title={r.approvedAtUtc ? `Last approved: revision ${r.approvedVersion}` : undefined}>
                          v{r.catalogVersion} · {WORKFLOW_LABEL[flowOf(r)] ?? flowOf(r)}
                        </span>
                      </div>
                      <h2>{r.name}</h2>
                      <small className="pk-code">{r.packageNo}</small>
                      <p className="pk-description">
                        {r.offering?.customerDescription ||
                          r.description ||
                          "Add a customer description to tell the story of this menu."}
                      </p>
                      <div className="pk-price">
                        <strong>{money(priceOf(r))}</strong>
                        <span>
                          /{" "}
                          {r.offering?.pricingMode === "Fixed"
                            ? scalesWithGuests(r)
                              ? `package for ${r.minimumGuests ?? 1} guests`
                              : "package"
                            : "person"}
                        </span>
                      </div>
                      {r.offering?.pricingMode === "Fixed" && scalesWithGuests(r) && (
                        <small>Priced from menu items: quotations recalculate for the actual guest count.</small>
                      )}
                      <small>Includes VAT ({r.offering?.taxPercent ?? 0}%) and service charge ({r.offering?.serviceChargePercent ?? 0}%)</small>
                      {r.offering?.pricingSource === "CostPercent" && (
                        <small className="pk-cost-basis">
                          Priced at a {r.offering.targetCostPercent}% target cost
                          {r.offering.priceOverridden ? " · manager override" : ""}
                        </small>
                      )}
                      {(flowOf(r) === "Returned" || flowOf(r) === "PendingApproval") && r.workflowNote && (
                        <p className={`pk-wf-note pk-wf-note--${workflowTone(flowOf(r))}`}>
                          <strong>{flowOf(r) === "Returned" ? "Returned" : "Submitted"}{r.lastActionByName ? ` by ${r.lastActionByName}` : ""}:</strong>{" "}
                          {r.workflowNote}
                        </p>
                      )}
                      <p className="pk-capacity">
                        <Users size={14} />
                        {r.minimumGuests ?? 1}–{r.maximumGuests ?? "unlimited"} guests <span>·</span>{" "}
                        {r.offering?.companyWide ? "Company-wide" : "This branch"}
                      </p>
                      {r.offering && (
                        <div className={`pk-readiness ${health(r) ? "pk-readiness--warning" : ""}`}>
                          <span>{health(r) ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}</span>
                          {health(r)
                            ? `${health(r)} item entries need cost or availability review`
                            : `${r.offering.sections.length} menu sections · ${r.offering.sections.reduce((n, s) => n + s.items.length, 0)} item entries`}
                        </div>
                      )}
                      <details className="pk-menu-preview">
                        <summary>
                          Menu & guest information <ArrowUpRight size={14} />
                        </summary>
                        {r.offering?.sections.map((s, i) => (
                          <section key={i}>
                            <h3>
                              {s.name}
                              <small>
                                {s.rule === "All"
                                  ? "All included"
                                  : s.rule === "Choose"
                                    ? `Choose ${s.selectCount}`
                                    : "Optional add-ons"}
                              </small>
                            </h3>
                            <ul>
                              {s.items.map((l, j) => (
                                <li key={j}>
                                  <span>
                                    {p.items.find((x) => x.id === l.itemId)?.name ?? l.name ?? "Unavailable item"}
                                  </span>
                                  <small>
                                    {l.quantity} {l.perGuest ? "per guest" : "fixed"}
                                    {l.additionalCharge > 0
                                      ? ` · + ${money(l.additionalCharge)} ${l.perGuest ? "per guest" : "fixed"}`
                                      : ""}
                                  </small>
                                </li>
                              ))}
                            </ul>
                          </section>
                        ))}
                        {(["inclusions", "exclusions", "terms"] as const).map(
                          (k) =>
                            r.offering?.[k] && (
                              <section key={k}>
                                <h3>{human(k)}</h3>
                                <p>{r.offering[k]}</p>
                              </section>
                            ),
                        )}
                      </details>
                      {r.offering && (
                        (p.approve && flowOf(r) === "PendingApproval") || (p.manage && flowOf(r) === "Draft")
                      ) && (
                        <div className="pk-wf-actions">
                          {p.approve && flowOf(r) === "PendingApproval" ? (
                            <>
                              <Button disabled={p.busy} onClick={() => p.onAction(r, "approve")}>Approve</Button>
                              <Button variant="outline" disabled={p.busy} onClick={() => p.onAction(r, "return")}>Return for changes</Button>
                            </>
                          ) : (
                            <Button disabled={p.busy} onClick={() => p.onAction(r, "submit")}>Submit for approval</Button>
                          )}
                        </div>
                      )}
                      <div className="pk-card-actions">
                        <Button variant="outline" className="pk-edit" disabled={!p.manage || p.busy} onClick={() => p.onEdit(r.id!)}>
                          {flowOf(r) === "Returned" ? "Edit & resubmit" : "Edit"}
                        </Button>
                        <Button variant="outline" disabled={!r.offering || p.busy} onClick={() => p.onAction(r, "estimate")}>
                          Cost & margin
                        </Button>
                        <details className="pk-more">
                          <summary aria-label={`More actions for ${r.name}`}>•••</summary>
                          <div>
                            <Button variant="bare"
                              disabled={!p.manage || p.busy || !r.offering}
                              onClick={() => p.onAction(r, "duplicate")}
                            >
                              Duplicate
                            </Button>
                            <Button variant="bare" disabled={p.busy} onClick={() => p.onAction(r, "history")}>
                              History
                            </Button>
                            {p.approve && flowOf(r) === "Draft" && (
                              <Button variant="bare"
                                disabled={p.busy || !r.offering || !!r.offering?.archived}
                                onClick={() => p.onAction(r, "approve")}
                              >
                                Approve draft revision {r.catalogVersion}
                              </Button>
                            )}
                            <Button variant="bare" className="pk-danger-text" disabled={!p.manage || p.busy} onClick={() => p.onAction(r, "delete")}>
                              Delete package…
                            </Button>
                            {!r.offering && (
                              <Button variant="bare" disabled={!p.manage || p.busy} onClick={() => p.onAction(r, "upgrade")}>
                                Import legacy package items
                              </Button>
                            )}
                          </div>
                        </details>
                      </div>
                    </div>
                  </article>
                ))
              : items.slice(start, start + 9).map((i) => (
                  <article className="pk-item" key={i.id}>
                    <div className="pk-item-top">
                      <span className="pk-item-icon">
                        <ChefHat size={21} />
                      </span>
                      <span className={`pk-status pk-status--${i.isActive ? "active" : "inactive"}`}>
                        {i.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <small className="pk-code">
                      {i.code} · {human(i.itemType)}
                    </small>
                    <h2>{i.name}</h2>
                    <p className="pk-description">{i.description || "Catering offering"}</p>
                    <dl>
                      <div>
                        <dt>Estimated unit cost</dt>
                        <dd>{money(i.estimatedUnitCost)}</dd>
                      </div>
                      <div>
                        <dt>Reference selling price</dt>
                        <dd>{money(i.sellingPrice)}</dd>
                      </div>
                    </dl>
                    {!i.consumptionLocationId && (
                      <p className="pk-readiness pk-readiness--warning">Consumption location needs configuration</p>
                    )}
                    <p className="pk-resource">
                      {i.recipeId
                        ? "Recipe linked"
                        : i.inventoryItemId
                          ? "Inventory linked"
                          : "No stock resource linked"}{" "}
                      · {i.branchId ? "Branch" : "Company-wide"}
                    </p>
                    {i.estimatedUnitCost === 0 && (
                      <p className="pk-readiness pk-readiness--warning">Estimated cost needs review</p>
                    )}
                    <Button variant="outline" disabled={!p.manage || p.busy} onClick={() => p.onItem({ ...i })}>
                      {i.companyId && i.companyId!==p.companyId ? "Company pricing and availability" : "Edit catering item"}
                    </Button>
                    <Button variant="outline" disabled={!p.manage || p.busy || (!!i.companyId && i.companyId!==p.companyId)} onClick={() => p.onRemoveItem(i)}>
                      Remove catering item
                    </Button>
                    {p.onRecipe && (!i.companyId || i.companyId===p.companyId) && (
                      <Button variant="outline" disabled={p.busy} onClick={() => p.onRecipe?.(i)}>
                        {i.recipeId ? "Edit recipe" : "Create recipe"}
                      </Button>
                    )}
                  </article>
                ))}
          </div>
        )}
        <footer className="pk-pagination">
          <span>{count ? `${start + 1}–${Math.min(start + 9, count)} of ${count}` : "0 results"}</span>
          <div>
            <Button variant="outline" disabled={current <= 1} onClick={() => setPage(current - 1)}>
              Previous
            </Button>
            <span>
              Page {current} of {pages}
            </span>
            <Button variant="outline" disabled={current >= pages} onClick={() => setPage(current + 1)}>
              Next
            </Button>
          </div>
        </footer>
      </section>
      <footer className="pk-footnote">
        <span>
          <CheckCircle2 size={14} />
          Dedicated catering catalog · shared operational resources
        </span>
        {p.manage && (
          <details>
            <summary>Sample data tools</summary>
            <p>Add example packages to the selected branch.</p>
            <Button variant="outline" disabled={!p.branchId || p.busy} onClick={() => p.onSeed("seed-samples")}>
              Create sample packages
            </Button>
            <Button variant="outline" disabled={!p.branchId || p.busy} onClick={() => p.onSeed("seed-4kilo")}>
              Import 4-Kilo PDF sample
            </Button>
          </details>
        )}
      </footer>
    </>
  );
}
