import { useState } from "react";
import { approvalsApi,type ApprovalRoute } from "../api/procurementApprovalsApi";
import { Button } from "../../../components/ui/button";
import { Textarea } from "../../../components/ui/textarea";
import { apiError,dateTime } from "./p2pShared";
import { useI18n } from "../../../i18n";

export default function RequisitionApprovalRoute({companyId,id,route,onChanged}:{companyId:string;id:string;route:ApprovalRoute;onChanged:()=>Promise<void>}){
  const {tx}=useI18n();const [reason,setReason]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function decide(decision:string){
    if(busy)return;
    if(decision!=="Approve"&&!reason.trim()){setError("A reason is required for rejection or requested changes.");return;}
    setBusy(true);setError("");
    try{await approvalsApi.decide(companyId,id,route.version,decision,reason);setReason("");await onChanged();}
    catch(e){setError(apiError(e,"Unable to save the approval decision."));}
    finally{setBusy(false);}
  }
  return <section className="prq-panel"><h2>{tx("Approval route")}</h2><p>{route.policy.name} · {tx(route.status)}</p>
    <ol>{route.policy.stages.map((stage,index)=><li key={index}><strong>{stage.name}</strong>: {stage.approverIds.map(x=>route.userNames[x]??tx("Assigned reviewer")).join(", ")}{index===route.currentStage&&route.status==="Pending"?` · ${tx("Current stage")} · ${tx("Due")} ${dateTime(route.dueAtUtc)}`:""}</li>)}</ol>
    {route.history.map(h=><p key={h.id}>{dateTime(h.atUtc)} · {route.userNames[h.actorId]??tx("Reviewer")} · {tx(h.decision)}{h.delegatedForId?` · ${tx("On behalf of")} ${route.userNames[h.delegatedForId]??tx("Assigned reviewer")}`:""}{h.reason?` — ${h.reason}`:""}</p>)}
    {error&&<p role="alert" className="prq-alert">{tx(error)}</p>}
    {route.canDecide&&<><label>{tx("Decision reason")}<Textarea value={reason} maxLength={1000} onChange={e=>setReason(e.target.value)} disabled={busy}/></label><div className="prq-actions"><Button disabled={busy} onClick={()=>void decide("Approve")}>{tx("Approve stage")}</Button><Button variant="secondary" disabled={busy} onClick={()=>void decide("Return")}>{tx("Request changes")}</Button><Button variant="destructive" disabled={busy} onClick={()=>void decide("Reject")}>{tx("Reject")}</Button></div></>}
  </section>;
}
