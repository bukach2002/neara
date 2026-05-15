import { AdminShell } from '../../../components/AdminShell';
import { TenantDetailClient } from './TenantDetailClient';

export default function TenantDetailPage({ params }: { params: { id: string } }) {
  return (
    <AdminShell>
      <TenantDetailClient id={params.id} />
    </AdminShell>
  );
}
