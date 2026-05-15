import { AdminShell } from '../../components/AdminShell';
import { TenantWorkspaceClient } from './TenantWorkspaceClient';

export default function TenantWorkspacePage({ params }: { params: { tenantId: string } }) {
  return (
    <AdminShell>
      <TenantWorkspaceClient tenantId={params.tenantId} />
    </AdminShell>
  );
}
