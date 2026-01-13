import { useEffect, useMemo, useState } from "react";
import { http } from "../../../../api/http";
import CreateBranchUserForm from "../../pages/CreateBranchUserForm";
import type {CreateBranchUserFormValue, BranchRole} from "../../types"

/**
 * BranchUsersStep
 * - Create a user (aligned with CreateUserDto)
 * - Assign user to branch + role
 * - List branch users
 * - Change role / remove user
 *
 * NOTE: Update endpoint paths below to match your backend if different.
 */


type Props = {
  companyId: string;
  branchId: string | null;
  onDone: () => void;
};

/** ===== Backend-aligned CreateUserDto request (camelCase for JSON) ===== */
export type CreateUserRequest = {
  userName: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  branchId?: string | null;
  storeId?: string | null;
};

export type BranchUserDto = {
  userId: string;
  userName?: string | null;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  role: BranchRole;
  isActive?: boolean;
};

type AssignBranchUserRequest = { userId: string; role: BranchRole };
type UpdateBranchUserRoleRequest = { role: BranchRole };

/** ================= API (edit endpoints here only) ================= */
const usersApi = {
  async create(companyId: string, body: CreateUserRequest) {
    // Expects: returns created user { id, email, ... }
    const res = await http.post(`/companies/${companyId}/users`, body);
    return res.data as { id: string } & Record<string, any>;
  },
};

const branchUsersApi = {
  async list(companyId: string, branchId: string): Promise<BranchUserDto[]> {
    const res = await http.get(`/companies/${companyId}/branches/${branchId}/users`);
    return (res.data ?? []) as BranchUserDto[];
  },

  async assign(companyId: string, branchId: string, body: AssignBranchUserRequest): Promise<void> {
    await http.post(`/companies/${companyId}/branches/${branchId}/users`, body);
  },

  async updateRole(companyId: string, branchId: string, userId: string, body: UpdateBranchUserRoleRequest): Promise<void> {
    await http.put(`/companies/${companyId}/branches/${branchId}/users/${userId}/role`, body);
  },

  async remove(companyId: string, branchId: string, userId: string): Promise<void> {
    await http.delete(`/companies/${companyId}/branches/${branchId}/users/${userId}`);
  },
};

