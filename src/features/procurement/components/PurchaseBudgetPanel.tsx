import {useEffect,useState} from "react";
import {http} from "../../../api/http";
import {Button} from "../../../components/ui/button";
import {Textarea} from "../../../components/ui/textarea";
import {useI18n} from "../../../i18n";
import {ActionDialog,apiError,money} from "./p2pShared";
type Check={budget:{id:string;name:string;action:string;available:number};additionalCommitment:number;projectedAvailable:number;approved:boolean;canApprove:boolean};
export default function PurchaseBudgetPanel({companyId,id,version}:{companyId:string;id:string;version:string}){
  const {tx}=useI18n(),[rows,setRows]=useState<Check[]>([]),[selected,setSelected]=useState<Check|null>(null),[reason,setReason]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const root=`/companies/${companyId}/procurement/purchase-orders/${id}/budget-checks`;
  async function load(){setRows((await http.get<Check[]>(root)).data);}
  useEffect(()=>{void load().catch(e=>setError(apiError(e,"Unable to evaluate purchasing budgets.")));},[companyId,id,version]);
  async function approve(){if(!selected||busy)return;setBusy(true);setError("");try{await http.post(`${root}/${selected.budget.id}/approve`,{reason});setSelected(null);await load();}catch(e){setError(apiError(e,"Unable to approve budget overrun."));}finally{setBusy(false);}}
  return <section className="prq-panel"><h2>{tx("Budget checks")}</h2>{error&&!selected&&<p role="alert">{tx(error)}</p>}{rows.length===0&&<p>{tx("No matching budget is visible in your authorized scope. Approval and issuance still enforce applicable company controls.")}</p>}{rows.map(r=><div key={r.budget.id}><h3>{r.budget.name}</h3><p>{tx("Projected available")}: {money(r.projectedAvailable)} · {tx(r.budget.action)}{r.approved?` · ${tx("Overrun approved")}`:""}</p>{r.projectedAvailable<0&&!r.approved&&r.budget.action==="Review"&&r.canApprove&&<Button onClick={()=>{setSelected(r);setReason("");}}>{tx("Review budget overrun")}</Button>}</div>)}<ActionDialog open={!!selected} title={tx("Approve budget overrun")} message={tx("This approval covers the current order and budget version. Material changes require another review.")} confirmText={tx("Approve overrun")} busy={busy} onConfirm={()=>void approve()} onClose={()=>setSelected(null)}>{error&&<p role="alert">{tx(error)}</p>}<label>{tx("Justification")}<Textarea value={reason} maxLength={1000} onChange={e=>setReason(e.target.value)}/></label></ActionDialog></section>;
}
