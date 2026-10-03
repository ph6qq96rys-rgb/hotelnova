import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, Loader2 } from "lucide-react";
import "../../styles/design-system.css";
export function StateMessage({tone="info",children,action}:{tone?:"info"|"success"|"warning"|"error"|"loading";children:ReactNode;action?:ReactNode}){
 const Icon=tone==="success"?CheckCircle2:tone==="loading"?Loader2:tone==="info"?Info:AlertCircle;
 return <div className={`ui-state ui-state--${tone}`} role={tone==="error"?"alert":"status"} aria-busy={tone==="loading"||undefined}><Icon size={18} aria-hidden="true"/><div className="ui-state-content">{children}</div>{action}</div>;
}
export function EmptyState({title,detail,action}:{title:string;detail:string;action?:ReactNode}){
 return <div className="ui-empty"><h3>{title}</h3><p>{detail}</p>{action&&<div className="ui-empty-actions">{action}</div>}</div>;
}
