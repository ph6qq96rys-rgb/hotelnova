import { useEffect, useState } from "react";
import { useAppScope } from "../../app/useAppScope";
import { http } from "../../api/http";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import type { MenuSettings, PublicMenuItem } from "./types";
import "./public-menu.css";

function message(error: unknown) {
  const e = error as { response?: { data?: { message?: string } } };
  return e.response?.data?.message || "Unable to save or load the menu. Please try again.";
}
export default function BranchQrMenuPage() {
  const { companyId, branchId } = useAppScope();
  return <div className="page"><header className="ui-page-header"><div><h1>QR Menu</h1><p>Publish your branch menu for guests to browse on their phones.</p></div></header>
    {!branchId ? <p>Select a branch using the branch selector to manage its QR menu.</p> : <BranchMenuEditor key={companyId + branchId} companyId={companyId} branchId={branchId} />}
  </div>;
}
function BranchMenuEditor({companyId, branchId}:{companyId:string; branchId:string}) {
  const base = `/companies/${companyId}/branches/${branchId}/public-menu`;
  const [data,setData] = useState<MenuSettings | null>(null);
  const [enabled,setEnabled] = useState(false);
  const [showUnavailable,setShowUnavailable] = useState(false);
  const [logo,setLogo] = useState("");
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [busy,setBusy] = useState(false);
  const [qr,setQr] = useState("");
  const [reload,setReload] = useState(0);
  function apply(value:MenuSettings) { setData(value); setEnabled(value.isEnabled); setShowUnavailable(value.showUnavailableItems); setLogo(value.logoUrl ?? ""); }
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    http.get<MenuSettings>(base,{signal:controller.signal}).then(r => apply(r.data)).catch(e => {if(!controller.signal.aborted)setError(message(e));});
    return () => controller.abort();
  },[base,reload]);
  useEffect(() => {
    if (!data?.isEnabled || !data.publicUrl) {setQr("");return;}
    const controller = new AbortController();
    let url = "";
    http.get(base + "/qr.png",{responseType:"blob",signal:controller.signal}).then(r => {
      if(!controller.signal.aborted){url=URL.createObjectURL(r.data);setQr(url);}
    }).catch(e=>{if(!controller.signal.aborted)setError(message(e));});
    return ()=>{controller.abort();if(url)URL.revokeObjectURL(url);setQr("");};
  },[base,data?.isEnabled,data?.publicUrl]);
  async function save() {
    setBusy(true);setError("");setNotice("");
    try {
      const result=await http.put<MenuSettings>(base,{isEnabled:enabled,showUnavailableItems:showUnavailable,logoUrl:logo.trim()||null});
      apply(result.data);setNotice(enabled ? "Menu published. Your printed QR code will continue to show current menu updates." : "Menu unpublished. Existing QR links now show an unavailable message.");
    } catch(e){setError(message(e));} finally {setBusy(false);}
  }
  function printQr() {
    if(!qr || !data)return;
    const popup=window.open("","_blank","width=600,height=700");
    if(!popup){setError("Allow pop-ups to print the QR code, or download the PNG.");return;}
    popup.opener=null;
    popup.document.title="Menu QR — "+data.branchName;
    const sheet=popup.document.createElement("main");sheet.style.cssText="text-align:center;padding:40px";
    sheet.style.fontFamily=getComputedStyle(document.body).fontFamily;
    const title=popup.document.createElement("h1");title.textContent=data.branchName;
    const instructions=popup.document.createElement("p");instructions.textContent="Scan to view our menu · የምግብ ዝርዝሩን ለማየት ይቃኙ";
    const img=popup.document.createElement("img");img.width=320;img.height=320;img.alt="Scan to view the menu";
    img.onload=()=>{popup.focus();popup.print();};img.src=qr;
    sheet.append(title,instructions,img);popup.document.body.append(sheet);
  }
  return <>
    {error && <p role="alert" className="qr-menu-error">{error} <Button variant="outline" onClick={()=>setReload(x=>x+1)}>Retry</Button></p>}
    {notice && <p role="status" className="qr-menu-success">{notice}</p>}
    {!data ? <p role="status">{error ? "Menu settings could not be loaded." : "Loading menu settings…"}</p> : <>
      <div className="qr-menu-settings">
        <div className="qr-menu-fields">
          <h2>{data.branchName}</h2>
          <label>Public menu<Select aria-label="Public menu" value={enabled?"yes":"no"} onChange={e=>setEnabled(e.target.value==="yes")}><option value="no">Not published</option><option value="yes">Published — anyone with the QR code can view</option></Select></label>
          <label>Inactive or unavailable items<Select aria-label="Inactive or unavailable items" value={showUnavailable?"show":"hide"} onChange={e=>setShowUnavailable(e.target.value==="show")}><option value="hide">Hide from customers</option><option value="show">Show as currently unavailable</option></Select></label>
          <label>Restaurant logo URL<Input type="url" placeholder="https://…" value={logo} maxLength={2000} onChange={e=>setLogo(e.target.value)} /></label>
          <p>The branch name appears beneath the logo. Displayed prices include VAT and service charge using POS pricing settings. Names, categories, and availability come from this branch's POS menu. Deleted items and inactive categories stay hidden.</p>
          <div className="ui-page-actions"><Button disabled={busy} onClick={()=>void save()}>{busy?"Saving…":data.publicUrl?"Save menu settings":"Generate QR & save"}</Button>
            {data.isEnabled && data.publicUrl && <a className="ui-button ui-button--outline" href={data.publicUrl} target="_blank" rel="noopener noreferrer">View public menu</a>}</div>
        </div>
        <aside className="qr-menu-preview"><h3>Print once. Keep it current.</h3>
          {qr ? <><img src={qr} alt={`Menu QR code for ${data.branchName}`} /><p>{data.branchName}</p><div className="ui-page-actions"><a href={qr} download={`menu-${branchId}.png`} className="ui-button ui-button--outline">Download PNG</a><Button variant="outline" onClick={printQr}>Print QR</Button></div></> : <p>Publish the menu to generate its printable QR code.</p>}
        </aside>
      </div>
      <section style={{marginTop:32}}><h2>Descriptions & photos</h2><p>Add optional English and Amharic descriptions. Leave the photo URL empty for a text-only item. Edit names and prices in Menu Items.</p>
        {!data.items.length && <p>No menu items are assigned to active categories in this branch yet.</p>}
        {data.items.map(item=><ItemEditor key={item.id} item={item} base={base} />)}
      </section>
    </>}
  </>;
}
function ItemEditor({item,base}:{item:PublicMenuItem;base:string}) {
  const [description,setDescription]=useState(item.description??"");
  const [localDescription,setLocalDescription]=useState(item.localDescription??"");
  const [image,setImage]=useState(item.imageUrl??"");
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[saved,setSaved]=useState(false);
  async function save(){setBusy(true);setError("");setSaved(false);try{await http.put(base+"/items/"+item.id,{description,localDescription,imageUrl:image});setSaved(true);}catch(e){setError(message(e));}finally{setBusy(false);}}
  return <details className="qr-menu-editor"><summary>{item.name} · {item.price.toFixed(2)} ETB{!item.isAvailable?" · Unavailable":""}</summary>
    <div className="qr-menu-fields">
      <label>English description<Textarea maxLength={600} value={description} onChange={e=>setDescription(e.target.value)} /></label>
      <label>Amharic description<Textarea lang="am" maxLength={600} value={localDescription} onChange={e=>setLocalDescription(e.target.value)} /></label>
      <label>Photo URL<Input type="url" maxLength={2000} placeholder="https://…" value={image} onChange={e=>setImage(e.target.value)} /></label>
      <div><Button disabled={busy} onClick={()=>void save()}>{busy?"Saving…":"Save item presentation"}</Button></div>
      {error&&<p role="alert" className="qr-menu-error">{error}</p>}{saved&&<p role="status" className="qr-menu-success">Saved. The public menu will refresh automatically.</p>}
    </div>
  </details>;
}
