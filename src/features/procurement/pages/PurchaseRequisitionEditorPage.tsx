import { Textarea } from "../../../components/ui/textarea";
import { Select } from "../../../components/ui/select";
import { Input } from "../../../components/ui/input";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { http } from "../../../api/http";
import { useI18n } from "../../../i18n";
import { useAppScope } from "../../../app/useAppScope";
import { Button } from "../../../components/ui/button";
import { inventoryItemsApi } from "../../inventoryMaster/items/api/inventoryItemsApi";
import type { InventoryItemDto } from "../../inventoryMaster/items/types";
import { stockLocationsApi } from "../../inventory/stock-locations/api/stockLocationsApi";
import type { StockLocationDto } from "../../inventory/stock-locations/types";
import { createPurchaseRequisition, updatePurchaseRequisition, getPurchaseRequisition, submitPurchaseRequisition, listReorderSuggestions, type CreatePurchaseRequisitionPayload, type PurchaseRequisition } from "../api/procurementApi";
import { procurementDocumentsApi } from "../api/procurementDocumentsApi";
import { apiError, money, todayIso } from "../components/p2pShared";
import RequisitionDocuments from "../components/RequisitionDocuments";
import ProcurementStockCheck from "../components/ProcurementStockCheck";
import "./procurement.css";

const blankLine=()=>({lineType:"InventoryItem",inventoryItemId:null as string|null,itemName:"",uomId:null as string|null,uomName:"Unit",quantity:1,estimatedUnitPrice:0,specification:""});
const blank=():CreatePurchaseRequisitionPayload=>({branchId:null,requiredStockLocationId:null,deliveryLocationId:null,priority:"Normal",purchaseCategory:"",businessJustification:"",requiredByDateUtc:todayIso(1),submit:false,lines:[blankLine()]});
const unwrap=<T,>(data:T[]|{items?:T[]})=>Array.isArray(data)?data:data.items??[];

