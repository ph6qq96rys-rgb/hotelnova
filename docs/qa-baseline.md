# Hotel Nova QA Baseline

This baseline defines how QAE validates work before the Product Owner approves a push or deployment.

## Release Gate

A change is not release-ready until:

- `npm run build` passes.
- `npm run test:e2e` passes for changed critical workflows, or any skipped automation is justified in the QAE report.
- The changed routes load without runtime errors.
- Desktop, tablet, and phone layouts are checked for affected workflows.
- Empty, loading, error, and success states are reviewed where relevant.
- Role, company, branch, and tenant scope are respected.
- No push or deployment is performed before Product Owner approval.

## Standard Viewports

- Desktop: 1440 x 900
- Tablet: 1024 x 768
- iPhone-size: 390 x 844
- Small Android-size: 360 x 800

## Critical Smoke Paths

### Authentication

- Login page renders professionally on mobile and desktop.
- Password visibility toggle works.
- Failed login shows a clear error.
- Authenticated users land in the correct company workspace.

### Shell And Navigation

- Hamburger button is tappable on phone widths.
- Sidebar appears above page content.
- Backdrop closes the sidebar.
- Active navigation item is clear.
- Topbar actions do not overlap page content.

### POS

- POS route loads from navigation.
- Menu items can be searched and selected.
- Cart quantity changes are usable with touch.
- Order type, table or service context, and payment area are visible.
- Sticky cart behavior does not hide controls on phone.

### Sales

- Sales dashboard loads.
- Sales register filters are usable.
- Sale detail is reachable from the register.
- Reports page renders key metrics and tables without overflow.

### Menu Engineering

- Page loads with branch filter.
- Recalculate action gives clear feedback.
- Summary cards show quantity sold, revenue, food cost, and gross profit.
- Boston categories are visible.
- Recommendation text is present.
- Table remains readable or scrollable on small screens.

### Inventory And Stores

- GRN, SIV, transfers, adjustments, and ledger pages are reachable.
- Store and location selection errors are understandable.
- Tables do not break mobile layouts.

### HR

- Employee detail and attendance views load.
- Overtime approval workflow is tested once implemented.
- Manager approval requires KPI or justification evidence once implemented.

## Current Known Risks

- The frontend working tree contains many modified files and several deleted legacy sales screens.
- A hidden legacy POS toolbar remains in `PosSalesPage.tsx` and should be removed in a scoped cleanup.
- DigitalOcean deployment is blocked until SSH access to the droplet is fixed.
- Some legacy auth paths remain during the split-auth migration.
- At least one `console.log` exists in the Telegram mini app API and should be removed or gated.

## QAE Evidence Format

For each completed work package, QAE reports:

- Build result.
- Automation result.
- Routes tested.
- Viewports tested.
- Findings by severity.
- Remaining risks.
- Release recommendation: approved, approved with risk, or blocked.
