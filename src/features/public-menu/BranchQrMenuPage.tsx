import { useI18n } from "../../i18n";
import { groupMenuItems, menuLabel } from "./menuPresentation";
import { useEffect, useState } from "react";
import { useAppScope } from "../../app/useAppScope";
import { http } from "../../api/http";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import type { IngredientSource, MenuSettings, PublicMenuItem } from "./types";
import "./public-menu.css";

const INGREDIENT_SOURCES = [
  { value: "2", label: "Show each dish's recipe ingredients (a written list replaces them)" },
  { value: "1", label: "Show only ingredient lists written for guests" },
  { value: "0", label: "Don't show ingredients" },
];
function sourceValue(value?: IngredientSource): string {
  if (value === 0 || value === "Off") return "0";
  if (value === 1 || value === "AuthoredOnly") return "1";
  return "2";
}
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
  const [ingredientSource,setIngredientSource] = useState("2");
  const [error,setError] = useState("");
  const [notice,setNotice] = useState("");
  const [busy,setBusy] = useState(false);
  const [qr,setQr] = useState("");
  const [reload,setReload] = useState(0);
  function apply(value:MenuSettings) { setData(value); setEnabled(value.isEnabled); setShowUnavailable(value.showUnavailableItems); setLogo(value.logoUrl ?? ""); setIngredientSource(sourceValue(value.ingredientSource)); }
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
      const result=await http.put<MenuSettings>(base,{isEnabled:enabled,showUnavailableItems:showUnavailable,logoUrl:logo.trim()||null,ingredientSource:Number(ingredientSource)});
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
          <label>Ingredients under each dish<Select aria-label="Ingredients under each dish" value={ingredientSource} onChange={e=>setIngredientSource(e.target.value)}>{INGREDIENT_SOURCES.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</Select>
            <small className="ui-field-help">Guests see ingredient names in small print. Quantities, costs, suppliers and packaging are never shown. Pack sizes such as "1L" are removed from names.</small></label>
          <label>Restaurant logo URL<Input type="url" placeholder="https://…" value={logo} maxLength={2000} onChange={e=>setLogo(e.target.value)} /></label>
          {data.pricing ? <PricingSummary data={data} /> : null}
          <p>The restaurant and branch names appear beneath the logo. Displayed prices include VAT and service charge using POS pricing settings. Names, categories, and availability come from this branch's POS menu. Deleted items and inactive categories stay hidden.</p>
          <div className="ui-page-actions"><Button disabled={busy} onClick={()=>void save()}>{busy?"Saving…":data.publicUrl?"Save menu settings":"Generate QR & save"}</Button>
            {data.isEnabled && data.publicUrl && <a className="ui-button ui-button--outline" href={data.publicUrl} target="_blank" rel="noopener noreferrer">View public menu</a>}</div>
        </div>
        <aside className="qr-menu-preview"><h3>Print once. Keep it current.</h3>
          {qr ? <><img src={qr} alt={`Menu QR code for ${data.branchName}`} /><p>{data.branchName}</p><div className="ui-page-actions"><a href={qr} download={`menu-${branchId}.png`} className="ui-button ui-button--outline">Download PNG</a><Button variant="outline" onClick={printQr}>Print QR</Button></div></> : <p>Publish the menu to generate its printable QR code.</p>}
        </aside>
      </div>
      <MenuPresentationEditor items={data.items} base={base} />
    </>}
  </>;
}
function PricingSummary({ data }: { data: MenuSettings }) {
  const p = data.pricing!;
  const parts = [p.vatRate ? `${p.vatRate}% VAT` : "no VAT", p.serviceChargeRate ? `${p.serviceChargeRate}% service charge` : "no service charge"];
  const own = data.itemsWithOwnRates ?? [];
  return <div className="qr-menu-pricing" role="note">
    <strong>Menu prices include {parts.join(" and ")}{p.vatRate && p.serviceChargeRate ? (p.vatOnServiceCharge ? ", with VAT charged on the service charge" : ", with no VAT on the service charge") : ""}.</strong>
    <span>A dish priced 100.00 in Menu Items shows as {p.exampleFor100.toFixed(2)} {p.pricesIncludeVat ? "(menu prices already include VAT)" : ""}. These rates come from Company Settings, Tax, and are the same ones the POS charges.</span>
    {own.length ? <span className="qr-menu-pricing-warn">{own.length === 1 ? "1 dish uses" : `${own.length} dishes use`} its own rates instead: {own.slice(0, 6).map(x => `${x.name} (${[x.vatRate != null ? `VAT ${x.vatRate}%` : "", x.serviceChargeRate != null ? `service ${x.serviceChargeRate}%` : ""].filter(Boolean).join(", ")})`).join("; ")}{own.length > 6 ? "; …" : ""}. Clear them in Menu Items to use the company rates.</span> : null}
  </div>;
}

