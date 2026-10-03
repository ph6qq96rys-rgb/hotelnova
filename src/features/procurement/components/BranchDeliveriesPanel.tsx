import {useEffect,useState} from "react";
import {Link} from "react-router-dom";
import {http} from "../../../api/http";
import {Button} from "../../../components/ui/button";
import {Select} from "../../../components/ui/select";
import {useI18n} from "../../../i18n";
import {useHasPermission} from "../../../auth/usePermissions";
import {apiError,qty,money} from "./p2pShared";
type Line={id:string;itemName:string;uomName:string;orderedQty:number;receivedQty:number;deliveredQuantity:number;direct:boolean;source:{id:string;requisitionNo:string}};
type Data={lines:Line[];history:{delivery:{id:string;allocatedCost:number;purchaseQuantity:number};transferNo:string;status:string;active:boolean}[]};
export default function BranchDeliveriesPanel({companyId,id,version}:{companyId:string;id:string;version:string}){
 const {tx}=useI18n(),canAllocate=useHasPermission("purchasing.receiveinspect");const [data,setData]=useState<Data>({lines:[],history:[]}),[lineId,setLine]=useState(""),[options,setOptions]=useState<{id:string;transferNo:string;lineNo:number;qty:number}[]>([]),[transferLineId,setTransfer]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");const root=`/companies/${companyId}/procurement/purchase-orders/${id}/branch-deliveries`;
 async function load(){setData((await http.get<Data>(root)).data);}
 useEffect(()=>{void load().catch(e=>setError(apiError(e,"Unable to load branch fulfilment.")));},[companyId,id,version]);
 useEffect(()=>{setOptions([]);setTransfer("");if(!lineId)return;let active=true;http.get(`${root}/${lineId}/transfers`).then(r=>{if(active)setOptions(r.data);}).catch(e=>{if(active)setError(apiError(e,"Unable to load posted branch transfers."));});return()=>{active=false;};},[companyId,id,lineId]);
 async function allocate(){setBusy(true);setError("");try{await http.post(root,{lineId,transferLineId});await load();setLine("");}catch(e){setError(apiError(e,"Unable to allocate the branch transfer."));}finally{setBusy(false);}}
 if(data.lines.length===0&&!error)return null;
 return <section className="prq-panel"><h2>{tx("Branch fulfilment")}</h2>{error&&<p role="alert">{tx(error)}</p>}{data.lines.map(l=><p key={l.id}>{l.itemName} · <Link to={`/procurement/requisitions/${l.source.id}`}>{l.source.requisitionNo}</Link> · {tx("Received from supplier")}: {qty(l.receivedQty)} · {tx("Delivered to requesting destination")}: {qty(l.direct?l.receivedQty:l.deliveredQuantity)} {l.uomName}</p>)}{data.history.map(h=><p key={h.delivery.id}>{h.transferNo} · {tx(h.status)} · {qty(h.delivery.purchaseQuantity)} · {tx("Allocated supplier cost")}: {money(h.delivery.allocatedCost)}</p>)}{canAllocate&&data.lines.some(l=>!l.direct)&&<fieldset disabled={busy}><legend>{tx("Link a posted branch transfer")}</legend><label>{tx("Source requirement")}<Select value={lineId} onChange={e=>setLine(e.target.value)}><option value="">{tx("Choose order line")}</option>{data.lines.filter(l=>!l.direct).map(l=><option key={l.id} value={l.id}>{l.itemName} · {l.source.requisitionNo}</option>)}</Select></label><label>{tx("Posted transfer line")}<Select value={transferLineId} onChange={e=>setTransfer(e.target.value)}><option value="">{tx("Choose matching transfer")}</option>{options.map(o=><option key={o.id} value={o.id}>{o.transferNo} · {tx("Line")} {o.lineNo} · {qty(o.qty)}</option>)}</Select></label><Button disabled={!lineId||!transferLineId} onClick={()=>void allocate()}>{tx("Allocate branch delivery")}</Button></fieldset>}</section>;
}
