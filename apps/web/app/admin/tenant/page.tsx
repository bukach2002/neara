import { AdminShell } from '../components/AdminShell';
import { TenantHomeClient } from './TenantHomeClient';

export default function TenantAdminHomePage() {
  return (
    <AdminShell>
      <TenantHomeClient />
    </AdminShell>
  );
}
