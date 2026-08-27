import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useErpNavigate } from "../../../routes/useErpNavigation";
import ProductionWorkflowBar from "../components/ProductionWorkflowBar";
import MenuItemForm from "../components/MenuItemForm";
import MenuItemMetrics from "../components/MenuItemMetrics";
import MenuItemReadinessCard from "../components/MenuItemReadinessCard";
import { useMenuItemDetail } from "../hooks/useMenuItemDetail";
import "../layout/menu-item-detail.css";
import "../layout/production.css";

const EMPTY_GUID = "00000000-0000-0000-0000-000000000000";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function isValidRouteId(value?: string | null): value is string {
  const id = clean(value).toLowerCase();

  return Boolean(
    id &&
      id !== "new" &&
      id !== "create" &&
      id !== ":id" &&
      id !== EMPTY_GUID
  );
}

export default function MenuItemDetailPage() {
  const erpNavigation = useErpNavigate() as any;
  const { id } = useParams<{ id?: string }>();

  const menuItemId = isValidRouteId(id) ? id : null;

  const nav = useMemo(() => {
    return (to: string | number, options?: { replace?: boolean }) => {
      if (typeof to === "number") {
        if (typeof erpNavigation?.back === "function") return erpNavigation.back();
        if (typeof erpNavigation?.navigate === "function") return erpNavigation.navigate(to);
        return window.history.go(to);
      }

      if (typeof erpNavigation === "function") return erpNavigation(to, options);
      if (typeof erpNavigation?.navigate === "function") return erpNavigation.navigate(to, options);
      if (typeof erpNavigation?.to === "function") return erpNavigation.to(to, options);
      if (typeof erpNavigation?.go === "function") return erpNavigation.go(to, options);

      window.location.assign(to);
    };
  }, [erpNavigation]);

  const vm = useMenuItemDetail(menuItemId ?? undefined);

  const posReady = Boolean(
    vm.item?.isActive === true &&
      vm.item?.isAvailableForSale === true &&
      vm.item?.hasRecipe === true &&
      vm.item?.hasConsumptionLocation === true
  );

  if (!menuItemId) {
    return (
      <div className="p-page mid-page">
        <ProductionWorkflowBar active="menu" />

        <div className="p-page-header">
          <div>
            <p className="p-kicker">ERP Menu Master - Branch Scope</p>
            <h1 className="p-title">Invalid Menu Item Route</h1>
            <p className="p-subtitle">
              This page edits existing menu items only. Use the create workflow for new menu items.
            </p>
          </div>

          <div className="p-btn-row">
            <button
              className="p-btn p-btn--outline"
              onClick={() => nav("/production/menu/items")}
              type="button"
            >
              - Menu Items
            </button>

            <button
              className="p-btn p-btn--accent"
              onClick={() => nav("/production/menu/items/new")}
              type="button"
            >
              + New Menu Item
            </button>
          </div>
        </div>

        <div className="p-alert p-alert--error">
          <span className="p-alert__body">
            The route did not contain a valid menu item id. Make sure the router maps
            /production/menu/items/new to MenuItemCreatePage before the dynamic
            /production/menu/items/:id route.
          </span>
        </div>
      </div>
    );
  }

  if (!vm.hasContext) {
    return (
      <div className="p-page">
        <div className="p-guard">
          <div className="p-guard__icon"></div>
          Company, branch, or menu item context is missing.
        </div>
      </div>
    );
  }

  return (
    <div className="p-page mid-page">
      <ProductionWorkflowBar active="menu" menuItemId={menuItemId} />

      <div className="p-page-header">
        <div>
          <p className="p-kicker">ERP Menu Master - Branch Scope</p>
          <h1 className="p-title">{vm.item?.name || "Menu Item"}</h1>
          <p className="p-subtitle">
            Govern branch sales behavior, selling price, POS availability, recipe linkage,
            and stock consumption controls from one auditable workspace.
          </p>
        </div>

        <div className="p-btn-row">
          <button
            className="p-btn p-btn--outline"
            onClick={() => nav(-1)}
            disabled={vm.saving}
            type="button"
          >
            Back
          </button>

          <button
            className="p-btn p-btn--outline"
            onClick={() => nav("/production/menu/items")}
            disabled={vm.saving}
            type="button"
          >
            Menu Items
          </button>

          <button
            className="p-btn p-btn--accent"
            onClick={vm.save}
            disabled={!vm.canSave}
            type="button"
          >
            {vm.saving ? "Saving..." : "Save Configuration"}
          </button>
        </div>
      </div>

      {vm.error && (
        <div className="p-alert p-alert--error">
          <span className="p-alert__body">{vm.error}</span>
          <button className="p-dismiss" onClick={() => vm.setError(null)} type="button">
            
          </button>
        </div>
      )}

      {vm.notice && (
        <div className="p-alert p-alert--success">
          <span className="p-alert__body">{vm.notice}</span>
          <button className="p-dismiss" onClick={() => vm.setNotice(null)} type="button">
            
          </button>
        </div>
      )}

      {vm.loading || !vm.item ? (
        <div className="p-card">
          <div className="p-card__body" style={{ color: "var(--p-text-muted)" }}>
            Loading menu configuration...
          </div>
        </div>
      ) : (
        <>
          <MenuItemMetrics item={vm.item} />

          <div className="mid-layout">
            <MenuItemForm
              item={vm.item}
              form={vm.form}
              setForm={vm.setForm}
              categories={vm.categories}
              locations={vm.locations}
              selectedCategory={vm.selectedCategory}
              posReady={posReady}
              saving={vm.saving}
              canSave={vm.canSave}
              onSave={vm.save}
              onReset={vm.load}
            />

            <MenuItemReadinessCard
              item={vm.item}
              recipe={vm.recipe}
              effectiveLocationName={vm.effectiveLocationName}
              posReady={posReady}
              onOpenRecipe={() => nav(`/production/menu/items/${menuItemId}/recipe`)}
            />
          </div>
        </>
      )}
    </div>
  );
}
