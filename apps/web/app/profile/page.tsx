import { AppBar, AppShell } from '../components/neara/app-shell';
import { ProfileClient } from './ProfileClient';

export default function ProfilePage() {
  return (
    <AppShell>
      <AppBar />
      <ProfileClient />
    </AppShell>
  );
}
