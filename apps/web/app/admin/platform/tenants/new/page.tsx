import { AdminShell } from '../../../components/AdminShell';
import { NewTenantClient } from './NewTenantClient';

export default function NewTenantPage() {
  return (
    <AdminShell>
      <NewTenantClient />
    </AdminShell>
  );
}
