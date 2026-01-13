import { useState } from "react";
import { AssignRoleWizard } from "./AssignRoleWizard";

type Props = {
  userId: string;
  onAssigned?: () => void; // call this to refresh user detail
  label?: string;
};

export function AssignRoleButton({ userId, onAssigned, label = "Assign role" }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 active:bg-slate-900 disabled:opacity-50"
      >
        <span className="text-base leading-none">+</span>
        {label}
      </button>

      {open && (
        <AssignRoleWizard
          userId={userId}
          onClose={() => setOpen(false)}
          onAssigned={onAssigned}
        />
      )}
    </>
  );
}
