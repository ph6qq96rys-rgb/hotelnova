import type { OnboardingStatus } from "../types";

export default function ReviewStep({ status }: { status: OnboardingStatus | null }) {
  if (!status) return <div className="text-sm opacity-70">Load status to review…</div>;

  const ok = status.canUseInventory && status.canUseProduction && status.canUseSales;

  return (
    <div>
      <h2 className="text-xl font-semibold">Step 3 — Review</h2>
      <p className="text-sm text-muted-foreground mt-1">
        Confirm your Branch is operational.
      </p>

      <div className={"mt-4 p-4 rounded-2xl border " + (ok ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200")}>
        <div className={"font-medium " + (ok ? "text-green-900" : "text-amber-900")}>
          {ok ? "Setup Complete" : "Setup Incomplete"}
        </div>
        <div className={"text-sm mt-2 " + (ok ? "text-green-900" : "text-amber-900")}>
          {ok
            ? "Inventory, Production, and Sales modules can be used."
            : "Complete the missing items in earlier steps."}
        </div>

        {!ok && status.blockingReasons?.length > 0 && (
          <ul className="text-sm mt-3 space-y-1">
            {status.blockingReasons.map((r, i) => (
              <li key={i}>- {r}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
