// src/modules/company/onboarding/steps/UsersStep.tsx
//
// Self-contained: fetches its own member list.
// FIX: m.userId was undefined — backend returns "id" not "userId".
//      getUserId() resolves the correct field regardless of API shape.
// FIX: key={m.userId} was undefined → React "missing key" warning.

import { useCallback, useEffect, useState } from "react";
import type React from "react";
import type { BranchRole, BranchUserDto, CreateBranchUserFormValue } from "../../types/company.types";
import { onboardingApi } from "../api/onboardingApi";
import { DEFAULT_USER_FORM } from "../state/onboarding.constants";
import type { FieldErrors, OnboardingAction } from "../state/onboarding.types";
import { extractApiError, isEmail } from "../utils/onboarding.utils";
import {
  Field, Input, SelectInput, Btn, Alert, SectionTitle, EmptyState, Spinner,
} from "../components/company.ui";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * The backend serialises ApplicationUser.Id as "id" (camelCase).
 * BranchUserDto.userId is a TypeScript-side convention that doesn't always
 * match the JSON field name. Check both to be resilient.
 */
function getUserId(m: BranchUserDto): string {
  const a = m as any;
  return String(a.userId ?? a.id ?? a.Id ?? "");
}

function displayName(m: BranchUserDto): string {
  const a = m as any;
  if (a.fullName) return a.fullName;
  const full = `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim();
  return full || a.userName || m.email || "—";
}

function initials(m: BranchUserDto): string {
  const n = displayName(m);
  return n.split(" ").filter(Boolean).slice(0, 2).map((w: string) => w[0]).join("").toUpperCase() || "?";
}

const ROLE_OPTIONS = [
  { value: "BranchAdmin", label: "Branch Admin" },
  { value: "Staff",       label: "Staff"        },
];

interface EditProfileForm { firstName: string; lastName: string; email: string; }

// ── Component ─────────────────────────────────────────────────────────────────

export function UsersStep(props: {
  companyId:   string | null;
  branchId:    string | null;
  branchName?: string;
  saving:      boolean;
  dispatch:    React.Dispatch<OnboardingAction>;
}) {
  // ── Own data fetch ────────────────────────────────────────────────────────
  const [members, setMembers] = useState<BranchUserDto[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMembers = useCallback(async () => {
    if (!props.companyId || !props.branchId) { setMembers([]); return; }
    setLoading(true);
    try {
      const data = await onboardingApi.listBranchUsers(props.companyId, props.branchId);
      setMembers(Array.isArray(data) ? data : []);
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [props.companyId, props.branchId]);

  useEffect(() => { void fetchMembers(); }, [fetchMembers]);

  // ── Create state ──────────────────────────────────────────────────────────
  const [form,   setForm]   = useState<CreateBranchUserFormValue>({ ...DEFAULT_USER_FORM });
  const [errors, setErrors] = useState<FieldErrors>({});

  // ── Edit state ────────────────────────────────────────────────────────────
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [editForm,   setEditForm]   = useState<EditProfileForm>({ firstName: "", lastName: "", email: "" });
  const [editErrors, setEditErrors] = useState<FieldErrors>({});
  const [editSaving, setEditSaving] = useState(false);

  const adminCount = members.filter((m) => m.role === "BranchAdmin").length;

  // ── Create validation ─────────────────────────────────────────────────────

  function validate(): boolean {
    const e: FieldErrors = {};
    if (!form.firstName.trim())                     e.firstName = "First name is required.";
    if (!form.lastName.trim())                      e.lastName  = "Last name is required.";
    if (!form.userName.trim())                      e.userName  = "Username is required.";
    if (!isEmail(form.email))                       e.email     = "Valid email is required.";
    if (!form.password || form.password.length < 6) e.password  = "Password must be at least 6 characters.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateEdit(): boolean {
    const e: FieldErrors = {};
    if (!editForm.firstName.trim()) e.firstName = "First name is required.";
    if (!editForm.lastName.trim())  e.lastName  = "Last name is required.";
    if (!isEmail(editForm.email))   e.email     = "Valid email is required.";
    setEditErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Create handler ────────────────────────────────────────────────────────

  async function create() {
    if (!props.companyId || !props.branchId || !validate()) return;
    props.dispatch({ type: "SAVE_START" });
    try {
      const created = await onboardingApi.createUser(props.companyId, {
        userName:  form.userName.trim(),
        email:     form.email.trim().toLowerCase(),
        password:  form.password,
        firstName: form.firstName.trim(),
        lastName:  form.lastName.trim(),
        branchId:  props.branchId,
        storeId:   null,
      });
      try {
        await onboardingApi.assignBranchUser(
          props.companyId, props.branchId, created.id, form.role,
        );
      } catch {
        await onboardingApi.updateBranchUserRole(
          props.companyId, props.branchId, created.id, form.role,
        );
      }
      setForm({ ...DEFAULT_USER_FORM });
      await fetchMembers();
      props.dispatch({ type: "SAVE_SUCCESS", notice: "User created and assigned." });
    } catch (err) {
      props.dispatch({ type: "SAVE_ERROR", error: extractApiError(err, "Failed to create user.") });
    }
  }

  // ── Edit handlers ─────────────────────────────────────────────────────────

  function startEdit(m: BranchUserDto) {
    const a = m as any;
    setEditingId(getUserId(m));
    setEditForm({
      firstName: a.firstName ?? "",
      lastName:  a.lastName  ?? "",
      email:     m.email     ?? "",
    });
    setEditErrors({});
  }

  function cancelEdit() { setEditingId(null); setEditErrors({}); }

  async function saveEdit(userId: string) {
    if (!props.companyId || !validateEdit()) return;
    setEditSaving(true);
    props.dispatch({ type: "CLEAR_MESSAGES" });
    try {
      await onboardingApi.updateUser(props.companyId, userId, {
        firstName: editForm.firstName.trim(),
        lastName:  editForm.lastName.trim(),
        email:     editForm.email.trim().toLowerCase(),
      });
      setEditingId(null);
      await fetchMembers();
      props.dispatch({ type: "SAVE_SUCCESS", notice: "User updated." });
    } catch (err) {
      props.dispatch({ type: "SAVE_ERROR", error: extractApiError(err, "Failed to update user.") });
    } finally { setEditSaving(false); }
  }

  // ── Role / remove handlers ────────────────────────────────────────────────

  async function changeRole(userId: string, role: BranchRole) {
    if (!props.companyId || !props.branchId) return;
    const member = members.find((x) => getUserId(x) === userId);
    if (member?.role === "BranchAdmin" && role !== "BranchAdmin" && adminCount <= 1) {
      props.dispatch({
        type: "SAVE_ERROR",
        error: "Assign another Branch Admin before demoting the last admin.",
      });
      return;
    }
    props.dispatch({ type: "SAVE_START" });
    try {
      await onboardingApi.updateBranchUserRole(props.companyId, props.branchId, userId, role);
      await fetchMembers();
      props.dispatch({ type: "SAVE_SUCCESS", notice: "Role updated." });
    } catch (err) {
      props.dispatch({ type: "SAVE_ERROR", error: extractApiError(err, "Failed to update role.") });
    }
  }

  async function remove(userId: string) {
    if (!props.companyId || !props.branchId) return;
    const member = members.find((x) => getUserId(x) === userId);
    if (member?.role === "BranchAdmin" && adminCount <= 1) {
      props.dispatch({ type: "SAVE_ERROR", error: "Cannot remove the last Branch Admin." });
      return;
    }
    props.dispatch({ type: "SAVE_START" });
    try {
      await onboardingApi.removeBranchUser(props.companyId, props.branchId, userId);
      await fetchMembers();
      props.dispatch({ type: "SAVE_SUCCESS", notice: "User removed." });
    } catch (err) {
      props.dispatch({ type: "SAVE_ERROR", error: extractApiError(err, "Failed to remove user.") });
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "24px 0", color: "#64748b" }}>
        <Spinner /> Loading users…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      <SectionTitle
        title="Branch users"
        subtitle={`Create and assign users for ${props.branchName ?? "this branch"}. At least one Branch Admin is required.`}
      />

      {/* ── Create user form ──────────────────────────────────────────────── */}
      <div className="ob-inner-card">
        <div className="ob-inner-card-header">
          <div className="ob-inner-card-title">Create branch user</div>
          <div className="ob-inner-card-sub">
            Create a user and assign them to this branch with the appropriate role.
          </div>
        </div>
        <div className="ob-inner-card-body">
          <div className="ob-grid-2">
            <Field label="First name" required hint={errors.firstName}>
              <Input value={form.firstName}
                onChange={(v) => setForm((x) => ({ ...x, firstName: v }))}
                placeholder="e.g. Hana" />
            </Field>
            <Field label="Last name" required hint={errors.lastName}>
              <Input value={form.lastName}
                onChange={(v) => setForm((x) => ({ ...x, lastName: v }))}
                placeholder="e.g. Tesfaye" />
            </Field>
            <Field label="Username" required hint={errors.userName}>
              <Input value={form.userName}
                onChange={(v) => setForm((x) => ({ ...x, userName: v }))}
                placeholder="e.g. hana.t" />
            </Field>
            <Field label="Email" required hint={errors.email}>
              <Input value={form.email}
                onChange={(v) => setForm((x) => ({ ...x, email: v }))}
                placeholder="hana@company.com" type="email" />
            </Field>
            <Field label="Temporary password" required hint={errors.password}>
              <Input value={form.password}
                onChange={(v) => setForm((x) => ({ ...x, password: v }))}
                type="password" placeholder="Minimum 6 characters" />
            </Field>
            <Field label="Role">
              <SelectInput
                value={form.role}
                onChange={(v) => setForm((x) => ({ ...x, role: v as BranchRole }))}
                options={ROLE_OPTIONS} />
            </Field>
          </div>
        </div>
        <div className="ob-inner-card-footer">
          <Btn variant="primary" onClick={create} disabled={props.saving}>
            {props.saving ? "Creating…" : "Create user"}
          </Btn>
        </div>
      </div>

      {/* ── Admin requirement notice ──────────────────────────────────────── */}
      {adminCount === 0 && members.length > 0 && (
        <Alert
          tone="warn"
          title="No Branch Admin assigned"
          message="At least one user must have the Branch Admin role before setup can be completed."
        />
      )}

      {/* ── Members list ──────────────────────────────────────────────────── */}
      {members.length > 0 ? (
        <div>
          <div className="ob-members-hdr">
            Branch members ({members.length}) · {adminCount} admin{adminCount !== 1 ? "s" : ""}
          </div>

          {members.map((m) => {
            const uid      = getUserId(m);   // ← resolved correctly
            const isAdmin  = m.role === "BranchAdmin";
            const isEditing = editingId === uid;

            if (isEditing) {
              return (
                <div key={uid || `edit-${m.email}`} className="ob-list-row"
                  style={{ flexWrap: "wrap", gap: 10, background: "#f8faff", alignItems: "flex-start" }}>
                  <div className={`ob-avatar ${isAdmin ? "ob-avatar--admin" : "ob-avatar--staff"}`}
                    style={{ marginTop: 2 }}>
                    {initials(m)}
                  </div>
                  <div style={{ flex: 1, minWidth: 220, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <Field label="First name" required hint={editErrors.firstName}>
                      <Input value={editForm.firstName}
                        onChange={(v) => setEditForm((f) => ({ ...f, firstName: v }))}
                        placeholder="First name" />
                    </Field>
                    <Field label="Last name" required hint={editErrors.lastName}>
                      <Input value={editForm.lastName}
                        onChange={(v) => setEditForm((f) => ({ ...f, lastName: v }))}
                        placeholder="Last name" />
                    </Field>
                    <Field label="Email" required hint={editErrors.email}>
                      <Input value={editForm.email}
                        onChange={(v) => setEditForm((f) => ({ ...f, email: v }))}
                        type="email" placeholder="user@company.com" />
                    </Field>
                  </div>
                  <SelectInput value={m.role}
                    onChange={(v) => changeRole(uid, v as BranchRole)}
                    options={ROLE_OPTIONS} />
                  <div style={{ display: "flex", gap: 6 }}>
                    <Btn variant="primary" onClick={() => saveEdit(uid)} disabled={editSaving}
                      style={{ padding: "4px 12px", fontSize: 12, minHeight: 30 }}>
                      {editSaving ? "Saving…" : "Save"}
                    </Btn>
                    <Btn variant="ghost" onClick={cancelEdit} disabled={editSaving}
                      style={{ padding: "4px 10px", fontSize: 12, minHeight: 30 }}>
                      Cancel
                    </Btn>
                  </div>
                </div>
              );
            }

            return (
              <div key={uid || `member-${m.email}`} className="ob-list-row">
                <div className={`ob-avatar ${isAdmin ? "ob-avatar--admin" : "ob-avatar--staff"}`}>
                  {initials(m)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                    {displayName(m)}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{m.email}</div>
                </div>
                <SelectInput value={m.role}
                  onChange={(v) => changeRole(uid, v as BranchRole)}
                  options={ROLE_OPTIONS} />
                <Btn variant="ghost" onClick={() => startEdit(m)}
                  style={{ padding: "4px 10px", fontSize: 12, minHeight: 30 }}>
                  Edit
                </Btn>
                <Btn variant="ghost" onClick={() => remove(uid)}
                  style={{ padding: "4px 10px", fontSize: 12, minHeight: 30 }}>
                  Remove
                </Btn>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No users assigned yet"
          sub="Create at least one Branch Admin to complete setup."
        />
      )}

    </div>
  );
}