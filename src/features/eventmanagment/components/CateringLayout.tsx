import type { ReactNode } from "react";
import "../pages/catering-operations.css";

export function cateringPath(pathname: string, target: string) {
 const marker=pathname.indexOf("/eventmanagment");
 return (marker>=0?pathname.slice(0,marker):pathname.replace(/\/$/,""))+"/eventmanagment/"+target;
}
export function CateringLayout({children}:{children:ReactNode}) {
 return <div className="co-layout co-layout--main-navigation"><div className="co-content">{children}</div></div>;
}
