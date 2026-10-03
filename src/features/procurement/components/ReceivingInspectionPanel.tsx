import { useEffect,useRef,useState } from "react";
import { Link,useNavigate } from "react-router-dom";
import { http } from "../../../api/http";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";
import { useHasPermission } from "../../../auth/usePermissions";
import { useI18n } from "../../../i18n";
import type { PurchaseOrder } from "../api/purchasingApi";
import { ActionDialog,apiError,qty,todayIso } from "./p2pShared";
import {procurementDocumentsApi} from "../api/procurementDocumentsApi";
import RequisitionDocuments from "./RequisitionDocuments";

type Line={purchaseOrderLineId:string;expectedQuantity:number;deliveredQuantity:number;acceptedQuantity:number;rejectedQuantity:number;batchNo:string;expiryDate:string;reason:string};
type Inspection={id:string;grnId?:string;receiptStatus:string;receivedDate:string;notes:string;lines:(Line&{itemName:string;unit:string;shortQuantity:number;qualityResult:string})[]};
export default function ReceivingInspectionPanel({companyId,po}:{companyId:string;po:PurchaseOrder}){
  const {tx}=useI18n(),navigate=useNavigate(),canInspect=useHasPermission("purchasing.receiveinspect"),canCreateGrn=useHasPermission("grn.create");
  const [rows,setRows]=useState<Inspection[]>([]),[open,setOpen]=useState(false),[lines,setLines]=useState<Line[]>([]),[date,setDate]=useState(todayIso()),[notes,setNotes]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const key=useRef(crypto.randomUUID());const root=`/companies/${companyId}/procurement/purchase-orders/${po.id}/inspections`;
  const [photos,setPhotos]=useState<File[]>([]),[scanCode,setScan]=useState(""),[matched,setMatched]=useState<string[]>([]),[saved,setSaved]=useState<{inspectionId:string;grnId?:string}|null>(null);
  async function scan(){if(!scanCode.trim())return;setError("");try{const r=await http.get<{id:string}[]>(`${root}/scan`,{params:{code:scanCode}});setMatched(r.data.map(x=>x.id));if(!r.data.length)setError("This item has no outstanding quantity on the order.");else document.getElementById(`receiving-${r.data[0].id}`)?.scrollIntoView({behavior:"smooth",block:"center"});}catch(e){setError(apiError(e,"Unable to match the scanned item."));}}
  async function load(){setRows((await http.get<Inspection[]>(root)).data);}
  useEffect(()=>{void load().catch(e=>setError(apiError(e,"Unable to load receiving inspections.")));},[companyId,po.id,po.version]);
  function start(){key.current=crypto.randomUUID();setSaved(null);setPhotos([]);setScan("");setMatched([]);setLines(po.lines.filter(l=>l.lineType==="InventoryItem"&&l.outstandingQty>0).map(l=>({purchaseOrderLineId:l.id,expectedQuantity:l.outstandingQty,deliveredQuantity:l.outstandingQty,acceptedQuantity:l.outstandingQty,rejectedQuantity:0,batchNo:"",expiryDate:"",reason:""})));setNotes("");setDate(todayIso());setError("");setOpen(true);}
  const patch=(index:number,change:Partial<Line>)=>setLines(l=>l.map((row,i)=>i===index?{...row,...change}:row));
  async function save(){if(busy)return;setBusy(true);setError("");try{
    if(photos.length>20||photos.some(f=>f.size>5*1024*1024))throw new Error("Choose up to 20 photos of at most 5 MB each.");
    let result=saved;
    if(!result){result=(await http.post<{inspectionId:string;grnId?:string}>(root,{clientRequestId:key.current,receivingLocationId:po.deliveryLocationId,receivedDate:date,notes,lines:lines.map(l=>({...l,expiryDate:l.expiryDate?`${l.expiryDate}T00:00:00Z`:null,qualityResult:l.acceptedQuantity===0&&l.rejectedQuantity>0?"Rejected":l.rejectedQuantity>0?"PartiallyRejected":"Passed"}))})).data;setSaved(result);}
    for(const photo of photos)await procurementDocumentsApi.upload(companyId,result.inspectionId,photo,"inspection");
    setOpen(false);await load();if(result.grnId)navigate(`/companies/${companyId}/grns/${result.grnId}/edit`);
  }catch(e){setError(apiError(e,"Unable to finish saving inspection evidence. Retry with the same delivery; saved quantities and uploaded photos will not be duplicated."));}finally{setBusy(false);}}
  const available=canInspect&&canCreateGrn&&["Approved","Sent","PartiallyReceived"].includes(po.status)&&po.lines.some(l=>l.lineType==="InventoryItem"&&l.outstandingQty>0);
  return <section className="prq-panel"><h2>{tx("Receiving and quality inspection")}</h2>{error&&!open&&<p role="alert">{tx(error)}</p>}{available&&<Button onClick={start}>{tx("Inspect and receive goods")}</Button>}
    <p>{tx("Only accepted quantities go to the GRN. Post the reviewed GRN to update stock and order fulfilment; rejected goods stay outside available inventory.")}</p>
    {rows.map(r=><details key={r.id}><summary>{r.receivedDate} · {tx(r.receiptStatus)}</summary>{r.grnId&&<Link to={`/companies/${companyId}/grns/${r.grnId}`}>{tx("Open goods receipt")}</Link>}<ul>{r.lines.map(l=><li key={l.purchaseOrderLineId}>{l.itemName} · {tx("Delivered")}: {qty(l.deliveredQuantity)} · {tx("Accepted")}: {qty(l.acceptedQuantity)} · {tx("Rejected")}: {qty(l.rejectedQuantity)} · {tx("Short")}: {qty(l.shortQuantity)} {l.unit}{l.reason?` · ${l.reason}`:""}</li>)}</ul><p>{r.notes}</p><RequisitionDocuments companyId={companyId} id={r.id} documentType="inspection" editable={canInspect&&(!r.grnId||["Draft","Approved"].includes(r.receiptStatus))}/></details>)}
    <ActionDialog open={open} title={tx("Inspect supplier delivery")} message={tx("Record expected, delivered, accepted and rejected quantities. Explain discrepancies and enter batch and expiry details for perishable goods.")} confirmText={tx("Save inspection and prepare GRN")} busy={busy} onConfirm={()=>void save()} onClose={()=>setOpen(false)}>
      {error&&<p role="alert" className="prq-alert">{tx(error)}</p>}{saved&&<p role="status">{tx("Inspection saved. Finish uploading photos, then review and post the goods receipt.")}</p>}
      <label>{tx("Scan barcode or enter SKU")}<Input value={scanCode} onChange={e=>setScan(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();void scan();}}}/></label><Button type="button" variant="outline" onClick={()=>void scan()}>{tx("Find scanned item")}</Button>
      <label>{tx("Received date")}<Input disabled={!!saved||busy} type="date" value={date} max={todayIso()} onChange={e=>setDate(e.target.value)}/></label>
      {lines.map((l,index)=><fieldset disabled={!!saved||busy} id={`receiving-${l.purchaseOrderLineId}`} key={l.purchaseOrderLineId}><legend>{po.lines.find(x=>x.id===l.purchaseOrderLineId)?.itemName}{matched.includes(l.purchaseOrderLineId)?` · ${tx("Scanned item")}`:""}</legend><div className="prq-form-grid">{(["expectedQuantity","deliveredQuantity","acceptedQuantity","rejectedQuantity"] as const).map((field,i)=><label key={field}>{tx(["Expected this delivery","Delivered","Accepted","Rejected"][i])}<Input inputMode="decimal" type="number" min={0} step="0.0001" value={l[field]} onChange={e=>patch(index,{[field]:Number(e.target.value)})}/></label>)}<label>{tx("Batch number")}<Input maxLength={80} value={l.batchNo} onChange={e=>patch(index,{batchNo:e.target.value})}/></label><label>{tx("Expiry date")}<Input type="date" value={l.expiryDate} onChange={e=>patch(index,{expiryDate:e.target.value})}/></label></div><p>{tx("Short-delivered")}: {qty(Math.max(0,l.expectedQuantity-l.deliveredQuantity))}</p><label>{tx("Quality checks and discrepancy reason")}<Textarea maxLength={1000} value={l.reason} onChange={e=>patch(index,{reason:e.target.value})}/></label></fieldset>)}
      <label>{tx("Receiving notes")}<Textarea disabled={!!saved||busy} maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)}/></label>
      <label>{tx("Delivery photos (JPEG or PNG, up to 5 MB each)")}<Input disabled={busy} type="file" accept="image/jpeg,image/png" capture="environment" multiple onChange={e=>setPhotos(Array.from(e.target.files??[]))}/></label>{photos.map((f,i)=><p key={`${f.name}-${i}`}>{f.name}</p>)}
    </ActionDialog>
  </section>;
}
