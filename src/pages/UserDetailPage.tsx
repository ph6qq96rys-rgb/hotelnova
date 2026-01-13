import { useParams } from "react-router-dom";
import { Page } from "../components/Page";
import { PageHeader } from "../components/PageHeader";
import { Card, CardHeader, CardContent } from "../components/Card";
//import { Badge } from "../components/Badge";

import { useUser } from "../modules/security/hooks/useUsers";

import { AssignRoleButton } from "../modules/security/components/AssignRoleButton";
import {UserAssignmentsTable} from "../modules/security/components/UserAssignmentsTable"
import { Can } from "../auth/Can";

export default function UserDetailPage() {
  const { userId } = useParams();
  const { user, refresh } = useUser(userId!);


  if (!user) return null;

  return (
    <Page>
      <PageHeader
        title={user.fullName}
        subtitle={user.email}
        actions={
          <Can permission="users.manage">
            <button className="btn-danger">Suspend User</button>
          </Can>
        }
      />

      <Card>
        <CardHeader
            title="Access Assignments"
            action={
              <Can permission="roles.assign">
                <AssignRoleButton userId={user.id} onAssigned={refresh} />
              </Can>
            }
          />

        <CardContent>
          <UserAssignmentsTable assignments={user.assignments} />
        </CardContent>
      </Card>
    </Page>
  );
}
