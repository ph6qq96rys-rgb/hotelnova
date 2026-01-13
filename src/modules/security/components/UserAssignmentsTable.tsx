import { useState } from "react";
import { Table, Th, Td } from "../../../components/Table";
import { Badge } from "../../../components/Badge";
import { Can } from "../../../auth/Can";

type Assignment = {
  id: string;
  roleId: string;
  roleName: string;
  branchId?: string | null;
  branchName?: string | null;
  permissionCount: number;
};

type Props = {
  assignments?: Assignment[] | null;
  loading?: boolean;
  onRemove?: (assignmentId: string) => Promise<void>;
};

export function UserAssignmentsTable({
  assignments,
  loading = false,
  onRemove
}: Props) {
  const rows: Assignment[] = assignments ?? [];
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleRemove(id: string) {
    if (!onRemove) return;

    const ok = window.confirm("Remove this role assignment?");
    if (!ok) return;

    try {
      setRemovingId(id);
      await onRemove(id);
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <Table>
      <thead>
        <tr>
          <Th>Role</Th>
          <Th>Scope</Th>
          <Th>Permissions</Th>
          <Th align="right">&nbsp;</Th>
        </tr>
      </thead>

      <tbody>
        {loading ? (
          <tr>
            <Td colSpan={4}>
              <div className="py-6 text-sm text-slate-500">
                Loading assignments…
              </div>
            </Td>
          </tr>
        ) : rows.length === 0 ? (
          <tr>
            <Td colSpan={4}>
              <div className="py-8 text-sm text-slate-500">
                No access assignments yet.
              </div>
            </Td>
          </tr>
        ) : (
          rows.map((a: Assignment) => (
            <tr key={a.id} className="hover:bg-slate-50">
              <Td>
                <div className="font-medium text-slate-900">{a.roleName}</div>
              </Td>

              <Td>
                <Badge variant={a.branchId ? "purple" : "blue"}>
                  {a.branchName ?? "Company"}
                </Badge>
              </Td>

              <Td>
                <span className="text-slate-700">{a.permissionCount}</span>
              </Td>

              <Td align="right">
                <Can permission="roles.assign">
                  <button
                    type="button"
                    className="text-red-600 hover:underline disabled:opacity-50"
                    disabled={!onRemove || removingId === a.id}
                    onClick={() => handleRemove(a.id)}
                  >
                    {removingId === a.id ? "Removing…" : "Remove"}
                  </button>
                </Can>
              </Td>
            </tr>
          ))
        )}
      </tbody>
    </Table>
  );
}