export default function BranchUsersStep({ companyId, branchId, onDone }: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [members, setMembers] = useState<BranchUserDto[]>([]);

 const [form, setForm] = useState<CreateBranchUserFormValue>({
  userName: "",
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  role: "BranchAdmin",
});

  const canUse = !!companyId && !!branchId;

  const branchAdminsCount = useMemo(
    () => members.filter((m) => m.role === "BranchAdmin").length,
    [members]
  );

  const hasBranchAdmin = branchAdminsCount > 0;

  async function load() {
    if (!canUse) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const list = await branchUsersApi.list(companyId, branchId!);
      setMembers(list);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to load branch users.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [companyId, branchId]);

  function validateCreate() {
    const email = form.email.trim();
    const userName = form.userName.trim();
    const password = form.password;

    if (!form.firstName.trim()) return "First name is required.";
    if (!form.lastName.trim()) return "Last name is required.";
    if (!userName) return "Username is required.";
    if (!email || !email.includes("@")) return "A valid email is required.";
    if (!password || password.length < 6) return "Password must be at least 6 characters.";
    return null;
  }

  async function createUser() {
    if (!canUse) return;

    const msg = validateCreate();
    if (msg) {
      setError(msg);
      return;
    }

    setIsBusy(true);
    setError(null);
    setNotice(null);

    try {
      // 1) Create user (aligned with CreateUserDto)
      const created = await usersApi.create(companyId, {
        userName: form.userName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        branchId: branchId!,
        storeId: null,
      });

      // 2) Ensure they are assigned to branch with desired role.
      //    If your backend already assigns on create, assign() may conflict;
      //    so we fall back to updateRole.
      try {
        await branchUsersApi.assign(companyId, branchId!, {
          userId: created.id,
          role: form.role,
        });
      } catch {
        // Fallback: role update endpoint (covers "already assigned" case)
        await branchUsersApi.updateRole(companyId, branchId!, created.id, { role: form.role });
      }

      setNotice("User created and assigned to branch.");
      setForm({
        userName: "",
        email: "",
        password: "",
        firstName: "",
        lastName: "",
        role: "BranchAdmin",
      });

      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to create user.");
    } finally {
      setIsBusy(false);
    }
  }

  async function changeRole(userId: string, nextRole: BranchRole) {
    if (!canUse) return;

    const current = members.find((m) => m.userId === userId);
    if (!current) return;

    // Prevent leaving the branch with zero admins
    if (current.role === "BranchAdmin" && nextRole !== "BranchAdmin" && branchAdminsCount === 1) {
      setError("Assign another Branch Admin before demoting the last admin.");
      return;
    }

    setIsBusy(true);
    setError(null);
    setNotice(null);

    try {
      await branchUsersApi.updateRole(companyId, branchId!, userId, { role: nextRole });
      setNotice("Role updated.");
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to update role.");
    } finally {
      setIsBusy(false);
    }
  }

  async function removeUser(userId: string) {
    if (!canUse) return;

    const current = members.find((m) => m.userId === userId);
    if (!current) return;

    if (current.role === "BranchAdmin" && branchAdminsCount === 1) {
      setError("You cannot remove the last Branch Admin.");
      return;
    }

    setIsBusy(true);
    setError(null);
    setNotice(null);

    try {
      await branchUsersApi.remove(companyId, branchId!, userId);
      setNotice("User removed from branch.");
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to remove user.");
    } finally {
      setIsBusy(false);
    }
  }

  function continueNext() {
    if (!hasBranchAdmin) {
      setError("Assign at least one Branch Admin to continue.");
      return;
    }
    onDone();
  }

  if (!branchId) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <div className="text-sm font-semibold text-slate-900">Branch Users</div>
        <div className="text-xs text-slate-500 mt-1">
          Create/select a branch first, then assign users.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <Banner tone="danger" title="Action required" message={error} />}
      {notice && <Banner tone="success" title="Updated" message={notice} />}

      {/* Create user form */}
      <CreateBranchUserForm value={form} onChange={setForm} busy={isBusy} onSubmit={createUser} />

      {/* Current members */}
      <Card
        title="Branch members"
        subtitle="Manage roles and membership for this branch."
        right={
          <button className="btn-lux" onClick={load} disabled={isBusy || isLoading}>
            Refresh
          </button>
        }
      >
        {isLoading ? (
          <div className="text-sm text-slate-500">Loading…</div>
        ) : members.length === 0 ? (
          <div className="text-sm text-slate-500">No users assigned yet.</div>
        ) : (
          <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white overflow-hidden">
            {members.map((m) => {
              const name =
                m.fullName ??
                [m.firstName, m.lastName].filter(Boolean).join(" ") ??
                m.userName ??
                "—";

              return (
                <div key={m.userId} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{name}</div>
                    <div className="text-xs text-slate-500">{m.email}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      className="lux-select"
                      value={m.role}
                      onChange={(e) => changeRole(m.userId, e.target.value as BranchRole)}
                      disabled={isBusy}
                    >
                      <option value="BranchAdmin">Branch Admin</option>
                      <option value="Staff">Staff</option>
                    </select>

                    <button className="btn-lux" onClick={() => removeUser(m.userId)} disabled={isBusy}>
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Requirement: at least <span className="font-semibold text-slate-700">one Branch Admin</span>.
          </div>
          <button
            className="btn-lux-primary"
            onClick={continueNext}
            disabled={!hasBranchAdmin || isBusy || isLoading}
          >
            Continue
          </button>
        </div>
      </Card>

      <style>{styles}</style>
    </div>
  );
}

/* =================== UI =================== */

function Card(props: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-b from-white to-slate-50 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{props.title}</div>
          {props.subtitle && <div className="text-xs text-slate-500 mt-1">{props.subtitle}</div>}
        </div>
        {props.right}
      </div>
      <div className="p-6">{props.children}</div>
    </div>
  );
}

function Banner(props: { tone: "success" | "danger"; title: string; message: string }) {
  const cls =
    props.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-rose-200 bg-rose-50 text-rose-800";

  return (
    <div className={`rounded-2xl border p-4 ${cls}`}>
      <div className="text-xs font-extrabold tracking-widest uppercase">{props.title}</div>
      <div className="text-sm mt-1">{props.message}</div>
    </div>
  );
}

const styles = `
  .btn-lux{
    border: 1px solid rgb(226 232 240);
    background: white;
    padding: 10px 14px;
    border-radius: 14px;
    font-weight: 700;
    font-size: 14px;
    color: rgb(15 23 42);
    box-shadow: 0 1px 0 rgba(0,0,0,0.02);
  }
  .btn-lux:disabled{ opacity: .55; cursor: not-allowed; }
  .btn-lux-primary{
    border: 1px solid rgb(15 23 42);
    background: rgb(15 23 42);
    padding: 10px 14px;
    border-radius: 14px;
    font-weight: 800;
    font-size: 14px;
    color: white;
    box-shadow: 0 8px 24px rgba(15,23,42,0.18);
  }
  .btn-lux-primary:disabled{ opacity: .55; cursor: not-allowed; box-shadow:none; }

  .lux-select{
    padding: 10px 12px;
    border-radius: 14px;
    border: 1px solid rgb(226 232 240);
    background: white;
    font-size: 14px;
    color: rgb(15 23 42);
    outline: none;
  }
`;
