import { useUnsavedChanges } from "../components/useUnsavedChanges";
import { RemovePlannedBatch } from "../../../components/RemovePlannedBatch";
import { useDialogFocus } from "../components/useDialogFocus";
import { useAuth } from "../../../auth/AuthProvider";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { http } from "../../../api/http";
import { butcheryManagementApi as api, type ButcheryProcessingBatchDto as Batch, type ButcheryOperationDto, type MeatCutTemplateDto, type ButcheryBatchTraceDto as Trace } from "../api/butcheryManagementApi";
import { grnApi } from "../../inventory/grn/api/grnApi";
import type { GrnListDto, GrnDetailDto } from "../../inventory/grn/types/grn.types";
import { readApiError } from "../sales/ui";
import { humanize } from "../sales/options";

const states=["","draft","submitted","approved","inProcessing","completed","posted","cancelled","reversed"];
const state=(v:string|number)=>typeof v==="number"?states[v]??String(v):v.charAt(0).toLowerCase()+v.slice(1);
const isWaste=(v:string|number)=>v===4||String(v).toLowerCase()==="waste";
const fixed=(n:number|null|undefined)=>(n??0).toFixed(2);
function printLabel(trace:Trace,output:Trace["outputs"][number]){
  const frame=document.createElement("iframe");frame.style.position="fixed";frame.style.width="0";frame.style.height="0";frame.style.border="0";
  document.body.appendChild(frame);const doc=frame.contentDocument;if(!doc){frame.remove();return;}
  const style=doc.createElement("style");style.textContent="@page{size:100mm 70mm;margin:5mm}body{font:14px system-ui;color:#111}h1{font-size:22px;margin:8px 0}p{margin:7px 0}small{font-size:10px}";doc.head.append(style);
  const title=doc.createElement("h1");title.textContent=output.outputItemName;doc.body.append(title);
  const ledger=trace.ledgerLines.find(l=>l.id===output.ledgerLineId);
  for(const text of ["Lot: "+output.producedBatchNo,"Batch: "+trace.batch.batchNo,"Net output: "+fixed(output.actualWeightBase)+" kg","Source lot: "+(trace.sourceLot.batchNo??"Unspecified"),"Produced: "+(trace.postedAtUtc?new Date(trace.postedAtUtc).toLocaleDateString():"Unspecified"),"Expiry: "+(ledger?.expiryDate??"Not recorded")]){
    const p=doc.createElement("p");p.textContent=text;doc.body.append(p);
  }
  const ref=doc.createElement("small");ref.textContent="Trace ID: "+output.producedFifoLotId;doc.body.append(ref);
  frame.contentWindow?.focus();frame.contentWindow?.print();setTimeout(()=>frame.remove(),60000);
}
export function ButcheryWorkbench({companyId,branchId}:{companyId:string;branchId:string}){
 const { hasPermission } = useAuth(); const canProcess=hasPermission("butchery.process"), canApprove=hasPermission("butchery.approve"), canPost=hasPermission("butchery.post");
 const [processingDate,setProcessingDate]=useState(()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);});
 const [page,setPage]=useState(1),[total,setTotal]=useState(0),[openCount,setOpenCount]=useState(0);
 const [params,setParams]=useSearchParams();const initialBatch=useRef(params.get("batch"));const view=params.get("view")??"batches";
 const [batches,setBatches]=useState<Batch[]>([]),[selected,setSelected]=useState(params.get("batch")??"");
 const [operations,setOperations]=useState<ButcheryOperationDto[]>([]),[templates,setTemplates]=useState<MeatCutTemplateDto[]>([]);
 const [receipts,setReceipts]=useState<GrnListDto[]>([]),[receipt,setReceipt]=useState<GrnDetailDto|null>(null);
 const [grnId,setGrnId]=useState(params.get("grnId")??""),[lineId,setLineId]=useState(""),[operationId,setOperationId]=useState(""),[templateId,setTemplateId]=useState("");
 const [creating,setCreating]=useState(params.get("source")==="grn"),[revision,setRevision]=useState(0),[loading,setLoading]=useState(false);
 const [error,setError]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[search,setSearch]=useState("");
 const lock=useRef(false);const [cuts,setCuts]=useState<Batch["outputs"]>([]),[traces,setTraces]=useState<Trace[]>([]),[traceLoading,setTraceLoading]=useState(false);
 const [varianceReason,setVarianceReason]=useState(""),[confirm,setConfirm]=useState<"variance"|"post"|null>(null);
 useDialogFocus(creating,busy,()=>{if(guard.confirmDiscard())setCreating(false);});
 const batch=batches.find(b=>b.id===selected)??null;const status=batch?state(batch.status):"";
 const line=receipt?.lines.find(l=>l.id===lineId);const matching=templates.filter(t=>t.sourceItemId===line?.itemId);
 const editable=canProcess && ["draft","submitted","approved","inProcessing"].includes(status);
 const dirty=JSON.stringify(cuts)!==JSON.stringify(batch?.outputs??[])||(creating&&!!(grnId||lineId||operationId||templateId));
 const guard=useUnsavedChanges(dirty);

 useEffect(()=>{
   let alive=true;setLoading(true);setError("");setMessage("");setBatches([]);setOperations([]);setTemplates([]);
   if(!companyId){setLoading(false);return;}
   Promise.all([api.searchBatches(companyId,{branchId,q:search,page}),api.listOperations(companyId,branchId),api.listCutTemplates(companyId)])
    .then(async ([b,o,t])=>{const linked=initialBatch.current;initialBatch.current=null;if(linked&&!b.items.some(x=>x.id===linked)){const item=await api.getBatch(companyId,linked);if(!branchId||item.branchId===branchId)b.items.unshift(item);}if(alive){setBatches(b.items);setTotal(b.total);setOpenCount(b.openCount);setOperations(o.filter(x=>x.isEnabled));setTemplates(t);setSelected(id=>b.items.some(x=>x.id===id)?id:b.items[0]?.id??"");}})
    .catch(e=>{if(alive)setError(readApiError(e,"Unable to load butchery."));}).finally(()=>{if(alive)setLoading(false);});
   return()=>{alive=false;};
 },[companyId,branchId,revision,search,page]);
 useEffect(()=>{setCuts(batch?.outputs??[]);setConfirm(null);setVarianceReason("");},[batch]);
 useEffect(()=>{
   let alive=true;setTraces([]);setTraceLoading(true);
   const ids=view==="stock"?batches.filter(b=>state(b.status)==="posted").map(b=>b.id):selected?[selected]:[];
   (async()=>{const all:Trace[]=[];for(let i=0;i<ids.length;i+=8){if(!alive)return;all.push(...await Promise.all(ids.slice(i,i+8).map(id=>api.trace(companyId,id))));}if(alive)setTraces(all);})()
    .catch(e=>{if(alive)setError(readApiError(e,"Unable to load lot traceability."));}).finally(()=>{if(alive)setTraceLoading(false);});
   return()=>{alive=false;};
 },[companyId,batches,selected,view]);
 useEffect(()=>{
   let alive=true;setReceipts([]);
   if(creating&&companyId)grnApi.list({companyId,branchId},{status:"POSTED"}).then(r=>{if(alive)setReceipts(r);}).catch(e=>{if(alive)setError(readApiError(e));});
   return()=>{alive=false;};
 },[creating,companyId,branchId]);
 useEffect(()=>{
   let alive=true;setReceipt(null);setLineId("");setTemplateId("");
   if(grnId&&companyId)grnApi.getById({companyId,branchId},grnId).then(r=>{if(alive){setReceipt(r);if(r.lines.length===1)setLineId(r.lines[0].id);}}).catch(e=>{if(alive)setError(readApiError(e));});
   return()=>{alive=false;};
 },[grnId,companyId,branchId]);
 useEffect(()=>{setTemplateId("");},[lineId]);
 async function run(call:()=>Promise<Batch>,success:string){
   if(lock.current)return;lock.current=true;setBusy(true);setError("");setMessage("");
   try{const result=await call();setOpenCount(n=>n+(batch?0:1)-(["posted","cancelled","reversed"].includes(state(result.status))&&!["posted","cancelled","reversed"].includes(status)?1:0));if(!batch)setTotal(n=>n+1);setBatches(rows=>[result,...rows.filter(r=>r.id!==result.id)]);setSelected(result.id);setCuts(result.outputs);guard.markSaved();setMessage(success);setConfirm(null);return result;}
   catch(e){setError(readApiError(e));}finally{lock.current=false;setBusy(false);}
 }
 async function create(e:React.FormEvent){
   e.preventDefault();if(!receipt||!line||!templateId||!operationId)return;
   const result=await run(()=>api.createBatchFromGrn(companyId,grnId,{branchId:receipt.branchId,grnLineId:line.id,butcheryOperationId:operationId,meatCutTemplateId:templateId,startingWeightBase:null,processingDateUtc:new Date(processingDate).toISOString()}),"Cutting order created.");
   if(result){setCreating(false);setParams({view:"yield",batch:result.id});}
 }
 const save=()=>{if(!batch)return;if(cuts.some(c=>!Number.isFinite(c.actualWeightBase)||c.actualWeightBase<0)){setError("Enter a valid non-negative weight for every cut.");return;}
 if(cuts.some(c=>isWaste(c.classification)&&c.actualWeightBase>0&&!c.wasteReason?.trim())){setError("Enter a reason for every waste output.");return;}
 void run(()=>api.updateOutputs(companyId,batch.id,{outputs:cuts.map(c=>({meatCutTemplateLineId:c.meatCutTemplateLineId,actualWeightBase:c.actualWeightBase,wasteReason:c.wasteReason,notes:c.notes}))}),"Output weights saved.");};
 const transition=(action:"submit"|"start"|"complete")=>{if(batch&&!dirty)void run(()=>api[action](companyId,batch.id),humanize(action)+" saved.");};
 const accounted=cuts.reduce((s,c)=>s+c.actualWeightBase,0);
 const waste=cuts.filter(c=>isWaste(c.classification)).reduce((s,c)=>s+c.actualWeightBase,0);
 const changeView=(next:string)=>{const p=new URLSearchParams(params);p.set("view",next);setParams(p);};
 const trace=traces.find(t=>t.batch.id===selected);
 const stock=traces.filter(t=>!t.hasReversal).flatMap(t=>t.outputs.filter(o=>o.producedFifoLotId).map(o=>({trace:t,output:o})));
 const title=({batches:"Cutting orders",yield:"Yield & carcass",stock:"Stock by cut",labels:"Labels & tracing",waste:"Waste & shrinkage"} as Record<string,string>)[view]??"Cutting orders";
 return <section className="co-workspace"><header className="co-heading"><div><span className="co-eyebrow">Butchery / Production</span><h1>{title}</h1><p>Receive, weigh, review and post with full lot traceability.</p></div><div className="co-actions"><button disabled={busy||loading||dirty} onClick={()=>setRevision(r=>r+1)}>Refresh</button><button className="co-primary" disabled={!branchId||busy||dirty||!canProcess} onClick={()=>setCreating(true)}>+ Cutting order</button></div></header>
 {error&&<p role="alert" className="co-notice">{error}</p>}{message&&<p role="status" className="co-notice">{message}</p>}
 {!canProcess&&<p className="co-notice">Creating orders and editing weights requires butchery.process permission.</p>}{status==="submitted"&&!canApprove&&<p className="co-notice">Batch approval requires butchery.approve permission.</p>}{status==="completed"&&!canPost&&<p className="co-notice">Posting requires butchery.post permission.</p>}<div className="co-metrics"><article><span>Open batches</span><strong>{loading?"—":openCount}</strong><small>In this branch</small></article><article><span>Input weight</span><strong>{fixed(batch?.startingWeightBase)} kg</strong><small>{batch?.batchNo??"Select a batch"}</small></article><article><span>Recorded waste</span><strong>{fixed(waste)} kg</strong><small>Selected batch outputs</small></article><article><span>Unaccounted weight</span><strong>{fixed((batch?.startingWeightBase??0)-accounted-(batch?.approvedVarianceWeightBase??0))} kg</strong><small>{dirty?"Unsaved weights":"After approved variance"}</small></article></div>
 <section className="co-card"><div className="co-toolbar"><div className="co-view">{["batches","yield","stock","labels","waste"].map(v=><button key={v} disabled={busy} aria-pressed={view===v} onClick={()=>changeView(v)}>{({batches:"Orders",yield:"Yield",stock:"Stock",labels:"Labels",waste:"Waste"} as Record<string,string>)[v]}</button>)}</div><input aria-label="Search batches or cuts" placeholder="Search batches or cuts..." disabled={dirty||busy} value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/></div>
 {loading?<p className="co-empty" role="status">Loading cutting orders...</p>:view==="stock"?<><p className="co-caption">Remaining produced lots from posted butchery batches in this branch. Other inventory receipts are excluded.</p>{traceLoading?<p className="co-empty">Loading produced lots...</p>:<div className="co-table-wrap"><table className="co-table"><thead><tr><th>Cut</th><th>Produced lot</th><th>Batch</th><th>Remaining kg</th><th>Label</th></tr></thead><tbody>{stock.filter(s=>(s.output.outputItemName+" "+s.output.producedBatchNo).toLowerCase().includes(search.toLowerCase())).map(({trace:t,output:o})=><tr key={o.producedFifoLotId}><td>{o.outputItemName}</td><td>{o.producedBatchNo??"Not recorded"}</td><td>{t.batch.batchNo}</td><td>{fixed(o.producedQtyRemainingBase)}</td><td><button onClick={()=>printLabel(t,o)}>Print label</button></td></tr>)}</tbody></table>{!stock.length&&<p className="co-empty">No posted cut lots available.</p>}</div>}</>:
 <div className="co-butchery-grid"><aside><h2>Batch queue</h2>{batches.filter(b=>(b.batchNo+" "+b.sourceItemName).toLowerCase().includes(search.toLowerCase())).map(b=><button key={b.id} disabled={busy||dirty} className={selected===b.id?"is-active":""} onClick={()=>{setSelected(b.id);setMessage("");setError("");const p=new URLSearchParams(params);p.set("batch",b.id);setParams(p);}}><strong>{b.batchNo}</strong><span>{b.sourceItemName}</span><small>{humanize(state(b.status))} · {fixed(b.startingWeightBase)} kg</small></button>)}<div className="co-actions"><button disabled={busy||dirty||page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button><button disabled={busy||dirty||page*25>=total} onClick={()=>setPage(p=>p+1)}>Next</button></div><small>{total} batches · Page {page}</small></aside>
 <div className="co-batch-detail">{!batch?<div className="co-empty"><h3>No cutting orders yet</h3><p>Create one from a posted goods receipt.</p></div>:<><header className="co-toolbar"><div><h2>{batch.batchNo}</h2><p>{batch.sourceItemName} · {batch.sourceStockLocationName}</p></div><span className="co-pill">{humanize(status)}</span></header>
 {view==="labels"?<><p className="co-caption">Source lot: {trace?.sourceLot.batchNo??batch.fifoLotBatchNo??"Not recorded"} · Template: {batch.meatCutTemplateName}</p>{traceLoading?<p>Loading trace...</p>:trace?.outputs.filter(o=>o.producedFifoLotId).map(o=><div className="co-toolbar" key={o.outputId}><div><strong>{o.outputItemName}</strong><p>{o.producedBatchNo} · {fixed(o.actualWeightBase)} kg</p></div><button disabled={trace.hasReversal} onClick={()=>printLabel(trace,o)}>Print label</button></div>)}{!traceLoading&&!trace?.outputs.some(o=>o.producedFifoLotId)&&<p className="co-empty">Post the completed batch to generate traceable stock labels.</p>}</>:
 <><p className="co-caption">{view==="waste"?"Record waste weights and reasons below, then save.":"Enter actual output weights. Save before moving to the next step."} All weights use the stock item base unit (kg).</p><div className="co-table-wrap"><table className="co-table"><thead><tr><th>Cut / classification</th><th>Expected kg</th><th>Actual kg</th><th>Reason / notes</th></tr></thead><tbody>{cuts.filter(c=>view!=="waste"||isWaste(c.classification)).map(c=><tr key={c.meatCutTemplateLineId}><td><strong>{c.outputItemName}</strong><small>{typeof c.classification==="number"?["","Saleable","Non-saleable","By-product","Waste"][c.classification]:humanize(c.classification)}</small></td><td>{fixed(c.expectedWeightBase)}</td><td><input aria-label={c.outputItemName+" actual kg"} type="number" min="0" step="0.01" disabled={busy||!editable} value={c.actualWeightBase} onChange={e=>setCuts(rows=>rows.map(r=>r.meatCutTemplateLineId===c.meatCutTemplateLineId?{...r,actualWeightBase:Number(e.target.value)}:r))}/></td><td><input aria-label={c.outputItemName+" reason"} disabled={busy||!editable} placeholder={isWaste(c.classification)?"Waste reason":"Optional notes"} value={(isWaste(c.classification)?c.wasteReason:c.notes)??""} onChange={e=>setCuts(rows=>rows.map(r=>r.meatCutTemplateLineId===c.meatCutTemplateLineId?{...r,[isWaste(c.classification)?"wasteReason":"notes"]:e.target.value}:r))}/></td></tr>)}</tbody></table></div>
 <div className="co-toolbar"><span>{dirty?"Unsaved changes":"Weights saved"} · Accounted {fixed(accounted)} kg</span><div className="co-actions"><button disabled={!dirty||busy} onClick={()=>setCuts(batch.outputs)}>Discard changes</button><button className="co-primary" disabled={!editable||busy||!dirty} onClick={save}>{busy?"Saving...":"Save weights"}</button></div></div></>}
 <div className="co-batch-actions"><h3>Next step</h3><p>Draft → Submit → Approve → Start → Complete → Post stock</p><div className="co-actions">
 {status==="draft"&&<button disabled={busy||dirty||!cuts.length||!canProcess} onClick={()=>transition("submit")}>Submit for approval</button>}
 {status==="draft"&&<RemovePlannedBatch key={batch.id} permission="butchery.remove" url={`/companies/${companyId}/butchery/batches/${batch.id}/remove?branchId=${batch.branchId}`} disabled={busy||dirty} onBusyChange={setBusy} onRemoved={()=>{setSelected("");setRevision(n=>n+1);setMessage("Planned batch removed. Its audit history is retained.");}}/>}
 {status==="submitted"&&<button disabled={busy||dirty||!canApprove} onClick={()=>void run(async()=>(await http.post<Batch>("/companies/"+companyId+"/butchery/batches/"+batch.id+"/approve")).data,"Batch approved.")}>Approve batch</button>}
 {status==="approved"&&<button disabled={busy||dirty||!canProcess} onClick={()=>transition("start")}>Start breakdown</button>}
 {status==="inProcessing"&&<><button disabled={busy||dirty||!canApprove||batch.unaccountedVarianceWeightBase<=0} onClick={()=>setConfirm("variance")}>Review variance</button><button disabled={busy||dirty||!canProcess||!batch.isVarianceWithinTolerance} onClick={()=>transition("complete")}>Complete batch</button></>}
 {status==="completed"&&<button className="co-primary" disabled={busy||dirty||!canPost} onClick={()=>setConfirm("post")}>Post stock</button>}
 {status==="posted"&&<button onClick={()=>changeView("labels")}>Open labels & tracing</button>}</div></div>
 {confirm&&<form className="co-editor-section" onSubmit={e=>{e.preventDefault();if(confirm==="post")void run(()=>api.post(companyId,batch.id),"Stock posted and trace labels generated.");else void run(()=>api.approveVariance(companyId,batch.id,{approvedVarianceWeightBase:batch.approvedVarianceWeightBase+Math.max(0,batch.unaccountedVarianceWeightBase),reason:varianceReason.trim()}),"Variance approved.");}}><h3>{confirm==="post"?"Post this batch to inventory?":"Approve unexplained weight variance"}</h3><p>{confirm==="post"?"This consumes the source lot and creates the output stock lots.":fixed(batch.unaccountedVarianceWeightBase)+" kg requires an explanation."}</p>{confirm==="variance"&&<label>Approval reason<textarea required minLength={3} maxLength={500} value={varianceReason} onChange={e=>setVarianceReason(e.target.value)}/></label>}<div className="co-actions"><button disabled={busy} className="co-primary">Confirm {confirm==="post"?"posting":"variance approval"}</button><button disabled={busy} type="button" onClick={()=>setConfirm(null)}>Cancel</button></div></form>}
 </>}</div></div>}</section>
 {creating&&<div className="co-modal-backdrop"><section role="dialog" aria-modal="true" aria-label="New cutting order" className="co-modal"><form onSubmit={create}><header className="co-toolbar"><h2>New cutting order</h2><button type="button" disabled={busy} onClick={()=>{if(guard.confirmDiscard())setCreating(false);}}>Close</button></header><fieldset disabled={busy}><p>Choose a posted receipt and its source line. The backend resolves the available stock lot and base weight.</p><div className="co-form-grid">
 <label>Posted goods receipt<select required value={grnId} onChange={e=>setGrnId(e.target.value)}><option value="">Select receipt</option>{grnId&&!receipts.some(r=>r.id===grnId)&&<option value={grnId}>{receipt?.grnNumber??"Selected receipt"}</option>}{receipts.map(r=><option key={r.id} value={r.id}>{r.grnNumber??r.grnNo} · {r.supplierName}</option>)}</select></label>
 <label>Source line<select required value={lineId} onChange={e=>setLineId(e.target.value)}><option value="">Select received item</option>{receipt?.lines.map(l=><option key={l.id} value={l.id}>{l.itemName} · {l.quantity} {l.uomCode??l.uomName}</option>)}</select></label>
 <label>Processing date<input required type="datetime-local" value={processingDate} onChange={e=>setProcessingDate(e.target.value)}/></label><label>Operation<select required value={operationId} onChange={e=>setOperationId(e.target.value)}><option value="">Select operation</option>{operations.filter(o=>!receipt?.branchId||o.branchId===receipt.branchId).map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
 <label>Cut template<select required value={templateId} onChange={e=>setTemplateId(e.target.value)}><option value="">Select matching template</option>{matching.map(t=><option key={t.id} value={t.id}>{t.name} · {t.totalExpectedYieldPercent}%</option>)}</select></label></div>{line&&!matching.length&&<p className="co-notice">No active cut template matches this received item. Open Operations & templates in the navigation to configure one before creating the order.</p>}</fieldset>{error&&<p role="alert" className="co-notice">{error}</p>}<footer className="co-toolbar"><span>One source line per cutting order.</span><button className="co-primary" disabled={busy||!receipt||!lineId||!operationId||!templateId}>{busy?"Creating...":"Create cutting order"}</button></footer></form></section></div>}
 </section>;
}
