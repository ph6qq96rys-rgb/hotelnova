import {useEffect,useState} from "react";
import {http} from "../../../api/http";
import {useI18n} from "../../../i18n";
import {apiError} from "./p2pShared";
type Controls={reviewed:boolean;requiresFinanceReview:boolean;findings:{policyVersionId:string;ruleName:string;action:string;itemName:string;reason:string}[]};
export default function SupplierControlsPanel({companyId,id,version}:{companyId:string;id:string;version:string}){
 const {tx}=useI18n(),[data,setData]=useState<Controls|null>(null),[error,setError]=useState("");
 useEffect(()=>{let active=true;setData(null);setError("");http.get<Controls>(`/companies/${companyId}/procurement/purchase-orders/${id}/supplier-controls`).then(r=>{if(active)setData(r.data);}).catch(e=>{if(active)setError(apiError(e,"Unable to evaluate supplier eligibility rules."));});return()=>{active=false;};},[companyId,id,version]);
 return <section className="prq-panel"><h2>{tx("Supplier eligibility controls")}</h2>{error&&<p role="alert">{tx(error)}</p>}{data&&!data.findings.length&&<p>{tx("No additional supplier eligibility exceptions.")}</p>}{data?.findings.map((f,i)=><p key={`${f.policyVersionId}:${i}`}><strong>{f.ruleName} · {tx(f.action)}</strong> · {f.itemName}: {tx(f.reason)}</p>)}{data?.requiresFinanceReview&&<p>{tx(data.reviewed?"Finance reviewed these supplier conditions.":"Independent finance approval with a justification is required before issuance. Changes to the supplier, order or applicable rule require a new review.")}</p>}</section>;
}
