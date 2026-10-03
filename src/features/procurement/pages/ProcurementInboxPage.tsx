import { useEffect,useState,type FormEvent } from "react";
import { Link } from "react-router-dom";
import { http } from "../../../api/http";
import { PageHeader } from "../../../components/PageHeader";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Select } from "../../../components/ui/select";
import { Textarea } from "../../../components/ui/textarea";
import { useI18n } from "../../../i18n";
import { apiError,dateTime,useCompanyId } from "../components/p2pShared";

type Notification={id:string;title:string;message:string;reviewPath:string;createdAtUtc:string;readAtUtc?:string};
type Delegation={id:string;principalUserId:string;delegateUserId:string;fromUtc:string;untilUtc:string;reason:string;isActive:boolean};
export default function ProcurementInboxPage(){
  const {tx}=useI18n(),companyId=useCompanyId();const root=`/companies/${companyId}/procurement`;
  const [notifications,setNotifications]=useState<Notification[]>([]),[delegations,setDelegations]=useState<Delegation[]>([]),[users,setUsers]=useState<{id:string;name:string}[]>([]);
  const [form,setForm]=useState({delegateUserId:"",fromUtc:"",untilUtc:"",reason:""}),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function load(){const [n,d,u]=await Promise.all([http.get<Notification[]>(`${root}/notifications`),http.get<Delegation[]>(`${root}/delegations`),http.get<{id:string;name:string}[]>(`${root}/delegations/candidates`)]);setNotifications(n.data);setDelegations(d.data);setUsers(u.data);}
  useEffect(()=>{if(companyId)void load().catch(e=>setError(apiError(e,"Unable to load purchasing inbox.")));},[companyId]);
  async function save(e:FormEvent){e.preventDefault();setBusy(true);setError("");try{await http.post(`${root}/delegations`,{...form,fromUtc:new Date(form.fromUtc).toISOString(),untilUtc:new Date(form.untilUtc).toISOString()});setForm({delegateUserId:"",fromUtc:"",untilUtc:"",reason:""});await load();}catch(e){setError(apiError(e,"Unable to delegate approval duties."));}finally{setBusy(false);}}
  async function revoke(id:string){setBusy(true);setError("");try{await http.delete(`${root}/delegations/${id}`);await load();}catch(e){setError(apiError(e,"Only the person who delegated can revoke this delegation."));}finally{setBusy(false);}}
  async function markRead(id:string){try{await http.post(`${root}/notifications/${id}/read`);await load();}catch(e){setError(apiError(e,"Unable to mark notification as read."));}}
  return <div className="prq-page"><PageHeader title={tx("Purchasing inbox")} subtitle={tx("Review assigned work, overdue approvals and temporary delegations.")}/>{error&&<p role="alert" className="prq-alert">{tx(error)}</p>}
    <section className="prq-panel"><h2>{tx("Notifications")}</h2>{notifications.length===0?<p>{tx("No purchasing notifications.")}</p>:notifications.map(n=><article key={n.id}><h3>{n.title}</h3><p>{n.message}</p><p>{dateTime(n.createdAtUtc)}</p><Link to={`/companies/${companyId}${n.reviewPath}`}>{tx("Open for review")}</Link>{!n.readAtUtc&&<Button variant="ghost" onClick={()=>void markRead(n.id)}>{tx("Mark as read")}</Button>}</article>)}</section>
    <form className="prq-panel" onSubmit={e=>void save(e)}><h2>{tx("Delegate my approvals")}</h2><p>{tx("The delegate must have access to the requisition’s company and branch. Delegation does not permit self-approval or transfer management permissions.")}</p><div className="prq-form-grid"><label>{tx("Delegate")}<Select required value={form.delegateUserId} onChange={e=>setForm(f=>({...f,delegateUserId:e.target.value}))}><option value="">{tx("Choose a reviewer")}</option>{users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</Select></label><label>{tx("From (local time)")}<Input type="datetime-local" required value={form.fromUtc} onChange={e=>setForm(f=>({...f,fromUtc:e.target.value}))}/></label><label>{tx("Until (local time)")}<Input type="datetime-local" required value={form.untilUtc} onChange={e=>setForm(f=>({...f,untilUtc:e.target.value}))}/></label><label>{tx("Reason")}<Textarea required maxLength={1000} value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))}/></label></div><Button disabled={busy} type="submit">{tx("Save delegation")}</Button></form>
    <section className="prq-panel"><h2>{tx("Delegation history")}</h2>{delegations.length===0?<p>{tx("No delegations.")}</p>:delegations.map(d=><article key={d.id}><p>{users.find(u=>u.id===d.principalUserId)?.name??tx("You")} → {users.find(u=>u.id===d.delegateUserId)?.name??tx("You")} · {dateTime(d.fromUtc)} – {dateTime(d.untilUtc)} · {tx(d.isActive?"Enabled":"Revoked")}</p><p>{d.reason}</p>{d.isActive&&<Button variant="secondary" disabled={busy} onClick={()=>void revoke(d.id)}>{tx("Revoke my delegation")}</Button>}</article>)}</section>
  </div>;
}
