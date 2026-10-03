
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { http } from "../../../api/http";
import { butcheryManagementApi as api, type ButcheryProcessingBatchDto as Batch } from "../api/butcheryManagementApi";
import { cateringPath } from "../components/CateringLayout";
import { readApiError } from "../sales/ui";
type Demand={id:string;demandNo:string;cateringEventNo:string;requiredByUtc:string;generatedAtUtc:string;status:string|number;lines:{id:string;requiredItemName:string;baseUomCode:string;requiredBaseQty:number;availableBaseQty:number;shortageBaseQty:number}[]};
const day=(d:Date)=>new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);
export function ProductionPlanning({companyId,branchId}:{companyId:string;branchId:string}){
 const {pathname}=useLocation(),[start,setStart]=useState(day(new Date())),[revision,setRevision]=useState(0);
 const [batches,setBatches]=useState<Batch[]>([]),[demands,setDemands]=useState<Demand[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState("");
 const first=new Date(start+"T00:00:00"),last=new Date(first);last.setDate(last.getDate()+7);
 const from=first.toISOString(),to=last.toISOString();
 useEffect(()=>{const c=new AbortController();setLoading(true);setError("");setBatches([]);setDemands([]);
 (async()=>{const demand=await http.get<Demand[]>("/companies/"+companyId+"/butchery/demands",{params:{branchId:branchId||undefined},signal:c.signal});
 const all:Batch[]=[];let page=1,total=0;do{const r=await api.searchBatches(companyId,{branchId,from,to,page,pageSize:100},c.signal);all.push(...r.items);total=r.total;page++;if(!r.items.length)break;}while(all.length<total&&!c.signal.aborted);
 if(!c.signal.aborted){setBatches(all);setDemands(demand.data.filter(d=>!["cancelled","completed","3","4"].includes(String(d.status).toLowerCase())&&new Date(d.requiredByUtc)>=new Date(from)&&new Date(d.requiredByUtc)<new Date(to)));}
 })().catch(e=>{if(!c.signal.aborted)setError(readApiError(e));}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[companyId,branchId,from,to,revision]);
 const days=Array.from({length:7},(_,i)=>{const d=new Date(first);d.setDate(d.getDate()+i);return day(d);});
 return <section className="co-workspace"><header className="co-heading"><div><span className="co-eyebrow">Butchery / Planning</span><h1>Production plan</h1><p>Seven-day cutting workload and catering demand shortages.</p></div><button disabled={loading} onClick={()=>setRevision(r=>r+1)}>Refresh</button></header>
 <section className="co-card"><div className="co-toolbar"><label>Week starting<input type="date" value={start} onChange={e=>{if(e.target.value)setStart(e.target.value);}}/></label><Link to={cateringPath(pathname,"butchery")}>Open cutting orders</Link></div>
 {error&&<p role="alert">{error}</p>}{loading?<p role="status">Loading production plan...</p>:<>
 <div className="co-table-wrap"><table className="co-table"><thead><tr><th>Day</th><th>Open batches</th><th>Orders / input weight</th></tr></thead><tbody>{days.map(d=>{const rows=batches.filter(b=>day(new Date(b.processingDateUtc))===d&&!["posted","cancelled","reversed","6","7","8"].includes(String(b.status).toLowerCase()));return <tr key={d}><td>{d}</td><td>{rows.length}</td><td>{rows.map(b=><div key={b.id}><Link to={cateringPath(pathname,"butchery?view=yield&batch="+b.id)}>{b.batchNo}</Link> · {b.sourceItemName} · {b.startingWeightBase.toFixed(2)} base units</div>)}</td></tr>;})}</tbody></table></div>
 <p className="co-caption">Workload uses scheduled cutting orders and item base units.</p><div className="co-toolbar"><h2>Demand shortages</h2></div><p className="co-caption">Availability is the snapshot saved when demand was generated. Demands may compete for the same stock.</p>
 <div className="co-table-wrap"><table className="co-table"><thead><tr><th>Demand / event</th><th>Required by</th><th>Cut</th><th>Required</th><th>Available</th><th>Shortage</th></tr></thead><tbody>{demands.flatMap(d=>d.lines.filter(l=>l.shortageBaseQty>0).map(l=><tr key={d.id+l.id}><td>{d.demandNo}<small>{d.cateringEventNo} · Snapshot {new Date(d.generatedAtUtc).toLocaleString()}</small></td><td>{new Date(d.requiredByUtc).toLocaleString()}</td><td>{l.requiredItemName}</td><td>{l.requiredBaseQty.toFixed(2)} {l.baseUomCode}</td><td>{l.availableBaseQty.toFixed(2)}</td><td>{l.shortageBaseQty.toFixed(2)}</td></tr>))}</tbody></table></div>{!demands.some(d=>d.lines.some(l=>l.shortageBaseQty>0))&&<p className="co-empty">No recorded shortages for this week.</p>}</>}</section></section>;
}
