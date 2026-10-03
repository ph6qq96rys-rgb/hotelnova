import { useEffect,useState } from "react";
import { Link } from "react-router-dom";
import { http } from "../../../api/http";
import { useI18n } from "../../../i18n";
import { useHasPermission } from "../../../auth/usePermissions";
import { StatusChip,apiError,dateTime,money } from "./p2pShared";

type Match={id:string;code:string;name:string;taxId?:string;phone:string};
type Order={id:string;poNo:string;status:string;createdAt:string;expectedDeliveryDate?:string;grandTotal:number;currencyCode:string};
export default function SupplierReview({companyId,id,name,taxId,phone}:{companyId:string;id?:string;name:string;taxId?:string|null;phone?:string|null}){
  const {tx}=useI18n();const canView=useHasPermission("suppliers.view"),canPurchasing=useHasPermission("purchasing.view");
  const [matches,setMatches]=useState<Match[]>([]),[orders,setOrders]=useState<Order[]>([]),[error,setError]=useState("");
  useEffect(()=>{if(!canView)return;let active=true;const timer=setTimeout(()=>{void http.get<Match[]>(`/companies/${companyId}/procurement/supplier-review/duplicates`,{params:{name,taxId,phone,excludeId:id}}).then(r=>{if(active)setMatches(r.data);}).catch(e=>{if(active)setError(apiError(e,"Unable to check possible duplicate suppliers."));});},350);return()=>{active=false;clearTimeout(timer);};},[companyId,id,name,taxId,phone,canView]);
  useEffect(()=>{if(!id||!canPurchasing||!canView)return;let active=true;void http.get<Order[]>(`/companies/${companyId}/procurement/supplier-review/${id}/history`).then(r=>{if(active)setOrders(r.data);}).catch(e=>{if(active)setError(apiError(e,"Unable to load supplier order history."));});return()=>{active=false;};},[companyId,id,canPurchasing,canView]);
  return <section className="prq-panel">{error&&<p role="alert">{tx(error)}</p>}{matches.length>0&&<><h2>{tx("Possible duplicate suppliers")}</h2><p>{tx("Review matching names, tax numbers or phone numbers before saving a new supplier.")}</p><ul>{matches.map(s=><li key={s.id}><Link to={`/companies/${companyId}/procurement/suppliers/${s.id}`} target="_blank" rel="noreferrer">{s.code} · {s.name}</Link> · {s.taxId} · {s.phone}</li>)}</ul></>}
    {id&&canPurchasing&&<><h2>{tx("Recent purchase orders")}</h2>{orders.length===0?<p>{tx("No purchase orders in your authorized scope.")}</p>:<ul>{orders.map(o=><li key={o.id}><Link to={`/companies/${companyId}/procurement/purchase-orders/${o.id}`}>{o.poNo}</Link> · {dateTime(o.createdAt)} · {money(o.grandTotal)} · <StatusChip status={o.status.charAt(0).toUpperCase()+o.status.slice(1)}/></li>)}</ul>}</>}
  </section>;
}
