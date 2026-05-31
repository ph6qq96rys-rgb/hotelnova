// src/modules/company/pages/Createbranchuserform.tsx
// Logic unchanged. JSX rebuilt to match prototype design system.

import type { CreateBranchUserFormValue, BranchRole } from "../types/company.types";
import { Field, Input, SelectInput } from "./components/company.ui";

interface Props {
  value:    CreateBranchUserFormValue;
  onChange: (v: CreateBranchUserFormValue) => void;
  onSubmit: () => void;
  busy?:    boolean;
  error?:   string | null;
}

const ROLE_OPTIONS: { value: BranchRole; label: string }[] = [
  { value: "BranchAdmin", label: "Branch Admin" },
  { value: "Staff",       label: "Staff"        },
];

export default function CreateBranchUserForm({ value, onChange, onSubmit, busy, error }: Props) {
  const set = <K extends keyof CreateBranchUserFormValue>(k: K, v: CreateBranchUserFormValue[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div className="ob-inner-card">

      {/* Header */}
      <div className="ob-inner-card-header">
        <div className="ob-inner-card-title">Create branch user</div>
        <div className="ob-inner-card-sub">Create a user and assign them to this branch.</div>
      </div>

      {/* Body */}
      <div className="ob-inner-card-body">
        {error && (
          <div style={{
            padding: "10px 14px", borderRadius: 10,
            background: "var(--ob-red-bg)", border: "1px solid var(--ob-red-border)",
            color: "var(--ob-red-text)", fontSize: 12, marginBottom: 14,
          }}>
            {error}
          </div>
        )}

        <div className="ob-grid-2">
          <Field label="First name">
            <Input value={value.firstName} onChange={(v) => set("firstName", v)} placeholder="e.g. Hana"        disabled={busy} />
          </Field>
          <Field label="Last name">
            <Input value={value.lastName}  onChange={(v) => set("lastName",  v)} placeholder="e.g. Tesfaye"     disabled={busy} />
          </Field>
          <Field label="Username" required>
            <Input value={value.userName}  onChange={(v) => set("userName",  v)} placeholder="e.g. hana.t"      disabled={busy} />
          </Field>
          <Field label="Email" required>
            <Input value={value.email}     onChange={(v) => set("email",     v)} placeholder="hana@company.com" type="email" disabled={busy} />
          </Field>
          <Field label="Password" required>
            <Input value={value.password}  onChange={(v) => set("password",  v)} type="password" placeholder="Minimum 6 characters" disabled={busy} />
          </Field>
          <Field label="Role">
            <SelectInput
              value={value.role}
              onChange={(v) => set("role", v as BranchRole)}
              options={ROLE_OPTIONS}
              disabled={busy}
            />
          </Field>
        </div>
      </div>

      {/* Footer */}
      <div className="ob-inner-card-footer">
        <button
          type="button"
          onClick={onSubmit}
          disabled={busy}
          className="ob-btn ob-btn--primary"
        >
          {busy ? "Creating…" : "Create user"}
        </button>
      </div>

    </div>
  );
}