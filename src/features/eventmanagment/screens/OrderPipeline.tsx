import "../pages/catering-interactions.css";
import { http } from "../../../api/http";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { formatCurrency } from "../../../shared/currency/currencyFormat";
import { humanize } from "../sales/options";
import { readApiError } from "../sales/ui";
import { cateringPath } from "../components/CateringLayout";

type Row = { id: string; doc: string; reference: string; customer: string; service: string; date: string; venue: string; guests: number; status: string; value: number };
export function OrderPipeline({ companyId, branchId, calendar = false }: { companyId: string; branchId: string; calendar?: boolean }) {
  const { pathname } = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [month, setMonth] = useState("");
  const [venue, setVenue] = useState("");
  const [view, setView] = useState<"table" | "board">("table");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({openOrders:0,upcomingGuests:0,upcomingEvents:0,contractedValue:0,awaitingDeposit:0});
  useEffect(()=>setPage(1),[search,status,month,venue,companyId,branchId]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setError(""); setLoading(true);
      if(!companyId){setLoading(false);return;}
      const selectedMonth=calendar?calendarMonth:month;
      const start=selectedMonth?new Date(selectedMonth+"-01T00:00:00"):null;
      const end=start?new Date(start.getFullYear(),start.getMonth()+1,1):null;
      try {
        const params={branchId:branchId||undefined,q:search||undefined,status:status||undefined,venue:venue||undefined,from:start?.toISOString(),to:end?.toISOString(),page:calendar?1:page,pageSize:calendar?200:25,doc:calendar?"events":undefined};
        const first=await http.get<{items:Row[];total:number;summary:typeof summary}>("/companies/"+companyId+"/operations-query/orders",{params,signal:controller.signal});
        const records=[...first.data.items];
        if(calendar){for(let p=2;records.length<first.data.total;p++){const next=await http.get<{items:Row[]}>("/companies/"+companyId+"/operations-query/orders",{params:{...params,page:p},signal:controller.signal});if(!next.data.items.length)break;records.push(...next.data.items);}}
        if(!controller.signal.aborted){setRows(records);setTotal(first.data.total);setSummary(first.data.summary);}
      }catch(e){if(!controller.signal.aborted){setRows([]);setError(readApiError(e,"Unable to load orders."));}}
      finally{if(!controller.signal.aborted)setLoading(false);}
    },200);
    return()=>{clearTimeout(timer);controller.abort();};
  },[companyId,branchId,revision,search,status,month,venue,page,calendar,calendarMonth]);
  const filtered=rows;
  const href = (r: Row) => cateringPath(pathname, "sales?doc=" + r.doc + "&id=" + encodeURIComponent(r.id));
  function exportRows() {
    const cell = (v: unknown) => '"' + String(v ?? "").replace(/^[=+@-]/, "'$&").replace(/"/g, '""') + '"';
    const csv = [["Order","Client","Service","Date","Venue","Guests","Status","Value"], ...filtered.map(r => [r.reference,r.customer,r.service,r.date,r.venue,r.guests,r.status,r.value])].map(r => r.map(cell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "catering-orders.csv"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const [year, mm] = calendarMonth.split("-").map(Number);
  const dayCount = new Date(year, mm, 0).getDate();
  const offset = new Date(year, mm - 1, 1).getDay();
  const hasFilters=!!(search||status||month||venue);
  function shiftMonth(amount:number){const next=new Date(year,mm-1+amount,1);setCalendarMonth(next.getFullYear()+"-"+String(next.getMonth()+1).padStart(2,"0"));}
  const resetFilters=()=>{setSearch("");setStatus("");setMonth("");setVenue("");};
  return <section className="co-workspace ci-pipeline">
    <header className="co-heading"><div><span className="co-eyebrow">Catering / {calendar ? "Schedule" : "Overview"}</span><h1>{calendar ? "Event calendar" : "Order pipeline"}</h1><p>Plan the service. Keep every handoff in view.</p></div><div className="co-actions"><button disabled={loading} onClick={() => setRevision(r=>r+1)}>Refresh</button><button disabled={loading || !!error} onClick={exportRows}>Export this page</button><Link className="co-primary" to={cateringPath(pathname, "sales?doc=inquiries&new=1")}>+ New order</Link></div></header>
    {error && <div role="alert" className="co-notice">{error} <button disabled={loading} onClick={()=>setRevision(r=>r+1)}>Try again</button></div>}
    {!calendar&&<section className="ci-next-steps" aria-label="Catering quick actions"><div><span className="co-eyebrow">Your next step</span><h2>From first inquiry to a memorable event</h2><p>Open the workspace you need. Your records stay connected throughout the process.</p></div><div className="ci-step-links">{[
      ["01","Prepare a menu","Compose packages and review costs","command?view=packages"],
      ["02","Review quotations","Follow up on pricing and approvals","sales?doc=quotations"],
      ["03","Plan the service","See confirmed events on the calendar","command?view=calendar"]
    ].map(([number,title,caption,target])=><Link key={number} to={cateringPath(pathname,target)}><span>{number}</span><div><strong>{title} →</strong><small>{caption}</small></div></Link>)}</div></section>}
    <div className="co-metrics">{[
      ["Open orders", summary.openOrders, "Quotes and events in progress"],
      ["Guests · next 7 days", summary.upcomingGuests, summary.upcomingEvents + " scheduled events"],
      ["Contracted value", formatCurrency(summary.contractedValue), "All non-cancelled events"],
      ["Awaiting deposit", summary.awaitingDeposit, "Follow up before service"]
    ].map(([label,value,caption])=><article key={label}><span>{label}</span><strong>{loading || error ? "—" : value}</strong><small>{caption}</small></article>)}</div>
    {calendar ? <section className="co-card"><div className="co-toolbar"><h2>Confirmed event schedule</h2><div className="co-actions"><button aria-label="Previous month" onClick={()=>shiftMonth(-1)}>← Previous</button><button onClick={()=>{const today=new Date();setCalendarMonth(today.getFullYear()+"-"+String(today.getMonth()+1).padStart(2,"0"));}}>This month</button><button aria-label="Next month" onClick={()=>shiftMonth(1)}>Next →</button></div><label>Month<input type="month" value={calendarMonth} required onChange={e=>{if(e.target.value)setCalendarMonth(e.target.value);}}/></label></div><div className="co-calendar">{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=><strong key={d}>{d}</strong>)}{Array.from({length:offset},(_,i)=><div key={"blank"+i}/>)}{Array.from({length:dayCount},(_,i)=>{const day=calendarMonth+"-"+String(i+1).padStart(2,"0"); return <article key={day} className={new Date().toLocaleDateString("en-CA")===day?"ci-today":undefined}><span>{i+1}</span>{rows.filter(e=>new Date(new Date(e.date).getTime()-new Date(e.date).getTimezoneOffset()*60000).toISOString().slice(0,10)===day).map(e=><Link key={e.id} to={cateringPath(pathname,"sales?doc=events&id="+e.id)}><strong>{e.customer}</strong><small>{e.guests} guests · {humanize(e.status)}</small></Link>)}</article>;})}</div>{loading ? <p className="ci-help" role="status">Loading schedule…</p>:!rows.length&&!error&&<p className="ci-help">No confirmed events this month. Browse another month or open quotations to plan your next event.</p>}</section> :
    <section className="co-card"><div className="co-toolbar"><div className="co-view"><button aria-pressed={view==="table"} onClick={()=>setView("table")}>Table</button><button aria-pressed={view==="board"} onClick={()=>setView("board")}>Pipeline board</button></div><span aria-live="polite">{loading?"Updating orders…":total+" orders"}</span></div>
    <div className="co-filters"><input aria-label="Search orders" placeholder="Search orders, clients or venues…" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Order status" value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option>{["draft","submitted","approved","accepted","rejected","pendingDeposit","confirmed","inPlanning","inExecution","completed","cancelled"].map(s=><option key={s} value={s}>{humanize(s)}</option>)}</select><input aria-label="Event month" type="month" value={month} onChange={e=>setMonth(e.target.value)}/><input aria-label="Venue" placeholder="Venue (exact name)" value={venue} onChange={e=>setVenue(e.target.value)}/><button onClick={resetFilters}>Clear</button></div>
    {loading ? <p className="co-empty" role="status">Loading orders…</p> : filtered.length===0 ? <div className="co-empty"><h3>{error ? "Orders unavailable" : hasFilters ? "No matching orders" : "Your next event starts here"}</h3><p>{hasFilters ? "Try a different search or clear the filters." : "Create an inquiry, prepare a quote, then confirm the event."}</p>{hasFilters?<button onClick={resetFilters}>Clear filters</button>:!error&&<Link className="co-primary" to={cateringPath(pathname,"sales?doc=inquiries&new=1")}>Create your first inquiry</Link>}</div> : view==="table" ? <div className="co-table-wrap"><table className="co-table"><thead><tr>{["Order","Client / event","Service","Pax","Status","Value",""].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{filtered.map(r=><tr key={r.id}><td><Link to={href(r)}>{r.reference}</Link><small>{r.date ? new Date(r.date).toLocaleDateString() : "Date pending"}</small></td><td><strong>{r.customer}</strong><small>{r.venue || "Venue pending"}</small></td><td>{r.service}</td><td>{r.guests}</td><td><span className={"co-pill co-status-"+r.status}>{humanize(r.status)}</span></td><td>{formatCurrency(r.value)}</td><td><Link aria-label={"Open "+r.reference} to={href(r)}>Open →</Link></td></tr>)}</tbody></table></div> : <div className="co-board">{[...new Set(filtered.map(r=>r.status))].map(s=><section key={s}><h3>{humanize(s)} <small>{filtered.filter(r=>r.status===s).length}</small></h3>{filtered.filter(r=>r.status===s).map(r=><Link key={r.id} to={href(r)}><small>{r.reference}</small><strong>{r.customer}</strong><span>{r.guests} guests · {r.service}</span><b>{formatCurrency(r.value)}</b></Link>)}</section>)}</div>}<footer className="co-toolbar"><span>Page {page} of {Math.max(1,Math.ceil(total/25))} · 25 orders per page</span><div className="co-actions"><button disabled={loading||page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button><button disabled={loading||page*25>=total} onClick={()=>setPage(p=>p+1)}>Next</button></div></footer></section>}
  </section>;
}
