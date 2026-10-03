# Application design system

This is the implementation contract for all new UI and progressively migrated screens. It uses the existing application design language; it does not assert that every legacy page has completed migration.

## Sources of truth

- `src/styles/global.css`: canonical content/shell colors, semantic colors, radii and shadows.
- `src/styles/design-system.css`: spacing, font stacks, responsive controls, focus, page header, feedback, table and dialog primitives.
- `src/styles/erp-tokens.css`: compatibility names referencing canonical colors; do not introduce a second palette here.
- `src/components/ui`: Button, Input, Textarea, Card, Table, FormField, StateMessage, EmptyState and shared dialog focus behavior.
- `src/components/PageHeader.tsx` and `src/components/ConfirmModal.tsx`: standard page actions and confirmation layout.
- Lucide is the common icon library. Icons supplement text; icon-only actions require an accessible name.

## Layout and interaction contract

Use the existing AppShell, breadcrumbs and main sidebar. Do not add a module sidebar without a reviewed shared pattern. PageHeader places title/description at the start and actions at the end; actions wrap on smaller screens. Filters precede results and pagination follows them. Primary actions use the primary button; destructive actions use destructive styling, never a primary-colored Delete button. Use Save, Cancel, Edit, Duplicate, Archive, Approve and Reject consistently. Name destructive confirmations after the operation and include the affected record.

Use spacing tokens for component spacing and semantic tokens for colors. Component-specific grid layouts and data visualizations may define structure, but not a separate visual language. Do not use whole-page CSS overrides to conceal inconsistencies. Keep special-purpose POS, kiosk and Telegram layouts; migrate their visual primitives without disrupting their interaction needs.

Use StateMessage for loading, success, information, warnings and errors, and EmptyState for no-results states with a meaningful next action. Inputs must have labels. FormField connects help/error messages with aria-describedby and sets aria-invalid. Never communicate status through color alone. Busy submissions prevent duplicate actions; failed submissions preserve entered data. Dialogs have an accessible name, contain keyboard focus, support Escape when not busy and return focus to the opener. ConfirmModal is the default confirmation surface. Explicitly review unsaved-change guards rather than replacing them indiscriminately.

## English and Amharic

Both languages are LTR. The existing I18nProvider owns html lang/dir. Shared styles include Ethiopic font fallbacks, relaxed Amharic line height and no letter-spacing for Amharic labels. All new visible strings must use the existing translations/phrase infrastructure; components receive translated labels instead of assembling sentences from fragments. Check real Amharic text, not only English at a different language setting. Avoid fixed-height labels, clipped text and assumptions about English text width. Font fallback support is not a substitute for translation completeness.

## Accessibility and responsive review

Target WCAG AA: normal text contrast >=4.5:1; large text and essential non-text indicators >=3:1. Test keyboard access, visible focus, named controls, announced errors, reduced motion and 200% zoom. Verify 390px, 768px and 1440px layouts. Horizontal scrolling is allowed inside wide data tables, not on the overall page. Mobile controls have a 44px target in the shared library. Use tokens for contrast; test final rendered combinations because a token alone does not guarantee contrast.

## Progressive migration and enforcement

`design-system-baseline.json` inventories existing style/control exceptions by file. `npm run check:design-system` fails when a file introduces more raw colors, fonts, root themes, native confirmations or native controls outside the shared library. It is part of the build. The baseline is technical debt, not approved design precedent. It should shrink as pages migrate. Snapshot regeneration is allowed only with a reviewed design change and a reason recorded in the PR. It is not a substitute for visual review and cannot check all layout or accessibility behavior automatically.

Migration sequence:

1. Shared components and page chrome: remove debug content, establish working component styles, shared feedback, keyboard-safe confirmations (this change).
2. Catering/butchery: map brand tokens to the application palette, migrate sales error/empty states and modal focus; migrate remaining legacy buttons, forms, tables, colors and confirmations next. The specialized builder layout remains.
3. HR and attendance: consolidate form/table/status styles and modal behavior; preserve kiosk touch interaction.
4. Inventory/procurement: consolidate duplicated GRN/SIV styles, approvals and validation.
5. Production, reports, security and onboarding: migrate their independent tokens and tables.
6. POS and Telegram: align tokens/feedback while keeping their dedicated shell and device behavior.

See the generated baseline for the exact remaining files and exceptions. No claim of full application-wide conformity should be made until each batch has been reviewed in both languages and all supported viewport sizes.

## Definition of Done — every UI feature

- [ ] Uses shared primitives and tokens; any new pattern has an explicit design review and shared implementation.
- [ ] Header, breadcrumbs, actions, filter positions and vocabulary match this contract.
- [ ] Loading, empty, success, warning, error and validation states are exercised.
- [ ] Permissions alter capabilities, not styling; denied and read-only paths are checked.
- [ ] Dialog focus, Escape, focus return and duplicate submission behavior are verified.
- [ ] English and Amharic translations and overflow are reviewed.
- [ ] Desktop, tablet, mobile, keyboard, contrast and zoom checks are recorded.
- [ ] Build, design-system check and relevant behavior tests pass.
- [ ] Before/after screenshots and remaining exceptions appear in the PR/review notes.
