import { useMemo, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import type { CateringPackage } from "./PackagesScreen";
import type { CatalogItem } from "./CatalogCollection";
import { itemPreparationIssues, packageWorkflow, type CatalogStage } from "./catalogWorkflowStages";

type Props = {
  rows: CateringPackage[]; items: CatalogItem[]; loading: boolean; busy: boolean; manage: boolean;
  approve: boolean; branchId: string; guests: number; setGuests: (n: number) => void;
  onNew: (kind: "items" | "packages") => void; onEdit: (id: string) => void;
  onItem: (item: CatalogItem) => void; onAction: (p: CateringPackage, action: string) => void;
  onBrowseItems: () => void; onRefresh: () => void;
};
const stages: { key: CatalogStage; title: string; description: string }[] = [
  { key: "compose", title: "Build menu", description: "Sections, choices and portions" },
  { key: "cost", title: "Cost & price", description: "Ingredients, prices and margin" },
  { key: "approval", title: "Approve revision", description: "Independent commercial review" },
  { key: "availability", title: "Set availability", description: "Active status and selling dates" },
  { key: "ready", title: "Ready to quote", description: "Approved, active offerings" },
];
export function CatalogWorkflow(p: Props) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<CatalogStage | "all">("all");
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const evaluated = useMemo(() => p.rows.map(row => ({ row, ...packageWorkflow(row, p.items, today) })), [p.rows, p.items, today]);
  const pendingItems = p.items.filter(i => i.isActive && itemPreparationIssues(i).length);
  const matching = evaluated.filter(x => x.stage !== "archived" && `${x.row.name} ${x.row.packageNo ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <div className="pk-flow">
    <header className="pk-heading"><div><span className="pk-eyebrow">CATERING / MENU WORKFLOW</span>
      <h1>Menus & packages</h1><p>Prepare menu items, build a package, review its cost, and approve it for quotations.</p></div>
      <div className="pk-head-actions"><Button variant="outline" disabled={p.busy || p.loading} onClick={p.onRefresh}>Refresh</Button>
        <Button disabled={!p.branchId || !p.manage || p.busy || p.loading} onClick={() => p.onNew("packages")}>New package</Button></div>
    </header>
    <section className="co-card pk-flow-preparation"><div><h2>Start with menu items</h2>
      <p>{pendingItems.length} active item(s) need recipe, location, cost or price review. Complete these before composing a package.</p></div>
      <div className="pk-head-actions"><Button variant="outline" disabled={p.busy || p.loading} onClick={p.onBrowseItems}>Review all items</Button>
        <Button variant="outline" disabled={!p.branchId || !p.manage || p.busy || p.loading} onClick={() => p.onNew("items")}>New menu item</Button></div>
      {pendingItems.length > 0 && <details><summary>Items needing preparation</summary>
        <ul>{pendingItems.slice(0, 12).map(i => <li key={i.id}><Button variant="ghost" disabled={!p.manage || p.busy} onClick={() => p.onItem(i)}>{i.name}</Button> — {itemPreparationIssues(i).join("; ")}</li>)}</ul>
        {pendingItems.length > 12 && <p>Open “Review all items” to see the remaining items.</p>}
      </details>}
    </section>
    <nav className="pk-flow-stages" aria-label="Package workflow stages">
      <Button variant={selected === "all" ? "default" : "outline"} aria-pressed={selected === "all"} onClick={() => setSelected("all")}>All work ({evaluated.filter(x => x.stage !== "archived").length})</Button>
      {stages.map((s, n) => <Button key={s.key} variant={selected === s.key ? "default" : "outline"} aria-pressed={selected === s.key} onClick={() => setSelected(s.key)}>{n + 1}. {s.title} ({evaluated.filter(x => x.stage === s.key).length})</Button>)}
    </nav>
    <div className="pk-flow-tools"><label>Find a package<Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or package number" /></label>
      <label>Guests for cost review<Input type="number" min={1} max={100000} value={p.guests} onChange={e => p.setGuests(Number(e.target.value))}/></label>
      <p>Stages reflect saved catalog data. Cost review and server approval remain authoritative. Archived packages are available in Catalog view.</p>
    </div>
    {p.loading ? <p role="status">Loading menu workflow…</p> : <div className={`pk-flow-board${selected !== "all" ? " pk-flow-board--single" : ""}`}>
      {stages.filter(s => selected === "all" || selected === s.key).map(stage => <section className="pk-flow-lane" key={stage.key} aria-label={stage.title}>
        <h2>{stage.title}</h2><p>{stage.description}</p>
        {matching.filter(x => x.stage === stage.key).map(({ row, reasons }) => <article className="pk-flow-card" key={row.id}>
          <small>{row.packageNo} · revision {row.catalogVersion}</small><h3>{row.name}</h3>
          <ul>{reasons.slice(0, 3).map(reason => <li key={reason}>{reason}</li>)}</ul>
          {reasons.length > 3 && <p>{reasons.length - 3} more item(s) need review.</p>}
          <div className="pk-flow-actions">
            {stage.key === "compose" && !row.offering
              ? <Button disabled={!p.manage || p.busy} onClick={() => p.onAction(row, "upgrade")}>Import legacy items</Button>
              : <Button variant="outline" disabled={!p.manage || p.busy} onClick={() => p.onEdit(row.id!)}>{stage.key === "compose" ? "Build menu" : stage.key === "availability" ? "Edit availability" : row.workflowStatus === "Returned" ? "Edit & resubmit" : "Review package"}</Button>}
            {row.offering && <Button variant="outline" disabled={p.busy || !Number.isInteger(p.guests) || p.guests < 1 || p.guests > 100000} onClick={() => p.onAction(row, "estimate")}>Review cost & margin</Button>}
            {stage.key === "approval" && row.workflowStatus === "PendingApproval" && p.approve && <>
              <Button disabled={p.busy} onClick={() => p.onAction(row, "approve")}>Approve revision</Button>
              <Button variant="outline" disabled={p.busy} onClick={() => p.onAction(row, "return")}>Return for changes</Button>
            </>}
            {stage.key === "approval" && row.workflowStatus === "PendingApproval" && !p.approve && <p>Waiting for a catering manager.</p>}
            {stage.key === "approval" && row.workflowStatus !== "PendingApproval" && row.workflowStatus !== "Returned" && <>
              <Button disabled={!p.manage || p.busy} onClick={() => p.onAction(row, "submit")}>Submit for approval</Button>
              {p.approve && <Button variant="outline" disabled={p.busy} onClick={() => p.onAction(row, "approve")}>Approve without submission</Button>}
            </>}
            <Button variant="ghost" disabled={p.busy} onClick={() => p.onAction(row, "history")}>History</Button>
            {p.manage && <Button variant="ghost" disabled={p.busy} onClick={() => p.onAction(row, "delete")}>Delete package</Button>}
          </div>
        </article>)}
        {!matching.some(x => x.stage === stage.key) && <p className="pk-flow-empty">No packages in this stage{search ? " match your search" : ""}.</p>}
      </section>)}
    </div>}
  </div>;
}
