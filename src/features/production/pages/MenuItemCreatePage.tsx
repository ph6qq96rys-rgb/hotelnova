import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppScope } from "../../../app/useAppScope";
import { menuItemsApi } from "../api/menuItemsApi";
import { stockLocationsApi } from "../../inventory/stock-locations/api/stockLocationsApi";

export type CreateMenuItemRequest = {
  name: string;
  code: string | null;
  categoryId: string | null;
  outputUomId: string | null;
  isActive: boolean;
};

type MenuCategoryDto = {
  id: string;
  name: string;
  code?: string | null;
  isActive?: boolean;
};

type ApiListResult<T> = T[] | { items?: T[] };

export default function MenuItemCreatePage() {
  const nav = useNavigate();
  const { companyId, branchId } = useAppScope();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [cats, setCats] = useState<MenuCategoryDto[]>([]);
  const [catsLoading, setCatsLoading] = useState(false);
  const [catsErr, setCatsErr] = useState<string | null>(null);

  const trimmedName = useMemo(() => name.trim(), [name]);
  const trimmedCode = useMemo(() => code.trim(), [code]);

  const canSave = Boolean(companyId && branchId && trimmedName && !saving);

  useEffect(() => {
    if (!companyId || !branchId) return;

    let cancelled = false;

    async function loadCategories() {
      setCatsLoading(true);
      setCatsErr(null);

      try {
        const res = await menuItemsApi.listCategories(companyId!, branchId!);

        const rows = normalizeList<MenuCategoryDto>(res)
          .filter((x) => x.isActive !== false)
          .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));

        if (!cancelled) setCats(rows);
      } catch (e) {
        if (!cancelled) {
          setCats([]);
          setCatsErr(getApiError(e));
        }
      } finally {
        if (!cancelled) setCatsLoading(false);
      }
    }

    loadCategories();

    return () => {
      cancelled = true;
    };
  }, [companyId, branchId]);

  async function onSave() {
    if (!companyId) return setErr("Select a company first.");
    if (!branchId) return setErr("Select a branch first.");
    if (!trimmedName) return setErr("Menu item name is required.");

    const payload: CreateMenuItemRequest = {
      name: trimmedName,
      code: trimmedCode || null,
      categoryId: categoryId || null,
      outputUomId: null,
      isActive,
    };

    setSaving(true);
    setErr(null);

    try {
      const res = await menuItemsApi.create(companyId, branchId, payload);

      if (!res?.id) {
        throw new Error("Menu item was created, but the API did not return an ID.");
      }

      nav(`/companies/${companyId}/menu/items/${res.id}?tab=recipe`);
    } catch (e) {
      setErr(getApiError(e));
    } finally {
      setSaving(false);
    }
  }

  if (!companyId) return <div style={{ padding: 16 }}>Select a company first.</div>;
  if (!branchId) return <div style={{ padding: 16 }}>Select a branch first.</div>;

  return (
    <div style={{ padding: 16, maxWidth: 980 }}>
      <div style={headerStyle}>
        <div>
          <h2 style={{ margin: 0 }}>New Menu Item</h2>
          <div style={subtitleStyle}>
            Create the sales menu item first, then add recipe ingredients.
          </div>
        </div>

        <button type="button" onClick={() => nav(-1)} disabled={saving} style={secondaryButtonStyle}>
          Cancel
        </button>
      </div>

      <div style={cardStyle}>
        <div style={{ padding: 16 }}>
          {err && <ErrorBox message={err} />}

          <div style={gridStyle}>
            <Field label="Name" required>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (err) setErr(null);
                }}
                placeholder="e.g., Chicken Shawarma Wrap"
                disabled={saving}
                style={inputStyle}
              />
            </Field>

            <Field label="Code / SKU">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Optional"
                disabled={saving}
                style={inputStyle}
              />
            </Field>

            <Field label="Category">
              <select
                value={categoryId ?? ""}
                onChange={(e) => setCategoryId(e.target.value || null)}
                disabled={saving || catsLoading}
                style={{ ...inputStyle, background: "white" }}
              >
                <option value="">
                  {catsLoading ? "Loading categories…" : "— No category —"}
                </option>

                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code ? `${c.name} (${c.code})` : c.name}
                  </option>
                ))}
              </select>

              {catsErr && (
                <div style={{ marginTop: 6, color: "crimson", fontSize: 12 }}>
                  {catsErr}
                </div>
              )}
            </Field>

            <Field label="Output UoM">
              <input value="" placeholder="Optional — set later" disabled style={disabledInputStyle} />
            </Field>
          </div>

          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={saving}
            />
            <span>Active</span>
          </label>
        </div>

        <div style={footerStyle}>
          <button type="button" onClick={() => nav(-1)} disabled={saving} style={secondaryButtonStyle}>
            Cancel
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={!canSave}
            style={{
              ...primaryButtonStyle,
              background: canSave ? "black" : "#999",
              cursor: canSave ? "pointer" : "not-allowed",
            }}
          >
            {saving ? "Saving…" : "Create & Add Recipe"}
          </button>
        </div>
      </div>
    </div>
  );
}

function normalizeList<T>(res: ApiListResult<T>): T[] {
  if (Array.isArray(res)) return res;
  return res.items ?? [];
}

function getApiError(err: unknown): string {
  const e = err as any;
  const data = e?.response?.data;

  if (!data) return e?.message ?? "Request failed.";
  if (typeof data === "string") return data;
  if (typeof data?.message === "string") return data.message;
  if (typeof data?.title === "string") return data.title;

  const errors = data?.errors;
  if (errors && typeof errors === "object") {
    const firstKey = Object.keys(errors)[0];
    const firstVal = firstKey ? errors[firstKey] : null;

    if (Array.isArray(firstVal) && firstVal[0]) return String(firstVal[0]);
  }

  return "Request failed.";
}

function Field(props: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>
        {props.label} {props.required && <span style={{ color: "crimson" }}>*</span>}
      </div>
      {props.children}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div
      style={{
        marginBottom: 12,
        padding: 10,
        borderRadius: 10,
        background: "#fff1f1",
        color: "crimson",
        border: "1px solid #ffd3d3",
      }}
    >
      {message}
    </div>
  );
}

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 14,
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 13,
  opacity: 0.7,
  marginTop: 4,
};

const cardStyle: React.CSSProperties = {
  border: "1px solid #eee",
  borderRadius: 14,
  overflow: "hidden",
  background: "white",
  boxShadow: "0 8px 24px rgba(0,0,0,0.04)",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 14,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "1px solid #e5e5e5",
  outline: "none",
};

const disabledInputStyle: React.CSSProperties = {
  ...inputStyle,
  background: "#fafafa",
  color: "#777",
};

const checkboxLabelStyle: React.CSSProperties = {
  marginTop: 14,
  display: "flex",
  alignItems: "center",
  gap: 8,
  cursor: "pointer",
};

const footerStyle: React.CSSProperties = {
  padding: 12,
  borderTop: "1px solid #f1f1f1",
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  background: "#fcfcfc",
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #e5e5e5",
  background: "white",
};

const primaryButtonStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: 0,
  color: "white",
};