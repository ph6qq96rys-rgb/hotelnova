import {useEffect,useState} from "react";
import {http} from "../../../api/http";
import {Button} from "../../../components/ui/button";
import {Textarea} from "../../../components/ui/textarea";
import {useHasPermission} from "../../../auth/usePermissions";
import {useI18n} from "../../../i18n";
import {ActionDialog,apiError,qty} from "./p2pShared";
type Check={lineId:string;itemName:string;agreement:{name:string;revision:number;unitPrice?:number;status:string;paymentTermDays:number};proposedUnitPrice:number;requiresReview:boolean;approved:boolean;fingerprint:string};
type History={id:string;orderRevision:number;deviationReason:string;snapshot:{Name:string;Revision:number;From:string;To:string;Terms:string;PaymentTermDays:number}};
export default function PurchaseAgreementPanel({companyId,id,version,status}:{companyId:string;id:string;version:string;status:string}){
  const {tx}=useI18n(),canApprove=useHasPermission("purchasing.financeapprove");
  const [rows,setRows]=useState<Check[]>([]),[history,setHistory]=useState<History[]>([]),[selected,setSelected]=useState<Check|null>(null),[reason,setReason]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const root=`/companies/${companyId}/procurement/purchase-orders/${id}/agreements`,editable=["Draft","PendingApproval","PendingFinanceApproval","Approved"].includes(status);
  async function load(){const [checks,saved]=await Promise.all([editable?http.get<Check[]>(root):Promise.resolve({data:[] as Check[]}),http.get<History[]>(`${root}/history`)]);setRows(checks.data);setHistory(saved.data);}
  useEffect(()=>{void load().catch(e=>setError(apiError(e,"Unable to load agreement checks.")));},[companyId,id,version,status]);
  async function approve(){if(!selected||busy)return;setBusy(true);setError("");try{await http.post(`${root}/approve`,{lineId:selected.lineId,fingerprint:selected.fingerprint,reason});setSelected(null);await load();}catch(e){setError(apiError(e,"Unable to approve agreement deviation."));}finally{setBusy(false);}}
  return <section className="prq-panel"><h2>{tx("Supplier agreement checks")}</h2>{error&&!selected&&<p role="alert">{tx(error)}</p>}{rows.map(r=><div key={r.lineId}><h3>{r.itemName} · {r.agreement.name}</h3><p>{tx("Negotiated net price")}: {r.agreement.unitPrice==null?tx(r.agreement.status):qty(r.agreement.unitPrice)} · {tx("Proposed")}: {qty(r.proposedUnitPrice)} · {r.agreement.paymentTermDays} {tx("payment-term days")}</p><p>{tx(r.requiresReview?r.approved?"Deviation approved":"Deviation requires review":"Matches negotiated terms")}</p>{r.requiresReview&&!r.approved&&canApprove&&<Button onClick={()=>{setSelected(r);setReason("");}}>{tx("Review agreement deviation")}</Button>}</div>)}{history.length>0&&<details><summary>{tx("Retained agreement versions")}</summary>{history.map(h=><div key={h.id}><p>{h.snapshot.Name} · {tx("Agreement revision")} {h.snapshot.Revision} · {tx("PO revision")} {h.orderRevision} · {h.snapshot.From} – {h.snapshot.To}</p><p>{h.snapshot.Terms}</p><p>{h.deviationReason}</p></div>)}</details>}
    <ActionDialog open={!!selected} title={tx("Approve agreement deviation")} message={tx("The order preparer cannot approve this exception. The decision applies only to the current order and agreement terms.")} confirmText={tx("Approve deviation")} busy={busy} onConfirm={()=>void approve()} onClose={()=>setSelected(null)}>{error&&<p role="alert">{tx(error)}</p>}<label>{tx("Justification")}<Textarea value={reason} maxLength={1000} onChange={e=>setReason(e.target.value)}/></label></ActionDialog>
  </section>;
}
