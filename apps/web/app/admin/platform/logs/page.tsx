import { AdminShell } from '../../components/AdminShell';
import { LogsClient } from './LogsClient';

export default function LogsPage() {
  return (
    <AdminShell>
      <LogsClient />
    </AdminShell>
  );
}
