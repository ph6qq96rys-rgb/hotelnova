import {useEffect,useRef,useState} from "react";
import {Link} from "react-router-dom";
import {http} from "../../../api/http";
import {Button} from "../../../components/ui/button";
import {Input} from "../../../components/ui/input";
import {Select} from "../../../components/ui/select";
import {Textarea} from "../../../components/ui/textarea";
import {useHasPermission} from "../../../auth/usePermissions";
import {useI18n} from "../../../i18n";
import type {PurchaseOrder} from "../api/purchasingApi";
import {ActionDialog,apiError,qty} from "./p2pShared";
import RequisitionDocuments from "./RequisitionDocuments";

type Acceptance={id:string;purchaseOrderLineId:string;quantity:number;description:string;status:string;reviewerName:string;version:string;decisionReason:string;canDecide:boolean;canAttach:boolean;fixedAssetId?:string};
export default function ServiceAcceptancePanel({companyId,po,onChanged}:{companyId:string;po:PurchaseOrder;onChanged:()=>void}){
  const {tx}=useI18n(),canReceive=useHasPermission("purchasing.receiveinspect"),canRegister=useHasPermission("fixedassets.register");
  const [rows,setRows]=useState<Acceptance[]>([]),[users,setUsers]=useState<{id:string;name:string}[]>([]),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const [line,setLine]=useState(""),[reviewer,setReviewer]=useState(""),[quantity,setQuantity]=useState(1),[description,setDescription]=useState("");
  const [decision,setDecision]=useState<{row:Acceptance;accept:boolean}|null>(null),[reason,setReason]=useState("");
  const key=useRef(crypto.randomUUID()),root=`/companies/${companyId}/procurement/purchase-orders/${po.id}/acceptances`;
  const lines=po.lines.filter(l=>l.lineType!=="InventoryItem");
  async function load(){setRows((await http.get<Acceptance[]>(root)).data);}
  useEffect(()=>{if(lines.length)void load().catch(e=>setError(apiError(e,"Unable to load service acceptances.")));},[companyId,po.id,po.version]);
  if(!lines.length)return null;
  async function start(){try{setUsers((await http.get<{id:string;name:string}[]>(`/companies/${companyId}/procurement/delegations/candidates`)).data);key.current=crypto.randomUUID();setLine(lines[0].id);setQuantity(lines[0].outstandingQty);setDescription("");setReviewer("");setError("");setOpen(true);}catch(e){setError(apiError(e,"Unable to load reviewers."));}}
  async function save(){if(busy)return;setBusy(true);setError("");try{await http.post(root,{clientRequestId:key.current,purchaseOrderLineId:line,reviewerId:reviewer,quantity,description});setOpen(false);await load();onChanged();}catch(e){setError(apiError(e,"Unable to save acceptance. Your entries are retained."));}finally{setBusy(false);}}
  async function decide(){if(!decision||busy)return;setBusy(true);setError("");try{await http.post(`${root}/${decision.row.id}/decision`,{version:decision.row.version,accept:decision.accept,reason});setDecision(null);await load();onChanged();}catch(e){setError(apiError(e,"Unable to record the decision."));}finally{setBusy(false);}}
  return <section className="prq-panel"><h2>{tx("Service and equipment acceptance")}</h2>{error&&!open&&!decision&&<p role="alert">{tx(error)}</p>}
    <p>{tx("Submit completed quantities for an independent reviewer. Attach delivery or completion evidence before acceptance. Only accepted quantities can be matched to invoices.")}</p>
    {canReceive&&["Approved","Sent","PartiallyReceived"].includes(po.status)&&<Button onClick={()=>void start()}>{tx("Request acceptance")}</Button>}
    {rows.map(r=><details key={r.id}><summary>{lines.find(l=>l.id===r.purchaseOrderLineId)?.itemName} · {qty(r.quantity)} · {tx(r.status)} · {r.reviewerName}</summary><p>{r.description}</p><p>{r.decisionReason}</p>
      {lines.find(l=>l.id===r.purchaseOrderLineId)?.lineType==="FixedAsset"&&r.status==="Accepted"&&<p>{tx("Equipment accepted: review capitalization and register qualifying assets.")} {canRegister&&<Link to={`/companies/${companyId}/procurement/assets?purchaseOrderId=${po.id}&acceptanceId=${r.id}`}>{tx("Open asset registration")}</Link>}</p>}
      <RequisitionDocuments companyId={companyId} id={r.id} documentType="acceptance" editable={r.canAttach&&canReceive} onChanged={()=>void load()}/>
      {r.canDecide&&canReceive&&<div className="prq-actions"><Button onClick={()=>{setReason("");setDecision({row:r,accept:true});}}>{tx("Accept completed work")}</Button><Button variant="outline" onClick={()=>{setReason("");setDecision({row:r,accept:false});}}>{tx("Reject acceptance")}</Button></div>}
    </details>)}
    <ActionDialog open={open} title={tx("Request service or equipment acceptance")} message={tx("Select the completed quantity and its reviewer.")} confirmText={tx("Save request")} busy={busy} onConfirm={()=>void save()} onClose={()=>setOpen(false)}>
      {error&&<p role="alert">{tx(error)}</p>}<label>{tx("Order line")}<Select value={line} onChange={e=>{setLine(e.target.value);setQuantity(lines.find(l=>l.id===e.target.value)?.outstandingQty??1);}}>{lines.map(l=><option key={l.id} value={l.id}>{l.itemName}</option>)}</Select></label>
      <label>{tx("Completed quantity")}<Input type="number" min="0.0001" step="0.0001" value={quantity} onChange={e=>setQuantity(Number(e.target.value))}/></label>
      <label>{tx("Designated reviewer")}<Select value={reviewer} onChange={e=>setReviewer(e.target.value)}><option value="">{tx("Select reviewer")}</option>{users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</Select></label>
      <label>{tx("Completion or delivery details")}<Textarea maxLength={1000} value={description} onChange={e=>setDescription(e.target.value)}/></label>
    </ActionDialog>
    <ActionDialog open={!!decision} title={tx(decision?.accept?"Accept completed work":"Reject acceptance")} message={tx("Record the review findings. This decision and its evidence will be retained.")} confirmText={tx("Record decision")} busy={busy} onConfirm={()=>void decide()} onClose={()=>setDecision(null)}>{error&&<p role="alert">{tx(error)}</p>}<label>{tx("Review findings or rejection reason")}<Textarea value={reason} maxLength={1000} onChange={e=>setReason(e.target.value)}/></label></ActionDialog>
  </section>;
}