export default function PurchaseRequisitionEditorPage() {
  const {companyId,id}=useParams<{companyId:string;id:string}>(),navigate=useNavigate(),{tx}=useI18n();
  const scope=useAppScope();
  // New requisitions default to the active branch: branch-scoped users cannot raise company-level documents.
  const [form,setForm]=useState<CreatePurchaseRequisitionPayload>(()=>({...blank(),branchId:scope.branchId||null})),[document,setDocument]=useState<PurchaseRequisition|null>(null);
  const [branches,setBranches]=useState<{id:string;name:string}[]>([]),[locations,setLocations]=useState<StockLocationDto[]>([]),[items,setItems]=useState<InventoryItemDto[]>([]);
  const [files,setFiles]=useState<File[]>([]),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const requestId=useRef(crypto.randomUUID()),saved=useRef<PurchaseRequisition|null>(null);
  const itemMap=useMemo(()=>new Map(items.map(i=>[i.id,i])),[items]);
  const editable=!document||["Draft","Returned"].includes(document.status);
  const patch=(change:Partial<CreatePurchaseRequisitionPayload>)=>setForm(f=>({...f,...change}));
  const patchLine=(index:number,change:Partial<CreatePurchaseRequisitionPayload["lines"][number]>)=>setForm(f=>({...f,lines:f.lines.map((l,i)=>i===index?{...l,...change}:l)}));
  useEffect(()=>{if(!id&&!form.branchId&&scope.branchId)setForm(f=>f.branchId?f:{...f,branchId:scope.branchId});},[id,scope.branchId]);
  useEffect(()=>{
    if(!companyId)return;let active=true;setLoading(true);
    Promise.all([http.get(`/companies/${companyId}/branches`).catch(()=>({data:[] as {id:string;name:string}[]})),inventoryItemsApi.list(companyId),id?getPurchaseRequisition(companyId,id):Promise.resolve(null)])
      .then(([b,i,r])=>{if(!active)return;setBranches(unwrap(b.data));setItems(i.filter(x=>x.isActive));if(r){saved.current=r;setDocument(r);setForm({...r,requiredByDateUtc:r.requiredByDateUtc.slice(0,10),submit:false,lines:r.lines.map(l=>({...l}))});}})
      .catch(e=>active&&setError(apiError(e,"Unable to load requisition setup."))).finally(()=>active&&setLoading(false));
    return()=>{active=false;};
  },[companyId,id]);
  useEffect(()=>{if(!companyId)return;let active=true;stockLocationsApi.list(companyId,form.branchId).then(l=>active&&setLocations(l.filter(x=>x.isActive).map(x=>({...x,id:(x as {stockLocationId?:string}).stockLocationId??x.id})))).catch(e=>active&&setError(apiError(e,"Unable to load authorized locations.")));return()=>{active=false;};},[companyId,form.branchId]);
  async function loadReorder(){if(!companyId)return;setBusy(true);setError("");try{const rows=await listReorderSuggestions(companyId,{branchId:form.branchId,stockLocationId:form.requiredStockLocationId});if(!rows.length){setError(tx("No items require replenishment at this location."));return;}patch({lines:rows.map(r=>({lineType:"InventoryItem",inventoryItemId:r.inventoryItemId,itemName:r.itemName,uomId:r.uomId,uomName:r.uomName,quantity:r.suggestedPurchaseQty,estimatedUnitPrice:r.estimatedUnitPrice,specification:r.recommendation}))});}catch(e){setError(apiError(e,"Unable to load reorder suggestions."));}finally{setBusy(false);}}
  async function save(submit:boolean){
    if(!companyId||busy||!editable)return;
    if(!form.businessJustification.trim()||!form.purchaseCategory.trim()||!form.requiredByDateUtc){setError(tx("Purpose, category and required date are required."));return;}
    if(form.lines.some(l=>!l.itemName.trim()||l.quantity<=0||!Number.isFinite(l.quantity)||l.estimatedUnitPrice<0||!Number.isFinite(l.estimatedUnitPrice)||(l.lineType==="InventoryItem"&&(!l.inventoryItemId||!l.uomId)))){setError(tx("Complete each item, purchase unit, positive quantity and estimated price."));return;}
    if(files.length>20||files.some(f=>f.size>5*1024*1024)){setError(tx("Use up to 20 attachments, no larger than 5 MB each."));return;}
    setBusy(true);setError("");
    try{
      const payload={...form,submit:false,requiredByDateUtc:`${form.requiredByDateUtc?.slice(0,10)}T00:00:00Z`};
      const result=saved.current?await updatePurchaseRequisition(companyId,saved.current.id,{...payload,version:saved.current.version}):await createPurchaseRequisition(companyId,{...payload,clientRequestId:requestId.current});
      if(!result.success||!result.id)throw Error(result.error??"Unable to save requisition.");
      saved.current=await getPurchaseRequisition(companyId,result.id);setDocument(saved.current);
      for(const file of files)await procurementDocumentsApi.upload(companyId,result.id,file);
      setFiles([]);saved.current=await getPurchaseRequisition(companyId,result.id);
      if(submit){const submitted=await submitPurchaseRequisition(companyId,result.id);if(!submitted.success)throw Error(submitted.error??"Draft saved, but submission failed.");}
      navigate(`/companies/${companyId}/procurement/requisitions/${result.id}`);
    }catch(e){if(saved.current){try{saved.current=await getPurchaseRequisition(companyId,saved.current.id);setDocument(saved.current);}catch{/* Preserve the draft reference for retry. */}}setError(apiError(e,"Unable to save. Your entered details have been retained."));}
    finally{setBusy(false);}
  }
  if(loading)return <main className="prq-page" aria-busy="true">{tx("Loading requisition...")}</main>;
  return <main className="prq-page">
    <header className="prq-page-header"><div><div className="prq-kicker">{tx("Procurement")}</div><h1>{document?`${tx("Edit requisition")} · ${document.requisitionNo}`:tx("New purchase requisition")}</h1><p>{tx("Capture goods, services or equipment and the destination that needs them.")}</p></div><Button variant="outline" onClick={()=>navigate(-1)} disabled={busy}>{tx("Back")}</Button></header>
    {error&&<div role="alert" className="prq-alert">{tx(error)}</div>}
    {!editable&&<p role="alert">{tx("Only drafts and changes-requested requisitions can be edited.")}</p>}
    <fieldset disabled={busy||!editable} style={{border:0,padding:0,margin:0}}>
      <section className="prq-panel prq-form-grid">
        <label>{tx("Requester")}<Input readOnly value={document?.requestedByName??tx("Current signed-in user")}/></label>
        <label>{tx("Branch")}<Select value={form.branchId??""} disabled={!!document} onChange={e=>patch({branchId:e.target.value||null,requiredStockLocationId:null,deliveryLocationId:null})}><option value="">{tx("Company scope")}</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</Select></label>
        <label>{tx("Destination stock location")}<Select value={form.requiredStockLocationId??""} onChange={e=>patch({requiredStockLocationId:e.target.value||null,deliveryLocationId:e.target.value||null})}><option value="">{tx("Not applicable / select location")}</option>{locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</Select></label>
        <label>{tx("Required by")}<Input type="date" value={form.requiredByDateUtc?.slice(0,10)??""} onChange={e=>patch({requiredByDateUtc:e.target.value})}/></label>
        <label>{tx("Priority")}<Select value={form.priority} onChange={e=>patch({priority:e.target.value})}>{["Low","Normal","High","Urgent","Emergency"].map(p=><option key={p} value={p}>{tx(p)}</option>)}</Select></label>
        <label>{tx("Purchase category")}<Input maxLength={120} value={form.purchaseCategory} onChange={e=>patch({purchaseCategory:e.target.value})}/></label>
        <label className="prq-span-2">{tx("Purpose / business justification")}<Textarea maxLength={2000} value={form.businessJustification} onChange={e=>patch({businessJustification:e.target.value})}/></label>
        <label>{tx("Cost center")}<Input value={form.costCenterCode??""} onChange={e=>patch({costCenterCode:e.target.value})}/></label>
        <label>{tx("Related reference")}<Input value={form.relatedReference??""} onChange={e=>patch({relatedReference:e.target.value})}/></label>
      </section>
      <section className="prq-panel"><div className="prq-section-title"><h2>{tx("Requested lines")}</h2><div className="prq-actions"><Button variant="outline" onClick={()=>void loadReorder()}>{tx("Load below reorder")}</Button><Button variant="outline" onClick={()=>patch({lines:[...form.lines,blankLine()]})}>{tx("Add line")}</Button></div></div>
        <div className="prq-lines">{form.lines.map((line,index)=>{
          const item=line.inventoryItemId?itemMap.get(line.inventoryItemId):undefined;
          const uoms=(item?.uoms??item?.allowedUoms??[]).filter(u=>u.isActive&&u.isPurchase);
          return <section className="prq-panel prq-form-grid" key={index} aria-label={`${tx("Line")} ${index+1}`}>
            <label>{tx("Type")}<Select value={line.lineType} onChange={e=>patchLine(index,{lineType:e.target.value,inventoryItemId:null,uomId:null,itemName:"",uomName:"Unit"})}>{["InventoryItem","NonInventoryGood","Service","Expense","FixedAsset"].map(t=><option key={t}>{t}</option>)}</Select></label>
            <label>{tx("Item or service")}{line.lineType==="InventoryItem"?<Select value={line.inventoryItemId??""} onChange={e=>{const i=itemMap.get(e.target.value);const u=(i?.uoms??i?.allowedUoms??[]).find(x=>x.isActive&&x.isPurchase);patchLine(index,{inventoryItemId:i?.id??null,itemName:i?.name??"",uomId:u?.uomId??null,uomName:u?.code??""});}}><option value="">{tx("Select item")}</option>{items.map(i=><option key={i.id} value={i.id}>{i.sku} · {i.name}</option>)}</Select>:<Input value={line.itemName} onChange={e=>patchLine(index,{itemName:e.target.value})}/>}</label>
            <label>{tx("Purchase unit")}{line.lineType==="InventoryItem"?<Select value={line.uomId??""} onChange={e=>patchLine(index,{uomId:e.target.value,uomName:uoms.find(u=>u.uomId===e.target.value)?.code??""})}><option value="">{tx("Select unit")}</option>{uoms.map(u=><option key={u.uomId} value={u.uomId}>{u.code}</option>)}</Select>:<Input value={line.uomName} onChange={e=>patchLine(index,{uomName:e.target.value})}/>}</label>
            <label>{tx("Quantity")}<Input type="number" min="0.0001" step="0.0001" value={line.quantity} onChange={e=>patchLine(index,{quantity:Number(e.target.value)})}/></label>
            <label>{tx("Estimated unit price")}<Input type="number" min="0" step="0.0001" value={line.estimatedUnitPrice} onChange={e=>patchLine(index,{estimatedUnitPrice:Number(e.target.value)})}/></label>
            <label>{tx("Specification")}<Input value={line.specification??""} onChange={e=>patchLine(index,{specification:e.target.value})}/></label>
            <div>{money(line.quantity*line.estimatedUnitPrice)}</div><Button variant="outline" disabled={form.lines.length===1} onClick={()=>patch({lines:form.lines.filter((_,i)=>i!==index)})}>{tx("Remove line")}</Button>
            {companyId&&line.lineType==="InventoryItem"&&<ProcurementStockCheck companyId={companyId} branchId={form.branchId} locationId={form.requiredStockLocationId} itemId={line.inventoryItemId} uomId={line.uomId} quantity={line.quantity} requiredDate={form.requiredByDateUtc??""} requisitionId={document?.id}/>}
          </section>;
        })}</div>
      </section>
      <section className="prq-panel"><label>{tx("Attachments (PDF, PNG or JPEG; 5 MB each)")}<Input type="file" accept=".pdf,.png,.jpg,.jpeg" multiple onChange={e=>setFiles(Array.from(e.target.files??[]))}/></label><p>{files.map(f=>f.name).join(", ")}</p></section>
      <footer className="prq-actions"><strong>{tx("Estimated total")}: {money(form.lines.reduce((s,l)=>s+l.quantity*l.estimatedUnitPrice,0))}</strong><Button variant="outline" onClick={()=>void save(false)}>{busy?tx("Saving..."):tx("Save draft")}</Button><Button onClick={()=>void save(true)}>{tx("Save and submit")}</Button></footer>
    </fieldset>
    {document&&companyId&&<RequisitionDocuments companyId={companyId} id={document.id} editable={false}/>}
  </main>;
}
