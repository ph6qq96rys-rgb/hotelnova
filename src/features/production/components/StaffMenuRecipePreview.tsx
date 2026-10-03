import { useAppScope } from "../../../app/useAppScope";
import { http } from "../../../api/http";
import { RecipePreview, type RecipePreviewDetails } from "../../../components/ui/RecipePreview";

export default function StaffMenuRecipePreview({ id, name }: { id: string; name: string }) {
  const { companyId, branchId } = useAppScope();
  if (!companyId || !branchId) return <span>{name}</span>;
  const endpoint = `/companies/${companyId}/branches/${branchId}/menu/items/${id}/customer-details`;
  return <RecipePreview key={endpoint} name={name}
    loadDetails={async signal => (await http.get<RecipePreviewDetails>(endpoint, { signal })).data} />;
}
