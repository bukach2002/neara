import { AdminShell } from '../../components/AdminShell';
import { SessionManager } from '../../../components/neara/session-manager';

export default function AdminSessionsPage() {
  return (
    <AdminShell>
      <SessionManager mode="admin" />
    </AdminShell>
  );
}