function MenuPresentationEditor({ items, base }: { items: PublicMenuItem[]; base: string }) {
  const { language } = useI18n();
  const am = language === "am";
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [reviewOnly, setReviewOnly] = useState(false);
  const [savedTranslations, setSavedTranslations] = useState<Record<string, boolean>>({});
  const missing = (item: PublicMenuItem) => savedTranslations[item.id] ?? !item.localDescription?.trim();
  const groups = groupMenuItems(items);
  const missingCount = items.filter(missing).length;
  const needle = query.trim().toLocaleLowerCase();
  const matches = (item: PublicMenuItem) => (!reviewOnly || missing(item)) && (!needle || [item.name, item.localName, item.description, item.localDescription, item.subCategoryName].some(v => v?.toLocaleLowerCase().includes(needle)));
  const visibleCount = groups.filter(g => !category || g.key === category).flatMap(g => g.groups.flatMap(s => s.items)).filter(matches).length;
  return <section className="qr-catalog" lang={language}>
    <header className="qr-catalog-heading"><div><span className="qr-eyebrow">{am ? "የሜኑ አስተዳደር" : "MENU CONTENT"}</span><h2>{am ? "የምግብና መጠጥ ዝርዝር" : "Menu presentation"}</h2><p>{am ? "በምድብ ይፈልጉ፤ ለእያንዳንዱ ምግብ መግለጫና ፎቶ ያስተካክሉ።" : "Browse by section and refine each item's descriptions and photo."}</p></div><div className="qr-catalog-total"><strong>{items.length}</strong><span>{am ? "አይነቶች" : "menu items"}</span></div></header>
    <div className="qr-catalog-tools"><Input type="search" value={query} onChange={e=>setQuery(e.target.value)} aria-label={am ? "ዝርዝሩን ይፈልጉ" : "Search menu items"} placeholder={am ? "በስም ወይም በመግለጫ ይፈልጉ" : "Search by name or description"} /><Button variant={reviewOnly ? "default" : "outline"} aria-pressed={reviewOnly} onClick={()=>setReviewOnly(x=>!x)}>{am ? "የአማርኛ መግለጫ የሌላቸው" : "Missing Amharic"} <span>{missingCount}</span></Button></div>
    <nav className="qr-catalog-nav" aria-label={am ? "የሜኑ ምድቦች" : "Menu categories"}><Button variant={!category?"default":"ghost"} aria-pressed={!category} onClick={()=>setCategory("")}>{am ? "ሁሉም" : "All items"}</Button>{groups.map(g=><Button key={g.key} variant={category===g.key?"default":"ghost"} aria-pressed={category===g.key} onClick={()=>setCategory(g.key)}>{menuLabel(g.key,language,g.localName)} <span>{g.groups.reduce((n,s)=>n+s.items.length,0)}</span></Button>)}</nav>
    <p className="qr-catalog-help">{am ? "ለእንግዶች የሚታዩ ምድቦች ናቸው። የሽያጭ ምድቦችን፣ ዋጋዎችንና አሰራሮችን በሜኑ አይነቶች ገጽ ያስተካክሉ።" : "These sections organize the guest menu. Manage POS categories, prices and recipes in Menu Items."}</p>
    <p role="status" className="qr-catalog-help">{visibleCount} {am ? "አይነቶች ይታያሉ" : "items shown"}</p>
    {!visibleCount && <div className="qr-catalog-empty">{am ? "ከፍለጋዎ ጋር የሚዛመድ አይነት አልተገኘም።" : "No items match these filters."}</div>}
    {groups.map(section=><section key={section.key} className="qr-catalog-section" hidden={(!!category && category!==section.key) || !section.groups.some(g=>g.items.some(matches))}><h3>{menuLabel(section.key,language,section.localName)}</h3>{section.groups.map(group=><div key={group.key} className="qr-catalog-group" hidden={!group.items.some(matches)}><header><h4>{menuLabel(group.key,language)}</h4><span>{group.items.filter(matches).length}</span></header>{group.items.map(item=><div key={item.id} hidden={!matches(item)}><ItemEditor item={item} base={base} onSaved={missing=>setSavedTranslations(v=>({...v,[item.id]:missing}))} /></div>)}</div>)}</section>)}
  </section>;
}

