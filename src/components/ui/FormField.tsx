import { useId, type InputHTMLAttributes } from "react";
import { Input } from "./input";
export function FormField({label,help,error,id,...props}:InputHTMLAttributes<HTMLInputElement>&{label:string;help?:string;error?:string}){
 const generated=useId(),control=id??generated;
 const described=[props["aria-describedby"],help?control+"-help":null,error?control+"-error":null].filter(Boolean).join(" ")||undefined;
 return <div className="ui-field"><label htmlFor={control}>{label}{props.required&&<span aria-hidden="true"> *</span>}</label><Input {...props} id={control} aria-invalid={!!error||undefined} aria-describedby={described}/>{help&&<p id={control+"-help"} className="ui-field-help">{help}</p>}{error&&<p id={control+"-error"} className="ui-field-error" role="alert">{error}</p>}</div>;
}
