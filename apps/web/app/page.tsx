import { AppBar, AppShell } from './components/neara/app-shell';
import { DiscoverScreen } from './components/neara/discover-screen';

export default function HomePage() {
  return (
    <AppShell>
      <AppBar />
      <DiscoverScreen />
    </AppShell>
  );
}
