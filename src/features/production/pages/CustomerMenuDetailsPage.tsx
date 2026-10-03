import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAppScope } from "../../../app/useAppScope";
import { useAuth } from "../../../auth/AuthProvider";
import { hasErpPermission } from "../../../auth/erpAccess";
import { http } from "../../../api/http";
import { Button } from "../../../components/ui/button";
import { Textarea } from "../../../components/ui/textarea";
import "../layout/customer-menu-details.css";

type Details = {
  name: string; description: string | null; ingredients: string[];
  dietaryInformation: string | null; allergenInformation: string | null; imageUrl: string | null;
};
function errorMessage(error: unknown) {
  const response = (error as { response?: { status?: number; data?: { message?: string } } }).response;
  const status = response?.status;
  if (status === 400 && response?.data?.message) return response.data.message;
  if (status === 404) return "This menu item could not be found.";
  if (status === 403) return "You do not have permission to access this menu item.";
  return "Unable to load or save these details. Please try again.";
}
export default function CustomerMenuDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { companyId, branchId } = useAppScope();
  const auth = useAuth();
  if (!companyId || !branchId || !id) return <div className="page"><p>Select a branch to view menu item details.</p></div>;
  return <CustomerMenuDetails key={companyId + branchId + id}
    endpoint={`/companies/${companyId}/branches/${branchId}/menu/items/${id}/customer-details`}
    canEdit={hasErpPermission(auth, "menu.manage")} />;
}
export function CustomerMenuDetails({ endpoint, canEdit }: { endpoint: string; canEdit: boolean }) {
  const [data, setData] = useState<Details | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ingredients, setIngredients] = useState("");
  const [dietary, setDietary] = useState("");
  const [allergens, setAllergens] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError("");
    http.get<Details>(endpoint, { signal: controller.signal }).then(response => {
      if (!controller.signal.aborted) setData(response.data);
    }).catch(e => { if (!controller.signal.aborted) setError(errorMessage(e)); });
    return () => controller.abort();
  }, [endpoint, reload]);
  function edit() {
    if (!data) return;
    setIngredients(data.ingredients.join("\n")); setDietary(data.dietaryInformation ?? "");
    setAllergens(data.allergenInformation ?? ""); setEditing(true); setNotice(""); setError("");
  }
  async function save() {
    setBusy(true); setError("");
    const input = { ingredients: ingredients.split("\n").map(x => x.trim()).filter(Boolean),
      dietaryInformation: dietary.trim() || null, allergenInformation: allergens.trim() || null };
    try {
      await http.put(endpoint, input);
      setEditing(false); setNotice("Customer details saved."); setReload(value => value + 1);
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  return <main className="page customer-menu-details">
    <header className="ui-page-header"><div><p>Customer-facing recipe details</p><h1>{data?.name ?? "Menu item details"}</h1></div>
      {data && canEdit && !editing && <Button variant="outline" onClick={edit}>Edit customer details</Button>}
    </header>
    {error && <p role="alert">{error} {!editing && <Button variant="outline" onClick={() => setReload(value => value + 1)}>Try again</Button>}</p>}
    {notice && <p role="status">{notice}</p>}
    {!data && !error && <p role="status">Loading menu item details…</p>}
    {data && <>
      {data.imageUrl && <img className="customer-menu-details__image" src={data.imageUrl} alt={data.name} />}
      {data.description && <p>{data.description}</p>}
      {editing ? <form onSubmit={e => { e.preventDefault(); void save(); }} className="customer-menu-details__form">
        <p>Enter customer-facing ingredient names only. Leave out quantities, units, portions, preparation instructions, and inventory references.</p>
        <label>Ingredients — one name per line<Textarea aria-label="Ingredients — one name per line" value={ingredients} onChange={e => setIngredients(e.target.value)} rows={6} maxLength={7260} /></label>
        <label>Dietary information<Textarea aria-label="Dietary information" value={dietary} onChange={e => setDietary(e.target.value)} rows={3} maxLength={600} /></label>
        <label>Allergen information<Textarea aria-label="Allergen information" value={allergens} onChange={e => setAllergens(e.target.value)} rows={3} maxLength={600} /></label>
        <p>Enter verified information only. An empty field does not mean an item is allergen-free.</p>
        <div className="ui-page-actions"><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save customer details"}</Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => { setEditing(false); setError(""); }}>Cancel</Button></div>
      </form> : <>
        {data.ingredients.length > 0 && <section><h2>Ingredients</h2><ul>{data.ingredients.map(name => <li key={name}>{name}</li>)}</ul></section>}
        {data.dietaryInformation && <section><h2>Dietary information</h2><p>{data.dietaryInformation}</p></section>}
        {data.allergenInformation && <section><h2>Allergen information</h2><p>{data.allergenInformation}</p></section>}
        {!data.description && !data.ingredients.length && !data.dietaryInformation && !data.allergenInformation && <p>No customer-facing details have been entered yet.</p>}
      </>}
    </>}
  </main>;
}