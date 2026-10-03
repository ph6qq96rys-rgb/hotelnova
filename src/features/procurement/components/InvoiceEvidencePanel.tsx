import RequisitionDocuments from "./RequisitionDocuments";
import {useEffect,useState} from "react";
import {Link} from "react-router-dom";
import {http} from "../../../api/http";
import {useI18n} from "../../../i18n";
import {apiError,money,qty} from "./p2pShared";
type Evidence={apStatus:string;supplierSubmissions:{id:string;reviewReason:string}[];settlements:{returnId:string;outcome:string;reference:string;settlementAmount:number;currencyCode:string}[];receipts:{id:string;grnNo:string;qty:number;purchaseOrderLineId:string}[];acceptances:{id:string;purchaseOrderId:string;quantity:number;description:string}[]};
export default function InvoiceEvidencePanel({companyId,id,version}:{companyId:string;id:string;version:string}){
  const {tx}=useI18n(),[data,setData]=useState<Evidence|null>(null),[error,setError]=useState("");
  useEffect(()=>{let active=true;setError("");void http.get<Evidence>(`/companies/${companyId}/procurement/supplier-invoices/${id}/evidence`).then(r=>{if(active)setData(r.data);}).catch(e=>{if(active)setError(apiError(e,"Unable to load invoice evidence."));});return()=>{active=false;};},[companyId,id,version]);
  return <section className="prq-panel"><h2>{tx("Receiving evidence and accounts payable")}</h2>{error&&<p role="alert">{tx(error)}</p>}{data&&<><p>{tx(data.apStatus)}</p><p>{tx("Approval makes this invoice available to accounts payable. The payment status shown here comes from the same payable record.")}</p><ul>{data.receipts.map((r,i)=><li key={`${r.id}-${i}`}><Link to={`/companies/${companyId}/grns/${r.id}`}>{r.grnNo}</Link> · {qty(r.qty)}</li>)}{data.acceptances.map(a=><li key={a.id}><Link to={`/companies/${companyId}/procurement/purchase-orders/${a.purchaseOrderId}`}>{tx("Accepted service or equipment")}</Link> · {qty(a.quantity)} · {a.description}</li>)}</ul>{data.supplierSubmissions.map(s=><details key={s.id}><summary>{tx("Validated supplier invoice attachment")}</summary><p>{s.reviewReason}</p><RequisitionDocuments companyId={companyId} id={s.id} documentType="supplier-submission" editable={false}/></details>)}{data.settlements.map(s=><p key={s.returnId}><Link to={`/procurement/purchase-returns/${s.returnId}`}>{tx(s.outcome)} · {s.reference}</Link> · {money(s.settlementAmount,s.currencyCode)}</p>)}</>}</section>;
}
