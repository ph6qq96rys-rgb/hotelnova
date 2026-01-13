type CreateBranchUserFormProps = {
  value: {
    userName: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: "BranchAdmin" | "Staff";
  };
  busy?: boolean;
  onChange: (v: CreateBranchUserFormProps["value"]) => void;
  onSubmit: () => void;
};

export default function CreateBranchUserForm({
  value,
  onChange,
  onSubmit,
  busy,
}: CreateBranchUserFormProps) {
  const set = <K extends keyof typeof value>(k: K, v: (typeof value)[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-b from-white to-slate-50">
        <div className="text-sm font-semibold text-slate-900">
          Create Branch User
        </div>
        <div className="text-xs text-slate-500 mt-1">
          Create a user and assign them to this branch.
        </div>
      </div>

      {/* Body */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="First name"
            value={value.firstName}
            onChange={(v) => set("firstName", v)}
            placeholder="e.g. Hana"
          />

          <Field
            label="Last name"
            value={value.lastName}
            onChange={(v) => set("lastName", v)}
            placeholder="e.g. Tesfaye"
          />

          <Field
            label="Username"
            value={value.userName}
            onChange={(v) => set("userName", v)}
            placeholder="e.g. hana.t"
            required
          />

          <Field
            label="Email"
            value={value.email}
            onChange={(v) => set("email", v)}
            placeholder="e.g. hana@company.com"
            required
            type="email"
          />

          <PasswordField
            label="Password"
            value={value.password}
            onChange={(v) => set("password", v)}
            required
          />

          <Select
            label="Branch Role"
            value={value.role}
            onChange={(v) => set("role", v as any)}
            options={[
              { value: "BranchAdmin", label: "Branch Admin" },
              { value: "Staff", label: "Staff" },
            ]}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
        <button
          className="btn-lux-primary"
          onClick={onSubmit}
          disabled={busy}
        >
          {busy ? "Creating…" : "Create User"}
        </button>
      </div>

      {/* Local styles */}
      <style>{`
        .btn-lux-primary{
          border: 1px solid rgb(15 23 42);
          background: rgb(15 23 42);
          padding: 10px 18px;
          border-radius: 14px;
          font-weight: 800;
          font-size: 14px;
          color: white;
          box-shadow: 0 8px 24px rgba(15,23,42,0.18);
        }
        .btn-lux-primary:disabled{
          opacity:.6;
          cursor:not-allowed;
          box-shadow:none;
        }
        .lux-input{
          width:100%;
          padding:10px 12px;
          border-radius:14px;
          border:1px solid rgb(226 232 240);
          font-size:14px;
          color:rgb(15 23 42);
          background:white;
        }
        .lux-input:focus{
          outline:none;
          border-color:rgb(203 213 225);
          box-shadow:0 0 0 3px rgba(15,23,42,.08);
        }
        .lux-label{
          font-size:12px;
          font-weight:700;
          color:rgb(71 85 105);
        }
      `}</style>
    </div>
  );
}

/* ===================== Fields ===================== */

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="grid gap-2">
      <div className="lux-label">
        {props.label}
        {props.required && <span className="text-rose-600"> *</span>}
      </div>
      <input
        className="lux-input"
        value={props.value}
        type={props.type ?? "text"}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </label>
  );
}

function PasswordField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2">
      <div className="lux-label">
        {props.label}
        {props.required && <span className="text-rose-600"> *</span>}
      </div>
      <input
        type="password"
        className="lux-input"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder="Minimum 6 characters"
      />
    </label>
  );
}

function Select(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="grid gap-2">
      <div className="lux-label">{props.label}</div>
      <select
        className="lux-input"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
