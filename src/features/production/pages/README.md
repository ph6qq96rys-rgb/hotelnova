# Production Module — Refactored

## What changed

### Files eliminated (dead weight)
| Removed | Replaced by |
|---|---|
| `menu-engineering.css` | `production.css` |
| `menu-item-create.css` | `production.css` |
| `menu-item-detail.css` | `production.css` |
| `production-batch.css` | `production.css` |
| `production-workspace.css` | `production.css` |

5 separate CSS files → 1 unified design system.

### API files (unchanged — already clean)
- `lookups.ts`
- `menuEngineeringApi.ts`
- `menuItemsApi.ts`
- `productionBatchesApi.ts`
- `recipeCostingApi.ts`
- `recipesApi.ts`

---

## Drop-in paths

```
src/features/production/
├── production.css                          ← Unified design system (NEW)
├── layout/
│   └── ProductionWorkspaceLayout.tsx       ← Refactored
├── components/
│   ├── ProductionWorkflowBar.tsx           ← Refactored
│   └── RecipeCostingPanel.tsx              ← Refactored
└── pages/
    ├── MenuItemCreatePage.tsx              ← Refactored
    ├── MenuItemDetailPage.tsx              ← Refactored
    ├── RecipeEditorPage.tsx                ← Refactored
    ├── ProductionBatchPage.tsx             ← Refactored
    └── MenuEngineeringPage.tsx             ← Refactored
```

---

## Design system — `production.css`

All components share a single token set via CSS custom properties:

| Token | Role |
|---|---|
| `--p-surface` / `--p-surface-2` | Card backgrounds |
| `--p-border` / `--p-border-soft` | Borders |
| `--p-text` / `--p-text-muted` | Typography |
| `--p-accent` | Brand amber |
| `--p-success/warning/danger/info` | Semantic colors |
| `--p-r-sm/md/lg/xl` | Border radii |
| `--p-shadow-sm/md` | Elevation |

### Component classes (BEM-style, `p-` prefix)
- **Layout:** `.p-shell`, `.p-sidebar`, `.p-main`, `.p-topbar`, `.p-content`
- **Page:** `.p-page`, `.p-page-header`, `.p-title`, `.p-kicker`, `.p-subtitle`
- **Card:** `.p-card`, `.p-card__head`, `.p-card__body`, `.p-card__footer`
- **Table:** `.p-table`, `.p-table-wrap`, `.p-table__empty`
- **Form:** `.p-field`, `.p-input`, `.p-select`, `.p-checkbox`, `.p-grid-2`
- **Buttons:** `.p-btn` + modifiers `--primary --accent --success --danger --outline --ghost --sm --lg`
- **Badges:** `.p-badge` + `--active --inactive --draft --approved --posted --reversed --warning`
- **Alerts:** `.p-alert` + `--error --success --warning --info`
- **Metrics:** `.p-metric`, `.p-metrics` (horizontal strip)
- **KPI:** `.p-kpi`, `.p-kpi-grid`
- **Workflow bar:** `.p-workflow-bar`, `.p-workflow-step`, `.p-workflow-step--active`

---

## Key refactoring decisions

### 1. Zero duplicate utility functions
`extractApiError`, `fmt`, `normalizeItemType`, `extractApiError` — each lived in 3–4 files. They've been deduplicated inline per file (small enough) or extracted to shared utils. No cross-page imports needed.

### 2. No inline style objects
`RecipeEditorPage` had ~40 `style={{ ... }}` props. All replaced with semantic CSS classes. The only surviving inline styles are single-value exceptions (`width`, `maxWidth`) where a class would be overkill.

### 3. Promise.allSettled over try-catch nesting
`MenuItemDetailPage` now loads menu item + recipe in parallel with `Promise.allSettled`, giving partial success instead of hard failures.

### 4. CSS specificity is flat
All selectors are single-class. No descendant chains, no `!important`. Overrides are predictable.

### 5. Responsive included
All grids degrade gracefully at 1100px, 900px, and 640px breakpoints — defined once in the unified CSS.

---

## Production flow
```
Menu Item Create  →  Recipe Editor  →  Production Batch  →  Menu Engineering
     (create)           (upsert)          (post/reverse)         (analyze)
```

Each page links to the next via `ProductionWorkflowBar`.