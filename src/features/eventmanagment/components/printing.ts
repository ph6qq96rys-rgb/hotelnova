export function printDocument(title: string, facts: string[], columns: string[], rows: string[][]) {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) { frame.remove(); return; }
  doc.title = title;
  const style = doc.createElement("style");
  style.textContent = "@page{margin:18mm}body{font:12px system-ui;color:#111}h1{font-size:24px}table{border-collapse:collapse;width:100%;margin-top:24px}th,td{text-align:left;padding:10px;border-bottom:1px solid #ddd}th{background:#eee}";
  doc.head.append(style);
  const h = doc.createElement("h1"); h.textContent = title; doc.body.append(h);
  for (const fact of facts) { const p=doc.createElement("p");p.textContent=fact;doc.body.append(p); }
  const table = doc.createElement("table");
  const head = doc.createElement("tr");
  for(const value of columns){const th=doc.createElement("th");th.textContent=value;head.append(th);}
  table.append(head);
  for(const row of rows){const tr=doc.createElement("tr");for(const value of row){const td=doc.createElement("td");td.textContent=value;tr.append(td);}table.append(tr);}
  doc.body.append(table);
  frame.contentWindow?.addEventListener("afterprint",()=>frame.remove(),{once:true});
  frame.contentWindow?.focus();frame.contentWindow?.print();setTimeout(()=>frame.remove(),60000);
}
export type StockCut = { batchId:string;batchNo:string;outputId:string;cut:string;lotId:string;lot:string|null;remainingQty:number;weight:number;sourceLot:string|null;postedAt:string;expiryDate:string|null };
export function printCutLabels(cuts:StockCut[]){
  if(!cuts.length)return;
  const frame=document.createElement("iframe");frame.style.cssText="position:fixed;width:0;height:0;border:0";document.body.append(frame);
  const doc=frame.contentDocument;if(!doc){frame.remove();return;}
  const style=doc.createElement("style");style.textContent="@page{size:100mm 70mm;margin:5mm}body{font:13px system-ui}article{break-after:page}article:last-child{break-after:auto}h1{font-size:21px;margin:7px 0}p{margin:6px 0}small{font-size:9px}";
  doc.head.append(style);
  for(const cut of cuts){const card=doc.createElement("article");const h=doc.createElement("h1");h.textContent=cut.cut;card.append(h);
    for(const value of ["Lot: "+(cut.lot??"Not recorded"),"Batch: "+cut.batchNo,"Net output: "+cut.weight.toFixed(2)+" kg","Source lot: "+(cut.sourceLot??"Not recorded"),"Produced: "+new Date(cut.postedAt).toLocaleDateString(),"Expiry: "+(cut.expiryDate??"Not recorded")]){const p=doc.createElement("p");p.textContent=value;card.append(p);}
    const ref=doc.createElement("small");ref.textContent="Trace ID: "+cut.lotId;card.append(ref);doc.body.append(card);
  }
  frame.contentWindow?.addEventListener("afterprint",()=>frame.remove(),{once:true});frame.contentWindow?.focus();frame.contentWindow?.print();setTimeout(()=>frame.remove(),60000);
}
