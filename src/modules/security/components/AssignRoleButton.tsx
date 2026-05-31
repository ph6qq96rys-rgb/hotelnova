// src/modules/security/components/AssignRoleButton.tsx

import { useState } from "react";
import { AssignRoleWizard } from "./AssignRoleWizard";

interface Props {
  userId:      string;
  onAssigned?: () => void;
  label?:      string;
}

export function AssignRoleButton({ userId, onAssigned, label = "Assign role" }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="sec-btn sec-btn--primary"
        onClick={() => setOpen(true)}
      >
        + {label}
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