import { Input } from "../../../components/ui/input";
import { useEffect, useState } from "react";
import { procurementDocumentsApi, type Attachment, type AuditEntry } from "../api/procurementDocumentsApi";
import { Button } from "../../../components/ui/button";
import { useI18n } from "../../../i18n";
import { apiError, dateTime } from "./p2pShared";

function changes(entry:AuditEntry):string[]{
  if(!entry.detailsJson)return [];
  try{
    const data=JSON.parse(entry.detailsJson) as Record<string,unknown>;
    if(typeof data.fileName==="string")return [data.fileName];
    const before=data.Before,after=data.After;
    if(typeof before==="string"&&typeof after==="string")return [`${before} → ${after}`,String(data.Reason??"")].filter(Boolean);
    if(before&&after&&typeof before==="object"&&typeof after==="object"){
      const old=before as Record<string,unknown>,next=after as Record<string,unknown>;
      return Object.keys(next).filter(key=>!["Id","Version","CompanyId","BranchId"].includes(key)&&JSON.stringify(old[key])!==JSON.stringify(next[key])).map(key=>{
        const label=key.replace(/([a-z])([A-Z])/g,"$1 $2");
        if(key.endsWith("Id"))return `${label.replace(/ Id$/,"")} updated`;
        if(key==="Lines")return "Requested items, quantities or prices updated";
        return `${label}: ${String(old[key]??"—")} → ${String(next[key]??"—")}`;
      });
    }
    if(entry.action==="Bank details changed")return [`Bank: ${String(data.PreviousBank??"—")} → ${String(data.NewBank??"—")}`,`Account ending: ${String(data.PreviousAccountEnding??"—")} → ${String(data.NewAccountEnding??"—")}`];
    return typeof data.Reason==="string"?[data.Reason]:[];
  }catch{return [];}
}

export default function RequisitionDocuments({companyId,id,editable,onChanged,documentType="requisition"}:{companyId:string;id:string;editable:boolean;onChanged?:()=>void;documentType?:"requisition"|"supplier"|"acceptance"|"return"|"emergency"|"inspection"|"supplier-submission"}) {
  const {tx}=useI18n();
  const [files,setFiles]=useState<Attachment[]>([]),[audit,setAudit]=useState<AuditEntry[]>([]);
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const load=async()=>{try{const [f,a]=await Promise.all([procurementDocumentsApi.list(companyId,id,documentType),procurementDocumentsApi.audit(companyId,id,documentType)]);setFiles(f);setAudit(a);}catch(e){setError(apiError(e,"Unable to load attachments and history."));}};
  useEffect(()=>{void load();},[companyId,id]);
  async function upload(input:HTMLInputElement) {
    if(busy)return;setBusy(true);setError("");
    try {for(const file of Array.from(input.files??[]))await procurementDocumentsApi.upload(companyId,id,file,documentType); input.value="";await load();onChanged?.();}
    catch(e){setError(apiError(e,"Unable to upload the attachment. The requisition is saved; retry the upload."));}
    finally{setBusy(false);}
  }
  return <section className="prq-panel">
    <h2>{tx("Supporting documents and change history")}</h2>
    {error&&<p role="alert" className="prq-alert">{tx(error)}</p>}
    {editable&&<label>{tx("Add attachments (PDF, PNG or JPEG; 5 MB per file)")}<Input aria-label={tx("Add attachments")} type="file" accept=".pdf,.png,.jpg,.jpeg" multiple disabled={busy} onChange={e=>void upload(e.currentTarget)}/></label>}
    {busy&&<p role="status">{tx("Uploading attachments...")}</p>}
    {files.length===0?<p>{tx("No attachments.")}</p>:<ul>{files.map(f=><li key={f.id}><Button variant="ghost" onClick={()=>void procurementDocumentsApi.download(companyId,id,f,documentType).catch(e=>setError(apiError(e,"Unable to download attachment.")))}>{f.fileName}</Button> — {Math.ceil(f.length/1024)} KB</li>)}</ul>}
    {audit.map(a=><details key={a.id}><summary>{dateTime(a.createdAt)} · {tx(a.action)} · {a.userName??tx("User")}</summary><ul>{changes(a).map((change,index)=><li key={index}>{tx(change)}</li>)}</ul></details>)}
  </section>;
}
