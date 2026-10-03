import {useEffect,useState} from "react";
import {Link} from "react-router-dom";
import {PageHeader} from "../../../components/PageHeader";
import {Input} from "../../../components/ui/input";
import {Button} from "../../../components/ui/button";
import {Select} from "../../../components/ui/select";
import {useI18n} from "../../../i18n";
import {purchaseOrdersApi,type PurchaseOrder} from "../api/purchasingApi";
import ReceivingInspectionPanel from "../components/ReceivingInspectionPanel";
import {apiError,useCompanyId} from "../components/p2pShared";
export default function MobileReceivingPage(){
 const {tx}=useI18n(),companyId=useCompanyId();const [search,setSearch]=useState(""),[orders,setOrders]=useState<PurchaseOrder[]>([]),[id,setId]=useState(""),[po,setPo]=useState<PurchaseOrder|null>(null),[error,setError]=useState(""),[page,setPage]=useState(1),[total,setTotal]=useState(0);
 useEffect(()=>{if(!companyId)return;let active=true;const timer=setTimeout(()=>{purchaseOrdersApi.list(companyId,{search,openOnly:true,page,pageSize:25}).then(r=>{if(active){setOrders(r.items);setTotal(r.totalCount);}}).catch(e=>{if(active)setError(apiError(e,"Unable to load outstanding orders."));});},250);return()=>{active=false;clearTimeout(timer);};},[companyId,search,page]);
 useEffect(()=>{setPo(null);if(!id)return;let active=true;purchaseOrdersApi.get(companyId,id).then(p=>{if(active)setPo(p);}).catch(e=>{if(active)setError(apiError(e,"Unable to load the order."));});return()=>{active=false;};},[companyId,id]);
 return <main className="prq-page"><PageHeader title={tx("Receive deliveries")} subtitle={tx("Find an order, scan its items, record quality checks and attach delivery photos.")}/>{error&&<p role="alert">{tx(error)}</p>}<section className="prq-panel"><label>{tx("Find order or supplier")}<Input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/></label><label>{tx("Outstanding order")}<Select value={id} onChange={e=>setId(e.target.value)}><option value="">{tx("Choose an order")}</option>{orders.filter(o=>["Approved","Sent","PartiallyReceived"].includes(o.status)).map(o=><option key={o.id} value={o.id}>{o.poNo} · {o.supplierName}</option>)}</Select></label><Button variant="outline" disabled={page===1} onClick={()=>setPage(p=>p-1)}>{tx("Previous")}</Button><span> {page} </span><Button variant="outline" disabled={page*25>=total} onClick={()=>setPage(p=>p+1)}>{tx("Next")}</Button></section>{po&&<><section className="prq-panel"><h2>{po.poNo}</h2><p>{po.supplierName} · {tx(po.status)}</p><Link to={`/procurement/purchase-orders/${po.id}`}>{tx("Open full order")}</Link></section><ReceivingInspectionPanel companyId={companyId} po={po}/></>}</main>;
}
