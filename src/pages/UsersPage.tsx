import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Page } from "../components/Page";
import { PageHeader } from "../components/PageHeader";
import { Card, CardContent } from "../components/Card";
import { Table, Th, Td } from "../components/Table";
import { Badge } from "../components/Badge";
import { Can } from "../auth/Can";
import { useUsers } from "../modules/security/hooks/useUsers";
import { useAppScope } from "../app/useAppScope";

type UserStatus = "Active" | "Pending" | "Disabled" | "Inactive" | string;

function statusVariant(status: UserStatus): "success" | "warning" | "destructive" {
  switch (status) {
    case "Active":
      return "success";
    case "Pending":
      return "warning";
    default:
      return "destructive";
  }
}

export default function UsersPage() {
  const navigate = useNavigate();
  const { companyId } = useAppScope();
  const { users = [], loading, error } = useUsers(companyId);

  const isEmpty = useMemo(() => !loading && !error && users.length === 0, [loading, error, users.length]);

  return (
    <Page>
      <PageHeader
        title="Users"
        subtitle="Manage people and access enrollment"
        actions={
          <Can permission="users.manage">
            <button type="button" className="btn-primary">
              Invite User
            </button>
          </Can>
        }
      />

      <Card>
        <CardContent>
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Status</Th>
                <Th align="right" />
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <Td colSpan={4}>
                    <div className="py-6 text-sm text-slate-500">Loading…</div>
                  </Td>
                </tr>
              )}

              {!loading && error && (
                <tr>
                  <Td colSpan={4}>
                    <div className="py-6 text-sm text-red-600">Failed to load users: {error}</div>
                  </Td>
                </tr>
              )}

              {isEmpty && (
                <tr>
                  <Td colSpan={4}>
                    <div className="py-10 text-sm text-slate-500">
                      No users yet. Invite your first user to get started.
                    </div>
                  </Td>
                </tr>
              )}

              {!loading &&
                !error &&
                users.map((u) => (
                  <tr
                    key={u.id}
                    role="button"
                    tabIndex={0}
                    className="cursor-pointer hover:bg-slate-50 focus:bg-slate-50 outline-none"
                    onClick={() => navigate(`/security/users/${u.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`/security/users/${u.id}`);
                      }
                    }}
                  >
                    <Td>
                      <div className="font-medium text-slate-900">{u.fullName}</div>
                    </Td>
                    <Td>{u.email}</Td>
                    <Td>
                      <Badge variant={statusVariant(u.status)}>{u.status}</Badge>
                    </Td>
                    <Td align="right" aria-hidden>
                      →
                    </Td>
                  </tr>
                ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </Page>
  );
}
