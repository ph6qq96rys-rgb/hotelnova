import { useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { http } from "../api/http";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { StateMessage } from "./ui/Feedback";

export function RemovePlannedBatch({url,permission,disabled,onRemoved,onBusyChange}:{url:string;permission:string;disabled?:boolean;onRemoved:()=>void|Promise<void>;onBusyChange:(value:boolean)=>void}) {
 const {hasPermission}=useAuth();const [open,setOpen]=useState(false),[reason,setReason]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");const lock=useRef(false);
 if(!hasPermission(permission))return null;
 async function remove(){if(lock.current||disabled||reason.trim().length<3)return;lock.current=true;setBusy(true);onBusyChange(true);setError("");
  try{await http.post(url,{reason:reason.trim()});setOpen(false);await onRemoved();}
  catch(e:any){setError(e?.response?.data?.detail??e?.response?.data?.message??"Unable to remove batch. Refresh and try again.");}
  finally{lock.current=false;setBusy(false);onBusyChange(false);}
 }
 return <section aria-label="Remove planned batch">
 {!open?<Button type="button" variant="destructive" disabled={disabled} onClick={()=>setOpen(true)}>Remove planned batch</Button>:<>
 <p>Remove this draft batch? It will be cancelled, with its history retained. No stock will be changed.</p>
 <label>Removal reason<Textarea autoFocus required minLength={3} maxLength={300} value={reason} disabled={busy||disabled} onChange={e=>setReason(e.target.value)}/></label>
 <Button type="button" variant="destructive" disabled={busy||disabled||reason.trim().length<3} onClick={()=>void remove()}>{busy?"Removing…":"Confirm removal"}</Button>
 <Button type="button" variant="outline" disabled={busy} onClick={()=>setOpen(false)}>Keep batch</Button>
 </>}{error&&<StateMessage tone="error">{error}</StateMessage>}</section>;
}
