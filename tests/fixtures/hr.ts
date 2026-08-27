import type { Page } from "@playwright/test";

export async function mockAttendanceReport(page: Page): Promise<void> {
  await page.route("**/companies/*/hr/attendance/report**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        totalEmployees: 4,
        presentToday: 3,
        absentToday: 1,
        onLeave: 0,
        averageAttendancePercent: 75,
        records: [
          {
            employeeId: "emp-ot-1",
            employeeName: "Mekdes Abebe",
            date: "2026-08-01",
            clockIn: "2026-08-01T08:00:00Z",
            clockOut: "2026-08-01T18:30:00Z",
            workedHours: 10.5,
            overtimeHours: 2.5,
            overtimeStatus: "Pending",
            overtimeCategory: "Catering",
            overtimeBusinessJustification: "Banquet prep overrun",
            overtimeRelatedTask: "Catering order",
            overtimeProject: "Wedding event",
            overtimeCostCenter: "Kitchen",
            overtimeExpectedOutput: "Finish 120 plated desserts",
            overtimeActualOutput: "Pending employee summary",
            overtimeEffectiveness: "Necessary",
            overtimeLaborCost: 625,
            managerApproved: false,
            hrApproved: false,
            lateMinutes: 0,
            status: "Present",
            geofenceVerified: true,
          },
          {
            employeeId: "emp-missing-1",
            employeeName: "Samuel Tadesse",
            date: "2026-08-01",
            clockIn: "2026-08-01T09:10:00Z",
            workedHours: 0,
            lateMinutes: 10,
            status: "MissingPunch",
            geofenceVerified: false,
          },
        ],
      }),
    });
  });
}
