import {useEffect,useState} from "react";
import {http} from "../../../api/http";
import {Button} from "../../../components/ui/button";
import {useI18n} from "../../../i18n";
import {apiError,qty} from "./p2pShared";
type Suggestion={name:string;revision:number;unitPrice?:number;paymentTermDays:number;status:string;currencyCode:string};
export default function NegotiatedPriceHint(p:{companyId:string;supplierId?:string;branchId?:string|null;itemId?:string|null;uomId?:string|null;quantity:number;currency:string;date:string;onUse:(price:number)=>void}){
  const {tx}=useI18n(),[row,setRow]=useState<Suggestion|null>(null),[error,setError]=useState("");
  useEffect(()=>{let active=true;setRow(null);setError("");if(!p.companyId||!p.supplierId||!p.itemId||!p.uomId||p.quantity<=0)return;const timer=setTimeout(()=>{void http.get<Suggestion|null>(`/companies/${p.companyId}/procurement/agreements/suggest`,{params:{supplierId:p.supplierId,branchId:p.branchId||undefined,itemId:p.itemId,uomId:p.uomId,quantity:p.quantity,currency:p.currency,date:p.date}}).then(r=>{if(active)setRow(r.data);}).catch(e=>{if(active)setError(apiError(e,"Unable to check negotiated price."));});},350);return()=>{active=false;clearTimeout(timer);};},[p.companyId,p.supplierId,p.branchId,p.itemId,p.uomId,p.quantity,p.currency,p.date]);
  return error?<p role="status">{tx(error)}</p>:row?<div><p>{row.name} · {tx("Revision")} {row.revision} · {tx(row.status)} · {row.paymentTermDays} {tx("payment-term days")}</p>{row.unitPrice!=null&&<Button type="button" variant="ghost" onClick={()=>p.onUse(row.unitPrice!)}>{tx("Use negotiated net price")} {qty(row.unitPrice)} {row.currencyCode}</Button>}</div>:null;
}
