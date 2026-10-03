import {useState} from "react";
import {useNavigate} from "react-router-dom";
import {http} from "../../../api/http";
import {Button} from "../../../components/ui/button";
import {Input} from "../../../components/ui/input";
import {Textarea} from "../../../components/ui/textarea";
import {useI18n} from "../../../i18n";
import {apiError,qty,todayIso} from "./p2pShared";

export default function RequisitionAmendmentPanel({companyId,id,lines}:{companyId:string;id:string;lines:{id:string;itemName:string;uomName:string;approvedQuantity:number}[]}){
 const {tx}=useI18n(),navigate=useNavigate();
 const [amounts,setAmounts]=useState<Record<string,string>>({}),[reason,setReason]=useState(""),[date,setDate]=useState(todayIso(1)),[error,setError]=useState(""),[busy,setBusy]=useState(false),[requestId]=useState(()=>crypto.randomUUID());
 async function create(){if(busy)return;setBusy(true);setError("");try{
  const r=(await http.post<{success:boolean;id?:string;error?:string}>(`/companies/${companyId}/procurement/requisitions/${id}/amendments`,{clientRequestId:requestId,requiredByDateUtc:`${date}T12:00:00Z`,reason,lines:Object.entries(amounts).filter(([,q])=>Number(q)>0).map(([lineId,q])=>({lineId,quantity:Number(q)}))})).data;
  if(!r.success||!r.id)throw new Error(r.error||"Unable to create the amendment.");
  navigate(`/companies/${companyId}/procurement/requisitions/${r.id}`);
 }catch(e){setError(e instanceof Error?e.message:apiError(e,"Unable to create amendment."));}finally{setBusy(false);}}
 return <details className="prq-panel"><summary>{tx("Request additional quantities")}</summary><p>{tx("Additional quantities create a linked draft requisition for the normal approval process. Existing orders and approved quantities remain in their original documents.")}</p>{error&&<p role="alert">{tx(error)}</p>}<fieldset disabled={busy}>{lines.map(l=><label key={l.id}>{l.itemName} · {tx("Already approved")}: {qty(l.approvedQuantity)} {l.uomName}<Input aria-label={`${tx("Additional quantity")} ${l.itemName}`} type="number" min="0" step="0.0001" value={amounts[l.id]||""} onChange={e=>setAmounts(v=>({...v,[l.id]:e.target.value}))}/></label>)}<label>{tx("Required date")}<Input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>{tx("Reason for additional quantities")}<Textarea maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label><Button disabled={!reason.trim()||!date||!Object.values(amounts).some(q=>Number(q)>0)} onClick={()=>void create()}>{tx("Create amendment draft")}</Button></fieldset></details>;
}
