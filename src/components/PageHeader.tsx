import type { ReactNode } from "react";
import "../styles/design-system.css";
export function PageHeader({title,subtitle,actions}:{title:string;subtitle?:string;actions?:ReactNode}){
 return <header className="ui-page-header"><div><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>{actions&&<div className="ui-page-actions">{actions}</div>}</header>;
}
