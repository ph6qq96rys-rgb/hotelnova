import "./catering-recipe-editor.css";
import { Table } from "../../../components/ui/table";
import { CateringItemCostPreview } from "./CateringItemCostPreview";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { http } from "../../../api/http";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { StateMessage } from "../../../components/ui/Feedback";
import { useDialogFocus } from "../../../components/ui/useDialogFocus";
import { useUnsavedChanges } from "../components/useUnsavedChanges";
import { readApiError } from "../sales/ui";
type Resource={id:string;name:string;baseUomId?:string;units?:string[]};
type Line={itemId:string;uomId:string;quantity:number;wastePercent:number;notes:string|null};
type Recipe={consumptionLocationId?:string|null;expectedUpdatedAt:string|null;expectedRecipeId:string|null;notes:string|null;lines:Line[]};
export function CateringItemRecipeEditor({companyId,branchId,item,resources,onClose,onSaved}:{companyId:string;branchId:string;item:{id?:string;name:string;consumptionLocationId?:string|null};resources:Record<string,Resource[]>;onClose:()=>void;onSaved:()=>void}){
 const [recipe,setRecipe]=useState<Recipe|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[dirty,setDirty]=useState(false);
 const inventory=useMemo(()=>[...(resources.inventory??[])].sort((a,b)=>a.name.trim().localeCompare(b.name.trim(),undefined,{sensitivity:"base",numeric:true})||a.id.localeCompare(b.id)),[resources.inventory]);
 const orderedLines=useMemo(()=>{
   const names=new Map(inventory.map(x=>[x.id,x.name.trim()]));
   return (recipe?.lines??[]).map((row,index)=>({row,index})).sort((a,b)=>{
     const left=names.get(a.row.itemId),right=names.get(b.row.itemId);
     if(!left||!right)return Number(!left)-Number(!right)||a.index-b.index;
     return left.localeCompare(right,undefined,{sensitivity:"base",numeric:true})||a.index-b.index;
   });
 },[recipe?.lines,inventory]);
 const guard=useUnsavedChanges(dirty);
 const close=()=>{if(!busy&&guard.confirmDiscard())onClose();};
 useDialogFocus(true,busy,close);
 useEffect(()=>{const c=new AbortController();http.get<Recipe>("/companies/"+companyId+"/catering/catalog/items/"+item.id+"/recipe",{signal:c.signal}).then(r=>{if(!c.signal.aborted)setRecipe({...r.data,consumptionLocationId:r.data.consumptionLocationId??item.consumptionLocationId??""});}).catch(e=>{if(!c.signal.aborted)setError(readApiError(e));});return()=>c.abort();},[companyId,item.id]);
 function change(next:Recipe){setRecipe(next);setDirty(true);}
 function line(index:number,patch:Partial<Line>){if(recipe)change({...recipe,lines:recipe.lines.map((x,i)=>i===index?{...x,...patch}:x)});}
 async function save(e:FormEvent){e.preventDefault();if(!recipe||busy)return;setBusy(true);setError("");try{await http.put("/companies/"+companyId+"/catering/catalog/items/"+item.id+"/recipe",recipe,{params:{branchId}});guard.markSaved();setDirty(false);onSaved();}catch(e){setError(readApiError(e));}finally{setBusy(false);}}
 return <div className="co-modal-backdrop"><section className="co-modal cr-editor" role="dialog" aria-modal="true" aria-label={"Recipe for "+item.name}><form onSubmit={save}>
 <header className="cr-header"><div><h2>Recipe for {item.name}</h2><p>Set the consumption location and ingredients for one catering unit or portion.</p></div><Button type="button" variant="outline" disabled={busy} onClick={close}>Close</Button></header>
 <div className="cr-body">
 {error&&<StateMessage tone="error">{error}</StateMessage>}{!recipe&&!error&&<StateMessage tone="loading">Loading recipe…</StateMessage>}
 {recipe&&<fieldset disabled={busy}>
 <div className="cr-location"><label>Consumption location<Select aria-label="Consumption location" required value={recipe.consumptionLocationId??""} onChange={e=>change({...recipe,consumptionLocationId:e.target.value})}><option value="">Select consumption location</option>{recipe.consumptionLocationId&&!resources.consumptionLocations?.some(x=>x.id===recipe.consumptionLocationId)&&<option value={recipe.consumptionLocationId} disabled>Unavailable location — select another</option>}{resources.consumptionLocations?.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</Select></label><p>This location is used for stock issuance. Ingredient costs come from the latest posted main warehouse GRN. Saving a recipe does not consume stock.</p></div>
 {!resources.consumptionLocations?.length&&<StateMessage tone="warning">No consumption locations are available for this branch. Configure an active location with consumption access in branch settings.</StateMessage>}
 <div className="cr-section-heading"><h3>Ingredients <span>({recipe.lines.length})</span></h3><span>Quantities per portion</span></div>
 <Table className="cr-ingredients" aria-label="Recipe ingredients"><thead><tr><th scope="col">#</th><th scope="col">Ingredient</th><th scope="col">Quantity</th><th scope="col">Unit</th><th scope="col">Waste %</th><th scope="col">Notes</th><th scope="col">Action</th></tr></thead><tbody>
 {orderedLines.map(({row,index:i},position)=>{const selected=inventory.find(x=>x.id===row.itemId);const units=(resources.units??[]).filter(u=>u.id===selected?.baseUomId||selected?.units?.includes(u.id)||u.id===row.uomId);return <tr key={i}>
 <td>{position+1}</td><td><Select aria-label={"Ingredient "+(position+1)} required value={row.itemId} onChange={e=>{const ingredient=inventory.find(x=>x.id===e.target.value);line(i,{itemId:e.target.value,uomId:ingredient?.baseUomId??""});}}><option value="">Select ingredient</option>{row.itemId&&!selected&&<option value={row.itemId}>Unavailable ingredient — replace before saving</option>}{inventory.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</Select></td>
 <td><Input aria-label={"Quantity "+(position+1)} required type="number" min="0.000001" step="any" value={row.quantity} onChange={e=>line(i,{quantity:Number(e.target.value)})}/></td>
 <td><Select aria-label={"Unit "+(position+1)} required value={row.uomId} onChange={e=>line(i,{uomId:e.target.value})}><option value="">Select unit</option>{units.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</Select></td>
 <td><Input aria-label={"Waste % "+(position+1)} required type="number" min="0" max="100" step="any" value={row.wastePercent} onChange={e=>line(i,{wastePercent:Number(e.target.value)})}/></td>
 <td><Input aria-label={"Ingredient notes "+(position+1)} placeholder="Optional" value={row.notes??""} onChange={e=>line(i,{notes:e.target.value})}/></td>
 <td><Button type="button" variant="ghost" aria-label={"Remove ingredient "+(position+1)} onClick={()=>change({...recipe,lines:recipe.lines.filter((_,n)=>n!==i)})}>Remove</Button></td></tr>;})}
 {!recipe.lines.length&&<tr><td colSpan={7}>No ingredients yet. Add an ingredient to start this recipe.</td></tr>}</tbody></Table>
 <div className="cr-add"><Button type="button" variant="outline" onClick={()=>change({...recipe,lines:[...recipe.lines,{itemId:"",uomId:"",quantity:1,wastePercent:0,notes:null}]})}>Add ingredient</Button><span>On small screens, scroll the table to see all columns.</span></div>
 <label className="cr-notes">Preparation notes<Textarea rows={2} placeholder="Preparation steps or kitchen instructions (optional)" value={recipe.notes??""} onChange={e=>change({...recipe,notes:e.target.value})}/></label>
 <div className="cr-cost"><CateringItemCostPreview companyId={companyId} request={{branchId,consumptionLocationId:recipe.consumptionLocationId,lines:recipe.lines}}/></div>
 </fieldset>}</div>
 {recipe&&<footer className="cr-footer"><p>{dirty?"Unsaved changes":"Recipe saved"} · Saving creates a new catering revision.</p><Button type="submit" disabled={busy||!dirty||!recipe.lines.length||!recipe.consumptionLocationId||!resources.consumptionLocations?.some(x=>x.id===recipe.consumptionLocationId)}>{busy?"Saving recipe…":"Save recipe"}</Button></footer>}
 </form></section></div>;
}
