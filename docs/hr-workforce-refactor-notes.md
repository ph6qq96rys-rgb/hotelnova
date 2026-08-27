# HR Workforce Management Refactor Notes

Source document: `C:\Users\touch\Downloads\HR_Workforce_Management_Refactoring_Epic.docx`

## Product Direction

The HR module is being refactored into an enterprise-grade Workforce Management platform. Attendance becomes the payroll source of truth, overtime must be manager/HR approved with measurable KPI output, and HR dashboards must expose operational risk in real time.

## First SSE Slice

Implemented the first local frontend slice in Attendance:

- Renamed the page experience to Attendance Command Center.
- Added payroll readiness status based on unresolved exceptions.
- Added overtime approval queue visibility.
- Flagged work above 8 hours as requiring approval unless already approved or processed.
- Added KPI/output visibility for overtime records.
- Added missing punch and geofence failure visibility.
- Kept all new backend fields optional so current API responses continue to work.

## QAE Coverage

Added Playwright coverage for the HR attendance workflow across desktop, tablet, iPhone-size, and Android-size viewports.

Current verification:

- `npm.cmd run build`: passed.
- `npm.cmd run test:e2e`: 38 passed, 2 intentionally skipped.

## Overtime Governance Slice

Implemented a dedicated Overtime Governance workflow:

- Added `hr/overtime` as a first-class HR route.
- Added overtime metrics for records, hours, manager queue, HR readiness, and labor cost.
- Added governance rules for work above 8 hours, KPI attachment, manager approval, HR validation, and payroll readiness.
- Added row-level visibility for category, business reason, expected output, actual output, approvals, effectiveness, and cost center.
- Kept the workflow compatible with current attendance report data while supporting richer optional overtime fields.
- Updated Attendance Command Center so expected and actual overtime output are both visible.

QAE added Playwright coverage for overtime governance across desktop, tablet, iPhone-size, and Android-size viewports.

## Next SSE Slice

Continue with Smart Clock-In Verification:

- QR expiration and duplicate scan prevention visibility.
- GPS/geofence/branch validation states.
- Device/IP/WiFi evidence model.
- Offline synchronization state.
- Attendance exception workflow for missing punches and manual corrections.
