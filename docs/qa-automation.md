# Hotel Nova QA Automation

QAE automation uses Playwright for browser-level smoke and regression tests.

## Commands

Build before browser smoke tests:

```powershell
npm.cmd run build
```

Run the automated QAE suite:

```powershell
npm.cmd run test:e2e
```

Open the Playwright UI runner:

```powershell
npm.cmd run test:e2e:ui
```

## Current Coverage

- Auth smoke: login page rendering, required-field behavior, password visibility toggle.
- Auth guard smoke: unauthenticated company route redirects to login.
- Responsive shell smoke: hamburger opens the sidebar on mobile-size projects.
- Menu Engineering smoke: dashboard renders ERP metrics and AI recommendation with mocked data.
- POS smoke: cashier can load the workstation, add a menu item, and reach payment with mocked session, store, and catalog data.
- Sales register smoke: sales list loads mocked rows, KPIs, status badges, and search filtering.

## Principles

- QAE tests should be deterministic and avoid real production credentials.
- Backend-dependent screens should use API mocks first, then add integration tests once test data is stable.
- Every major bug fixed by SSE should get a regression test when practical.
- Automation complements manual exploratory QA; it does not replace visual judgment for complex ERP workflows.
