# Hotel Nova Engineering Roadmap

This roadmap converts the product north-star into an execution plan for SSE and QAE work. It is intentionally practical: each workstream must produce code, tests or verification evidence, and a clear approval checkpoint before push or deployment.

## Operating Rules

- The Product Owner / Architect owns product priority, acceptance criteria, and deployment approval.
- SSE owns implementation, refactoring, local builds, and preparing deployable artifacts.
- QAE owns verification, regression checks, responsive testing, and release recommendation.
- No push, Docker Hub publish, or DigitalOcean deployment happens without Product Owner approval.
- Broad refactors are proposed as scoped work packages before implementation.

## Phase 1: Stabilize The Product Surface

### Shell, Navigation, And Mobile

Goal: make the application feel professional on desktop, tablet, iPhone, and Android.

SSE deliverables:

- Audit app shell, topbar, sidebar, breadcrumbs, page headers, and module layouts.
- Remove layout overlap and z-index defects.
- Standardize mobile breakpoints for operational screens.
- Document reusable shell patterns for future modules.

QAE gates:

- Hamburger menu opens and closes on iPhone-width screens.
- Sidebar overlays content correctly and traps no unusable UI behind it.
- Topbar actions do not overflow or overlap.
- Main workflows remain usable at phone, tablet, and desktop widths.

### Build And Deployment Baseline

Goal: make local Docker and production rollout predictable.

SSE deliverables:

- Keep `npm run build` passing.
- Keep local Docker image buildable and runnable.
- Document Docker Hub and DigitalOcean rollout steps.
- Resolve SSH key mismatch before production deployment is considered automated.

QAE gates:

- Local app returns a healthy response after Docker restart.
- Latest built assets are visible in the container.
- Production deployment is blocked when server access is not verifiable.

## Phase 2: Revenue And Profitability Core

### POS Workstation

Goal: make POS fast, touch-friendly, cashier-focused, and operationally complete.

SSE deliverables:

- Finalize responsive POS workstation layout.
- Remove hidden legacy POS markup after QAE confirms no behavior loss.
- Improve order summary, payment readiness, held order flows, and session context.
- Align POS UI with cashier and manager workflows.

QAE gates:

- Cashier can search, filter, add, adjust, hold, and submit orders.
- Cart remains usable on tablet and phone.
- No hidden legacy UI remains after cleanup.
- Error and empty states are understandable.

### Sales And COGS

Goal: turn Sales from register pages into a decision-ready control area.

SSE deliverables:

- Review sales dashboard, register, reports, and sale detail pages.
- Remove dead sales routes and components safely.
- Clarify COGS posting state and failed posting recovery.
- Improve filters and export-readiness.

QAE gates:

- Sales list, detail, dashboard, and reports are reachable from navigation.
- Deleted screens have no remaining imports or routes.
- COGS statuses display correctly.
- Mobile and tablet layouts do not degrade into squeezed desktop tables.

### Menu Engineering

Goal: deliver an ERP-grade menu engineering dashboard beyond the Boston Matrix.

SSE deliverables:

- Show quantity sold, revenue, food cost, food cost %, contribution margin, gross profit, gross profit %, popularity index, profitability index, Boston category, and AI recommendation.
- Keep frontend calculations defensive when the API lacks enriched fields.
- Coordinate with backend for persisted analytics when needed.
- Add clear category and recommendation explanations.

QAE gates:

- Metrics calculate consistently with sample data.
- Sort, search, and branch filters still work.
- Recommendations are present and action-oriented.
- Responsive table behavior is usable on smaller devices.

## Phase 3: Operational Control

### Inventory, GRN, SIV, Transfers, And Ledger

Goal: make stock movement auditable and manager-friendly.

SSE deliverables:

- Audit inventory workflows for duplicate components and route drift.
- Standardize error handling and API guards.
- Improve ledger readability and stock movement traceability.
- Add stronger warnings for missing stock locations or invalid branch scope.

QAE gates:

- Storekeeper workflows can be completed without unclear errors.
- Ledger records explain source document, location, quantity, and value.
- Permission and branch-scope defects are caught.

### Production And Recipe Costing

Goal: connect recipes, costing, production, and menu profitability.

SSE deliverables:

- Improve recipe readiness checks.
- Surface cost variance and target food-cost issues.
- Tie production batches to actual consumption and yield.

QAE gates:

- Recipe cost and menu engineering numbers reconcile where expected.
- Production variance is visible and understandable.
- Missing recipe data creates actionable warnings.

## Phase 4: Workforce And Approvals

### Overtime Approval With KPI Evidence

Goal: enforce approval when an employee works more than 8 consecutive hours.

SSE deliverables:

- Identify backend attendance/overtime model.
- Add overtime exception detection.
- Require manager approval with KPI or justification evidence.
- Provide audit trail and manager review views.

QAE gates:

- Over-8-hour consecutive work triggers approval.
- Normal shifts do not create false approvals.
- Manager cannot approve without required evidence.
- Audit trail records who approved, when, and why.

## Phase 5: Africa-Ready Differentiators

SSE deliverables:

- Mobile money-ready payment model.
- Branch owner dashboards.
- Low-connectivity retry and recovery patterns.
- Local language readiness plan.
- Supplier price trend and cost negotiation insights.

QAE gates:

- Mobile-first workflows are verified, not assumed.
- Cash-heavy and mixed-payment flows are tested.
- Retry and error handling does not lose operator work.

## First Recommended Work Packages

1. Establish build and QA baseline against the current dirty working tree.
2. Clean the POS hidden legacy toolbar after QAE confirms no regression.
3. Run route/import audit for removed sales screens.
4. QA the menu engineering dashboard with generated sample data and responsive checks.
5. Start backend analysis for overtime approval with KPI evidence.
