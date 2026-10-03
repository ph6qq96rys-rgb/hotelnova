import {useEffect,useState} from "react";
import {Link} from "react-router-dom";
import {http} from "../../../api/http";
import {Button} from "../../../components/ui/button";
import {Select} from "../../../components/ui/select";
import {Textarea} from "../../../components/ui/textarea";
import {useHasPermission} from "../../../auth/usePermissions";
import {useI18n} from "../../../i18n";
import {ActionDialog,apiError,qty,date} from "./p2pShared";
type Check={lineId:string;itemName:string;unit:string;lookbackDays:number;comparison:{baseline?:number;proposed:number;increasePercent?:number;additionalCost?:number;historicalQuantity:number;status:string};history:{receiptLineId:string;grnId:string;grnNo:string;receivedAt:string;baseQuantity:number;baseUnitPrice:number}[];excludedReceipts:number;ruleName?:string;action?:string;exceptionId?:string;exceptionStatus?:string;exceptionVersion?:string;canDecide:boolean};
export default function PurchasePricePanel({companyId,id,version}:{companyId:string;id:string;version:string}){
  const {tx}=useI18n(),canCreate=useHasPermission("purchasing.create"),canOverride=useHasPermission("purchasing.financeapprove");
  const [rows,setRows]=useState<Check[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(""),[selected,setSelected]=useState<Check|null>(null),[decision,setDecision]=useState("Acknowledge"),[reason,setReason]=useState("");
  const root=`/companies/${companyId}/procurement/purchase-orders/${id}/price-checks`;
  async function load(){setRows((await http.get<Check[]>(root)).data);}
  useEffect(()=>{void load().catch(e=>setError(apiError(e,"Unable to compare purchase prices.")));},[companyId,id,version]);
  async function evaluate(){if(busy)return;setBusy(true);setError("");try{setRows((await http.post<Check[]>(root)).data);}catch(e){setError(apiError(e,"Unable to evaluate purchasing rules."));}finally{setBusy(false);}}
  async function decide(){if(!selected||busy)return;setBusy(true);setError("");try{await http.post(`${root}/${selected.exceptionId}/decision`,{version:selected.exceptionVersion,decision,reason});setSelected(null);await load();}catch(e){setError(apiError(e,"Unable to record the exception decision."));}finally{setBusy(false);}}
  return <section className="prq-panel"><h2>{tx("Historical purchase prices and exceptions")}</h2><p>{tx("Quantity-weighted posted receipts, less returned quantities. Prices use saved base-unit conversions and order exchange rates, excluding freight and tax. Issuance runs these checks again.")}</p>{error&&!selected&&<p role="alert">{tx(error)}</p>}{(canCreate||canOverride)&&<Button variant="secondary" disabled={busy} onClick={()=>void evaluate()}>{tx("Evaluate rules and notify reviewers")}</Button>}
    {rows.map(r=><details key={r.lineId}><summary>{r.itemName} · {r.lookbackDays} {tx("days")} · {tx(r.comparison.status)}{r.exceptionStatus?` · ${tx(r.exceptionStatus)}`:""}</summary><p>{tx(r.unit)}</p><dl><dt>{tx("Historical price")}</dt><dd>{r.comparison.baseline==null?"—":qty(r.comparison.baseline)}</dd><dt>{tx("Proposed price")}</dt><dd>{qty(r.comparison.proposed)}</dd><dt>{tx("Increase")}</dt><dd>{r.comparison.increasePercent==null?"—":`${qty(r.comparison.increasePercent)}%`}</dd><dt>{tx("Additional cost")}</dt><dd>{r.comparison.additionalCost==null?"—":qty(r.comparison.additionalCost)}</dd></dl>
      {r.ruleName&&<p>{tx("Applicable rule")}: {r.ruleName} · {tx(r.action??"")}</p>}{r.excludedReceipts>0&&<p>{r.excludedReceipts} {tx("receipts excluded because the retained quantity or saved conversion could not support a comparison.")}</p>}
      <ul>{r.history.map(h=><li key={h.receiptLineId}><Link to={`/companies/${companyId}/grns/${h.grnId}`}>{h.grnNo}</Link> · {date(h.receivedAt)} · {qty(h.baseQuantity)} × {qty(h.baseUnitPrice)}</li>)}</ul>
      {r.canDecide&&<Button onClick={()=>{setSelected(r);setDecision("Acknowledge");setReason("");}}>{tx("Review exception")}</Button>}
    </details>)}
    <ActionDialog open={!!selected} title={tx("Review purchasing exception")} message={tx("Explain the decision. Revised quotations or supplier changes require an order amendment and a fresh evaluation.")} confirmText={tx("Record decision")} busy={busy} onConfirm={()=>void decide()} onClose={()=>setSelected(null)}>{error&&<p role="alert">{tx(error)}</p>}<label>{tx("Decision")}<Select value={decision} onChange={e=>setDecision(e.target.value)}>{["Acknowledge","Requote","SupplierChange","Reject",...(canOverride&&selected?.action!=="Block"?["Approve"]:[])].map(v=><option key={v} value={v}>{tx(v==="SupplierChange"?"Request supplier change":v==="Requote"?"Request revised quotation":v==="Approve"?"Approve exception":v)}</option>)}</Select></label><label>{tx("Justification")}<Textarea value={reason} maxLength={1000} onChange={e=>setReason(e.target.value)}/></label></ActionDialog>
  </section>;
}
