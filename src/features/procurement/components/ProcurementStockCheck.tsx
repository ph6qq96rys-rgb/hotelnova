import { useEffect,useState,useRef } from "react";
import { Link } from "react-router-dom";
import { http } from "../../../api/http";
import { Button } from "../../../components/ui/button";
import { useI18n } from "../../../i18n";
import { apiError,qty,dateTime } from "./p2pShared";

type Commitment={id:string;reference:string;status:string;quantity:number;unit:string;baseQuantity:number|null;expectedAtUtc:string|null};
type Result={baseUomId:string;baseUnit:string;requestedBaseQuantity:number;onHandBaseQuantity:number;reservedBaseQuantity:number;availableBaseQuantity:number;incomingByRequiredDate:number;recommendedBaseQuantity:number|null;requisitions:Commitment[];orders:Commitment[];explanations:string[];transferable:{branchId:string;locationId:string;locationName:string;availableBaseQuantity:number;canInitiateTransfer:boolean}[]};
type Props={companyId:string;branchId?:string|null;locationId?:string|null;itemId?:string|null;uomId?:string|null;quantity:number;requiredDate:string;requisitionId?:string};
export default function ProcurementStockCheck(p:Props){
 const {tx}=useI18n(),[result,setResult]=useState<Result|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const generation=useRef(0);
 useEffect(()=>{generation.current++;setResult(null);setError("");setBusy(false);return()=>{generation.current++;};},[p.companyId,p.branchId,p.locationId,p.itemId,p.uomId,p.quantity,p.requiredDate,p.requisitionId]);
 async function check(){const current=++generation.current;setBusy(true);setError("");try{const response=await http.get<Result>(`/companies/${p.companyId}/procurement/availability`,{params:{branchId:p.branchId,locationId:p.locationId,itemId:p.itemId,uomId:p.uomId,quantity:p.quantity,requiredDate:p.requiredDate.slice(0,10),excludeRequisitionId:p.requisitionId}});if(current===generation.current)setResult(response.data);}catch(e){if(current===generation.current)setError(apiError(e,"Unable to check stock and purchase commitments."));}finally{if(current===generation.current)setBusy(false);}}
 return <div className="prq-span-2"><Button variant="outline" disabled={busy||!p.itemId||!p.locationId||p.quantity<=0||!p.requiredDate} onClick={()=>void check()}>{busy?tx("Checking..."):tx("Check stock and existing commitments")}</Button>
  {!p.locationId&&<p>{tx("Select a destination to check available stock.")}</p>}{error&&<p role="alert">{tx(error)}</p>}
  {result&&<section aria-label={tx("Stock and purchasing commitments")}>
   <dl className="prq-detail-grid"><div><dt>{tx("On hand")}</dt><dd>{qty(result.onHandBaseQuantity)} {result.baseUnit}</dd></div><div><dt>{tx("Reserved")}</dt><dd>{qty(result.reservedBaseQuantity)}</dd></div><div><dt>{tx("Usable available stock")}</dt><dd>{qty(result.availableBaseQuantity)}</dd></div><div><dt>{tx("Incoming by required date")}</dt><dd>{qty(result.incomingByRequiredDate)}</dd></div><div><dt>{tx("Recommended purchase quantity")}</dt><dd>{result.recommendedBaseQuantity==null?tx("Unable to calculate"):qty(result.recommendedBaseQuantity)} {result.baseUnit}</dd></div></dl>
   {result.explanations.map(e=><p key={e}>{e}</p>)}
   {[{title:"Overlapping requisitions",rows:result.requisitions,path:"requisitions"},{title:"Outstanding purchase orders",rows:result.orders,path:"purchase-orders"}].map(group=><div key={group.path}><h3>{tx(group.title)}</h3>{group.rows.length===0?<p>{tx("None found in your authorized scope.")}</p>:<ul>{group.rows.map((row,i)=><li key={`${row.id}-${i}`}><Link to={`/companies/${p.companyId}/procurement/${group.path}/${row.id}`} target="_blank" rel="noreferrer">{row.reference}</Link> · {qty(row.quantity)} {row.unit} · {row.baseQuantity==null?tx("Missing unit conversion"):`${qty(row.baseQuantity)} ${result.baseUnit}`} · {dateTime(row.expectedAtUtc)} · {tx(row.status)}</li>)}</ul>}</div>)}
   <h3>{tx("Transferable stock at authorized locations")}</h3>{result.transferable.length===0?<p>{tx("No usable transferable stock found.")}</p>:<ul>{result.transferable.map(s=>{const search=new URLSearchParams({branchId:s.branchId,fromLocationId:s.locationId,toLocationId:p.locationId??"",itemId:p.itemId??"",unitId:result.baseUomId,quantity:String(Math.min(s.availableBaseQuantity,result.requestedBaseQuantity))});return <li key={s.locationId}>{s.locationName}: {qty(s.availableBaseQuantity)} {result.baseUnit} {s.canInitiateTransfer&&<Link target="_blank" rel="noreferrer" to={`/companies/${p.companyId}/inventory/stock-transfers/new?${search}`}>{tx("Start transfer request")}</Link>}</li>;})}</ul>}
  </section>}
 </div>;
}
