import {Link} from "react-router-dom";
import {useEffect,useState} from "react";
import {http} from "../../../api/http";
import {Button} from "../../../components/ui/button";
import {Input} from "../../../components/ui/input";
import {Select} from "../../../components/ui/select";
import {Textarea} from "../../../components/ui/textarea";
import {useHasPermission} from "../../../auth/usePermissions";
import {useI18n} from "../../../i18n";
import {ActionDialog,apiError,money} from "./p2pShared";
import RequisitionDocuments from "./RequisitionDocuments";
type Outcome={id:string;condition:string;outcome:string;status:string;reference:string;notes:string;version:string;invoiceId?:string;settlementAmount:number;currencyCode?:string};
export default function ReturnOutcomePanel({companyId,id,status,onChanged}:{companyId:string;id:string;status:string;onChanged:()=>void}){
  const {tx}=useI18n(),canReceive=useHasPermission("purchasing.receiveinspect"),canFinance=useHasPermission("finance.payables.manage");
  const [row,setRow]=useState<Outcome|null>(null),[loading,setLoading]=useState(true),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const [condition,setCondition]=useState(""),[outcome,setOutcome]=useState("Replacement"),[reference,setReference]=useState(""),[notes,setNotes]=useState(""),[grn,setGrn]=useState("");
  const [receipts,setReceipts]=useState<{id:string;grnNo:string;receivedAt:string}[]>([]);
  const [invoices,setInvoices]=useState<{id:string;internalNo:string;currencyCode:string;maximumAmount:number;refundablePayments:number}[]>([]),[invoiceId,setInvoiceId]=useState(""),[amount,setAmount]=useState("");
  useEffect(()=>{if(!open||!row||row.outcome==="Replacement")return;let active=true;http.get<typeof invoices>(`/companies/${companyId}/procurement/purchase-returns/${id}/outcome/settlement-invoices`).then(r=>{if(active)setInvoices(r.data);}).catch(e=>{if(active)setError(apiError(e,"Unable to load settlement invoices."));});return()=>{active=false;};},[open,row?.outcome,companyId,id]);
  const root=`/companies/${companyId}/procurement/purchase-returns/${id}/outcome`;
  async function load(){setLoading(true);try{setRow((await http.get<Outcome|null>(root)).data);}finally{setLoading(false);}}
  useEffect(()=>{void load().catch(e=>setError(apiError(e,"Unable to load the supplier outcome.")));},[companyId,id,status]);
  useEffect(()=>{if(open&&row?.outcome==="Replacement")void http.get<{id:string;grnNo:string;receivedAt:string}[]>(`${root}/replacement-receipts`).then(r=>setReceipts(r.data)).catch(e=>setError(apiError(e,"Unable to load replacement receipts.")));},[open,row?.outcome,companyId,id]);
  async function save(){if(busy)return;setBusy(true);setError("");try{if(row)await http.post(`${root}/resolve`,{version:row.version,reference,notes,replacementGrnId:grn||null,invoiceId:row.outcome==="Replacement"?null:invoiceId,amount:row.outcome==="Replacement"?null:Number(amount)});else await http.post(root,{condition,outcome});setOpen(false);await load();onChanged();}catch(e){setError(apiError(e,"Unable to save supplier outcome. Your entries are retained."));}finally{setBusy(false);}}
  const canResolve=row?.outcome==="Replacement"?canReceive:canFinance;
  return <section className="prq-panel"><h2>{tx("Supplier outcome and evidence")}</h2>{error&&!open&&<p role="alert">{tx(error)}</p>}{row?<><p>{tx(row.outcome)} · {tx(row.status)}</p><p>{row.condition}</p><p>{row.reference} {row.notes}</p>{row.invoiceId&&<p><Link to={`/procurement/supplier-invoices/${row.invoiceId}`}>{tx("AP invoice")}</Link> · {money(row.settlementAmount,row.currencyCode)}</p>}</>:<p>{tx(status==="Posted"?"No supplier outcome recorded. Track replacement goods, a credit note or a refund.":"Post the controlled return before requesting a supplier outcome.")}</p>}
    {!loading&&status==="Posted"&&((!row&&canReceive)||(row?.status==="Unresolved"&&canResolve))&&<Button onClick={()=>setOpen(true)}>{tx(row?"Resolve supplier outcome":"Record expected outcome")}</Button>}
    <RequisitionDocuments companyId={companyId} id={id} documentType="return" editable={status!=="Cancelled"&&row?.status!=="Resolved"&&(canReceive||canFinance)} onChanged={onChanged}/>
    <ActionDialog open={open} title={tx(row?"Resolve supplier outcome":"Record expected outcome")} message={tx(row?"Attach proof first. Financial outcomes require accounts-payable review; replacements require a posted GRN covering the returned quantities.":"Record the condition of the returned goods and the expected supplier response.")} confirmText={tx("Save outcome")} busy={busy} onConfirm={()=>void save()} onClose={()=>setOpen(false)}>
      {error&&<p role="alert">{tx(error)}</p>}{row?<><label>{tx("Supplier credit, refund or replacement reference")}<Input maxLength={160} value={reference} onChange={e=>setReference(e.target.value)}/></label>{row.outcome==="Replacement"&&<label>{tx("Posted replacement receipt")}<Select value={grn} onChange={e=>setGrn(e.target.value)}><option value="">{tx("Choose a receipt")}</option>{receipts.map(r=><option key={r.id} value={r.id}>{r.grnNo} · {r.receivedAt.slice(0,10)}</option>)}</Select></label>}{row.outcome!=="Replacement"&&<><label>{tx("Approved source invoice")}<Select value={invoiceId} onChange={e=>{setInvoiceId(e.target.value);setAmount("");}}><option value="">{tx("Choose invoice")}</option>{invoices.map(i=><option key={i.id} value={i.id}>{i.internalNo} · {tx("Maximum credit")}: {money(i.maximumAmount,i.currencyCode)} · {tx("Recorded payments available for refund")}: {money(i.refundablePayments,i.currencyCode)}</option>)}</Select></label><label>{tx("Confirmed credit or refund amount in invoice currency")}<Input type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></label><p>{tx("Finance confirms the supplier document and records the balance adjustment. Refund evidence must match a completed refund against recorded payments.")}</p></>}<label>{tx("Resolution evidence summary")}<Textarea maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)}/></label></>:<><label>{tx("Condition of returned goods")}<Textarea maxLength={1000} value={condition} onChange={e=>setCondition(e.target.value)}/></label><label>{tx("Expected outcome")}<Select value={outcome} onChange={e=>setOutcome(e.target.value)}><option value="Replacement">{tx("Replacement")}</option><option value="CreditNote">{tx("Credit note")}</option><option value="Refund">{tx("Refund")}</option></Select></label></>}
    </ActionDialog>
  </section>;
}
