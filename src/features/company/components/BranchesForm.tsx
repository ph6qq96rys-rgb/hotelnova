import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import type { BranchVm, CreateBranchDto } from "../types";

type Props = {
  branches: BranchVm[];
  onAdd: (dto: CreateBranchDto) => Promise<void>;
};

const emptyDto = (isMain: boolean): CreateBranchDto => ({
  code: "",
  name: "",
  region: "",
  city: "",
  addressLine: "",
  isMain,
});

export default function BranchesForm({ branches, onAdd }: Props) {
  const isFirstBranch = useMemo(() => branches.length === 0, [branches.length]);

  const [dto, setDto] = useState<CreateBranchDto>(() => emptyDto(isFirstBranch));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep "isMain" sensible if branches are loaded async.
  // Rule: only auto-set isMain=true when there are zero branches; otherwise default to false.
  useEffect(() => {
    setDto((d) => {
      // If user has already typed anything, don't clobber their work—only adjust isMain default.
      const userHasTouched =
        d.code.trim() ||
        d.name.trim() ||
        (d.region ?? "").trim() ||
        (d.city ?? "").trim() ||
        (d.addressLine ?? "").trim();

      if (userHasTouched) {
        // Still prevent auto-main when branches exist unless the user explicitly checked it.
        if (!isFirstBranch && d.isMain) return d;
        return d;
      }

      // If untouched, reset defaults based on whether this is the first branch.
      return emptyDto(isFirstBranch);
    });
  }, [isFirstBranch]);

  const setField = (patch: Partial<CreateBranchDto>) =>
    setDto((d) => ({ ...d, ...patch }));

  async function add() {
    setError(null);

    const code = dto.code.trim();
    const name = dto.name.trim();
    if (!code || !name) return;

    setBusy(true);
    try {
      await onAdd({ ...dto, code, name });
      // After first add, subsequent branches should not default to main.
      setDto(emptyDto(false));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add branch.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        }}
      >
        <Field
          label="Branch Code"
          value={dto.code}
          onChange={(v) => setField({ code: v })}
          disabled={busy}
        />
        <Field
          label="Branch Name"
          value={dto.name}
          onChange={(v) => setField({ name: v })}
          disabled={busy}
        />
        <Field
          label="Region"
          value={dto.region ?? ""}
          onChange={(v) => setField({ region: v })}
          disabled={busy}
        />
        <Field
          label="City"
          value={dto.city ?? ""}
          onChange={(v) => setField({ city: v })}
          disabled={busy}
        />
        <Field
          label="Address"
          value={dto.addressLine ?? ""}
          onChange={(v) => setField({ addressLine: v })}
          full
          disabled={busy}
        />

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={dto.isMain}
            disabled={busy || (!isFirstBranch && dto.isMain === false ? false : false)}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setField({ isMain: e.target.checked })
            }
          />
          <span style={{ fontSize: 13 }}>Mark as Main</span>
          {isFirstBranch ? (
            <span style={{ fontSize: 12, color: "#666" }}>(first branch defaults to main)</span>
          ) : null}
        </label>
      </div>

      {error ? (
        <div style={{ padding: 10, borderRadius: 10, border: "1px solid #f3c2c2", background: "#fff6f6" }}>
          <div style={{ fontSize: 13, color: "#8a1f1f" }}>{error}</div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={add}
        disabled={busy}
        style={{
          padding: 10,
          borderRadius: 10,
          border: "1px solid #ddd",
          cursor: busy ? "not-allowed" : "pointer",
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? "Adding..." : "+ Add Branch"}
      </button>

      <div style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden" }}>
        <TableHead cols={["Code", "Name", "City", "Main", "Active"]} />
        {branches.map((b) => (
          <TableRow
            key={b.id}
            cols={[
              b.code,
              b.name,
              b.city ?? "",
              b.isMain ? "Yes" : "No",
              b.isActive ? "Yes" : "No",
            ]}
          />
        ))}
        {branches.length === 0 ? (
          <div style={{ padding: 12, color: "#666" }}>No branches yet.</div>
        ) : null}
      </div>
    </div>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  full?: boolean;
  disabled?: boolean;
};

function Field({ label, value, onChange, full, disabled }: FieldProps) {
  return (
    <label style={{ display: "grid", gap: 6, gridColumn: full ? "1 / -1" : undefined }}>
      <div style={{ fontSize: 12, color: "#555" }}>{label}</div>
      <input
        value={value}
        disabled={disabled}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        style={{
          padding: 10,
          borderRadius: 10,
          border: "1px solid #ddd",
          opacity: disabled ? 0.7 : 1,
        }}
      />
    </label>
  );
}

function TableHead({ cols }: { cols: string[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols.length}, 1fr)`,
        background: "#fafafa",
        padding: 10,
        fontSize: 12,
        color: "#444",
        borderBottom: "1px solid #eee",
      }}
    >
      {cols.map((c) => (
        <div key={c}>
          <b>{c}</b>
        </div>
      ))}
    </div>
  );
}

function TableRow({ cols }: { cols: (string | number)[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols.length}, 1fr)`,
        padding: 10,
        borderBottom: "1px solid #f3f3f3",
      }}
    >
      {cols.map((c, i) => (
        <div key={i}>{c}</div>
      ))}
    </div>
  );
}
