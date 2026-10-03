import { useEffect, useState } from "react";
import { http } from "../../../api/http";
import { StateMessage } from "../../../components/ui/Feedback";
import { formatCurrency as money } from "../../../shared/currency/currencyFormat";
import { readApiError } from "../sales/ui";
type Cost={source:string;complete:boolean;totalCost:number|null;lines:{itemId:string;name:string;baseQuantity:number;unit:string;unitCost:number|null;cost:number|null;costSource:string}[]};
export function CateringItemCostPreview({companyId,request}:{companyId:string;request:{branchId:string|null;consumptionLocationId?:string|null;recipeId?:string|null;inventoryItemId?:string|null;uomId?:string|null;lines?:unknown[]}}){
 const key=JSON.stringify(request),[state,setState]=useState<{key:string;cost?:Cost;error?:string}>({key:""});
 useEffect(()=>{const c=new AbortController();const timer=setTimeout(()=>{http.post<Cost>("/companies/"+companyId+"/catering/catalog/items/cost-preview",JSON.parse(key),{signal:c.signal}).then(r=>{if(!c.signal.aborted)setState({key,cost:r.data});}).catch(e=>{if(!c.signal.aborted)setState({key,error:readApiError(e)});});},300);return()=>{clearTimeout(timer);c.abort();};},[companyId,key]);

 if(state.key!==key)return <StateMessage tone="loading">Calculating cost…</StateMessage>;
 if(state.error)return <StateMessage tone="error">{state.error}</StateMessage>;
 const cost=state.cost;if(!cost)return null;
 const orderedLines=[...cost.lines].sort((a,b)=>a.name.trim().localeCompare(b.name.trim(),undefined,{sensitivity:"base",numeric:true})||a.itemId.localeCompare(b.itemId));
 return <section aria-label="Catering item cost preview" aria-live="polite"><h3>Cost per catering unit / portion</h3><strong>{cost.complete?money(cost.totalCost!):"Cost incomplete"}</strong>
 {!cost.complete&&<StateMessage tone="warning">{cost.lines.length?"Main warehouse GRN costs are missing or need unit reconciliation. Resolve the highlighted ingredients before relying on package margins.":"Link an inventory item or configure recipe ingredients to calculate cost."}</StateMessage>}
 <p>{cost.source==="Recipe"?"Calculated from recipe ingredients, conversions and waste. The recipe takes precedence over a direct inventory link.":"Calculated for one selected inventory unit."} Costs use the latest posted main warehouse GRN, regardless of remaining stock or consumption location. No stock is consumed by this preview.</p>
 <div className="co-table-wrap"><table><thead><tr><th>Inventory item</th><th>Quantity in base unit</th><th>Unit cost</th><th>Cost</th><th>Source</th></tr></thead><tbody>{orderedLines.map((line,i)=>{const missing=line.unitCost==null||line.cost==null||line.costSource==="Missing stock cost";return <tr key={line.itemId+":"+i} style={missing?{background:"var(--erp-warn-bg)"}:undefined}><td>{line.name}</td><td>{line.baseQuantity.toLocaleString(undefined,{maximumFractionDigits:6})} {line.unit}</td><td>{missing?"Missing":money(line.unitCost)}</td><td>{missing?"Missing":money(line.cost)}</td><td>{line.costSource}</td></tr>;})}</tbody></table></div></section>;
}
