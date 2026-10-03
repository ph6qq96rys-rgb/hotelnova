import { useMemo } from "react";
import { useErpNavigate } from "../../../routes/useErpNavigation";
import ProductionWorkflowBar from "../components/ProductionWorkflowBar";
import MenuItemsListFilters from "../components/MenuItemsListFilters";
import MenuItemsListMetrics from "../components/MenuItemsListMetrics";
import MenuItemsTable from "../components/MenuItemsTable";
import { useMenuItemsList } from "../hooks/useMenuItemsList";
import "../layout/menu-items-list.css";
import "../layout/production.css";

function createNav(erpNavigation: any) {
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
}

export default function MenuItemsListPage() {
  const erpNavigation = useErpNavigate() as any;
  const nav = useMemo(() => createNav(erpNavigation), [erpNavigation]);
  const vm = useMenuItemsList();

  function openCreate() {
    nav("/production/menu/items/new");
  }

  function openItem(id: string) {
    if (!id || id === ":id") return;
    nav(`/production/menu/items/${id}`);
  }

  function openRecipe(id: string) {
    if (!id || id === ":id") return;
    nav(`/production/menu/items/${id}/recipe`);
  }

  if (!vm.hasContext) {
    return (
      <div className="p-page">
        <div className="p-guard">
          <div className="p-guard__icon"></div>
          Company or branch context is missing.
        </div>
      </div>
    );
  }

  return (
    <div className="p-page" style={{ maxWidth: 1280 }}>
      <ProductionWorkflowBar active="menu" />

      <div className="p-page-header">
        <div>
          <p className="p-kicker">ERP Menu Master - Branch Scope</p>
          <h1 className="p-title">Menu Items</h1>
          <p className="p-subtitle">
            Search, audit, and open branch menu items for POS readiness, recipe costing,
            selling price, and stock consumption configuration.
          </p>
        </div>

        <div className="p-btn-row">
          <button
            className="p-btn p-btn--outline"
            onClick={() => nav(-1)}
            disabled={vm.loading}
            type="button"
          >
            Back
          </button>

          <button
            className="p-btn p-btn--outline"
            onClick={() => void vm.load()}
            disabled={vm.loading}
            type="button"
          >
            {vm.loading ? "Refreshing..." : "Refresh"}
          </button>

          <button
            className="p-btn p-btn--accent"
            onClick={openCreate}
            disabled={vm.loading}
            type="button"
          >
            + New Menu Item
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

      <MenuItemsListMetrics {...vm.summary} />

      <MenuItemsListFilters
        filters={vm.filters}
        categories={vm.categories}
        disabled={vm.loading}
        onChange={vm.setFilters}
        onRefresh={vm.load}
      />

      <MenuItemsTable
        items={vm.filteredItems}
        loading={vm.loading}
        onOpen={openItem}
        onOpenRecipe={openRecipe}
        onOpenCustomerDetails={id => nav(`/production/menu/items/${id}/customer-details`)}
      />
    </div>
  );
}
