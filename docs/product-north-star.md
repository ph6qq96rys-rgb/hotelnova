# Hotel Nova / RestaurantFNB Product North Star

## Vision

Hotel Nova / RestaurantFNB will become a leading hospitality ERP for Ethiopia and the wider African market. The product should help restaurants, hotels, cafes, catering groups, commissaries, and multi-branch operators run profitable, controlled, and auditable operations from POS to inventory, production, HR, and management reporting.

The product must feel modern, trustworthy, and locally practical. It should not simply copy generic global ERP patterns. It must understand the realities of African hospitality operations: mobile-first users, cash-heavy payment flows, mobile money, unreliable connectivity, supplier price volatility, branch-level controls, staff approval workflows, and owner/operator decision-making.

## Target Customers

- Independent restaurants and cafes that need professional controls without enterprise complexity.
- Hotels with restaurant, room service, banquet, store, and kitchen operations.
- Multi-branch restaurant groups and franchises.
- Catering and commissary businesses that produce centrally and sell through multiple outlets.
- Owner-managed businesses where the decision-maker needs clear dashboards, not accounting jargon.
- Growing operators preparing for stronger finance, audit, tax, and investor reporting discipline.

## Product Promise

The system should answer three questions better than competitors:

1. Are we selling profitably?
2. Are inventory, recipes, procurement, and sales financially controlled?
3. Can managers act quickly from reliable operational intelligence?

Every module should support at least one of these promises.

## Core Modules

### Sales and POS

- Fast restaurant POS for dine-in, takeaway, delivery, and room service.
- Cashier sessions, opening float, closing float, X/Z reports, and supervisor review.
- Cash, card, mobile money, transfer, and split-payment readiness.
- Held orders, table/room context, guest count, service notes, and receipt-ready sale posting.
- Sales register, sale detail, cancellation controls, and COGS posting state.

### Menu Engineering and Production

- Menu items, categories, selling prices, recipes, and recipe readiness.
- Recipe costing and target food cost checks.
- ERP-grade menu engineering that goes beyond the Boston Matrix.
- Star, Plow Horse, Puzzle, and Dog classification enriched with revenue, food cost, contribution margin, gross profit, popularity, profitability, and AI recommendations.
- Production batches, planned vs actual yield, and consumption control.

### Inventory and Stores

- Stock items, UOMs, categories, locations, and branch/store scope.
- GRN, SIV, stock transfers, adjustments, and inventory ledger.
- POS consumption and COGS posting.
- Stock availability warnings and audit trail.
- Support for price volatility and frequent supplier cost changes.

### Procurement and Supplier Control

- Supplier master data.
- Purchase requests/orders, receiving, and invoice readiness.
- Supplier price trend visibility.
- Cost negotiation alerts for high-impact ingredients.

### HR and Workforce

- Employees, roles, assignments, attendance, and shift control.
- Overtime workflow: if an employee works more than 8 consecutive hours, manager approval is required.
- Overtime approval should require attached KPI or justification evidence.
- Manager review, audit trail, and exception reporting.

### Finance and Executive Reporting

- Revenue, COGS, gross profit, food cost %, and margin dashboards.
- Daily close support and pending posting visibility.
- Branch, company, and tenant-level reporting.
- Exportable reports and audit-friendly transaction history.

### Administration and Security

- Multi-tenant, company, branch, and store structure.
- Role and permission-based access.
- System admin and company admin modes.
- Clear auditability for sensitive actions such as cancellations, COGS posting, overtime approval, and stock adjustments.

## Ethiopia and Africa Market Fit

The product must be designed for:

- Mobile-first access for managers and owners.
- Tablet-friendly POS and store workflows.
- Cash and mobile money operations.
- Intermittent connectivity and realistic retry/error states.
- Multi-branch businesses with centralized ownership.
- High ingredient cost volatility.
- Staff processes that require simple, enforceable approvals.
- Local language readiness in the future.
- Reports that help owners make decisions quickly.

## Industry-Leading Differentiators

- Operational intelligence, not just transaction entry.
- Menu engineering tied to actual cost and sales behavior.
- Recipe and food-cost discipline built into daily workflows.
- Manager approval workflows with evidence, KPIs, and audit trail.
- Mobile and tablet UX that feels first-class, not squeezed desktop.
- Practical AI recommendations that explain what action to take and why.
- Strong role separation for cashier, storekeeper, chef/production, manager, accountant, and owner.
- Production-quality error handling, empty states, and recovery flows.

## Product Quality Bar

Every feature should meet these standards:

- It solves a real operator problem.
- It respects company, branch, store, and tenant scope.
- It works on desktop, tablet, and phone where the workflow needs it.
- It has clear loading, empty, success, and error states.
- It avoids hidden destructive actions.
- It is auditable when money, stock, labor, or permissions are affected.
- It has a clear QA checklist before release.
- It builds successfully and deploys through the agreed Docker process.

## UX Principles

- ERP screens should be dense but calm, built for repeated operational use.
- POS screens should be fast, touch-friendly, and cashier-focused.
- Dashboards should prioritize decisions and exceptions.
- Mobile views must feel intentional, not like collapsed desktop pages.
- Avoid decorative UI that does not help the operator act.
- Use familiar controls: icons for actions, tabs/segments for modes, filters for reports, tables for registers, and cards only for repeated items or framed tools.

## SSE and QAE Working Model

### Product Owner / Architect

The product owner defines goals, acceptance criteria, and architectural direction. The product owner may also act as architect or developer when needed.

### Senior Software Engineer

The SSE implements features:

- Understand the product intent and existing architecture.
- Choose a scoped implementation approach.
- Make code changes.
- Preserve existing patterns and avoid unrelated refactors.
- Run builds and relevant checks.
- Publish locally or prepare deployment artifacts when requested.

### Quality Assurance Engineer

The QAE validates features independently:

- Review acceptance criteria.
- Test happy paths, edge cases, permissions, responsiveness, error states, and regressions.
- Report findings clearly.
- Do not silently change implementation while acting as QAE.
- Approve only when the feature meets the agreed quality bar.

### Separation Rule

Work should be labeled by role:

- `SSE:` for implementation.
- `QAE:` for verification and defect reporting.

If QAE finds a defect, the role switches back to SSE for the fix. After the fix, QAE retests.

## Current Strategic Priorities

1. Stabilize responsive shell, navigation, and mobile usability.
2. Make POS workflow professional and tablet/mobile friendly.
3. Make Sales and COGS reporting reliable and decision-focused.
4. Upgrade Menu Engineering into an industry-leading profitability dashboard.
5. Strengthen inventory, recipe costing, and production control.
6. Implement enforceable HR overtime approval with KPI evidence.
7. Improve deployment discipline and production access reliability.

## Deployment Principle

Local Docker must be verified before production deployment. Production deployment currently uses Docker Hub image:

`touchabesha/restaurantfnb-web:latest`

DigitalOcean rollout requires working SSH access to the droplet. If local SSH credentials do not match the registered DigitalOcean key, the image can still be pushed, but the server-side recreate step must be completed from a machine with the correct key.

