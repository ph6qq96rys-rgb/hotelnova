import { Page } from "../components/Page";
import { PageHeader } from "../components/PageHeader";
import { Card, CardContent } from "../components/Card";
import { Table, Th, Td } from "../components/Table";
import { Badge } from "../components/Badge";
import { useNavigate } from "react-router-dom";
import { useUsers } from "../modules/security/hooks/useUsers";
import { Can } from "../auth/Can";

export default function UsersPage() {
  const nav = useNavigate();
  const { users, loading, error } = useUsers();

  return (
    <Page>
      <PageHeader
        title="Users"
        subtitle="Manage people and access enrollment"
        actions={
          <Can permission="users.manage">
            <button className="btn-primary">Invite User</button>
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
                {loading ? (
                  <tr>
                    <Td colSpan={4}>
                      <div className="py-6 text-sm text-slate-500">Loading…</div>
                    </Td>
                  </tr>
                ) : error ? (
                  <tr>
                    <Td colSpan={4}>
                      <div className="py-6 text-sm text-red-600">
                        Failed to load users: {error}
                      </div>
                    </Td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <Td colSpan={4}>
                      <div className="py-10 text-sm text-slate-500">
                        No users yet. Invite your first user to get started.
                      </div>
                    </Td>
                  </tr>
                ) : (
                  users.map(u => (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-50 cursor-pointer"
                      onClick={() => nav(`/security/users/${u.id}`)}
                    >
                      <Td>
                        <div className="font-medium text-slate-900">{u.fullName}</div>
                      </Td>
                      <Td>{u.email}</Td>
                      <Td>
                        <Badge
                          variant={
                            u.status === "Active"
                              ? "blue"
                              : u.status === "Pending"
                              ? "purple"
                              : "danger"
                          }
                        >
                          {u.status}
                        </Badge>
                      </Td>
                      <Td align="right">→</Td>
                    </tr>
                  ))
                )}
              </tbody>

          </Table>
        </CardContent>
      </Card>
    </Page>
  );
}
