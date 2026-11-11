import { AppBar, AppShell } from '../../components/neara/app-shell';
import { SessionManager } from '../../components/neara/session-manager';

export default function ProfileSessionsPage() {
  return (
    <AppShell>
      <AppBar />
      <main className="n-main">
        <SessionManager mode="customer" />
      </main>
    </AppShell>
  );
}