function ItemEditor({item,base,onSaved}:{item:PublicMenuItem;base:string;onSaved:(missing:boolean)=>void}) {
  const { language } = useI18n();
  const am = language === "am";
  const [description,setDescription]=useState(item.description??"");
  const [localDescription,setLocalDescription]=useState(item.localDescription??"");
  const [image,setImage]=useState(item.imageUrl??"");
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[saved,setSaved]=useState(false);
  async function save(){setBusy(true);setError("");setSaved(false);try{await http.put(base+"/items/"+item.id,{description,localDescription,imageUrl:image});setSaved(true);onSaved(!localDescription.trim());}catch(e){setError(message(e));}finally{setBusy(false);}}
  const ingredients = item.recipeDetails?.ingredients?.join(", ");
  return <details className="qr-menu-editor"><summary><span className="qr-summary-row"><span className="qr-item-title">{am && item.localName ? item.localName : item.name}<small>{localDescription.trim() ? (am ? "ሁለት ቋንቋዎች" : "English / አማርኛ") : (am ? "የአማርኛ መግለጫ ያስፈልጋል" : "Amharic description needed")}</small></span><span className="qr-item-price">{item.price.toFixed(2)} {am ? "ብር" : "ETB"}{!item.isAvailable && <small>{am ? "አይገኝም" : "Unavailable"}</small>}</span></span></summary>
    <div className="qr-menu-fields">
      <p className="qr-menu-editor-ingredients">{ingredients ? `Guests see: ${ingredients}` : "No ingredients shown for this dish. Add a recipe or write an ingredient list in Menu Items."}</p>
      <label>{am ? "የእንግሊዝኛ መግለጫ" : "English description"}<Textarea maxLength={600} value={description} onChange={e=>setDescription(e.target.value)} /></label>
      <label>{am ? "የአማርኛ መግለጫ" : "Amharic description"}<Textarea lang="am" maxLength={600} value={localDescription} onChange={e=>setLocalDescription(e.target.value)} /></label>
      <label>{am ? "የፎቶ አገናኝ" : "Photo URL"}<Input type="url" maxLength={2000} placeholder="https://…" value={image} onChange={e=>setImage(e.target.value)} /></label>
      <div><Button disabled={busy} onClick={()=>void save()}>{busy ? (am ? "በማስቀመጥ ላይ…" : "Saving…") : (am ? "መግለጫውን ያስቀምጡ" : "Save item presentation")}</Button></div>
      {error&&<p role="alert" className="qr-menu-error">{error}</p>}{saved&&<p role="status" className="qr-menu-success">{am ? "ተቀምጧል። ለእንግዶች የሚታየው ሜኑ በራሱ ይዘምናል።" : "Saved. The public menu will refresh automatically."}</p>}
    </div>
  </details>;
}
