import { Suspense } from 'react';
import { AppBar, AppShell } from '../components/neara/app-shell';
import { LoginClient } from './LoginClient';

export default function LoginPage() {
  return (
    <AppShell tabbar={false}>
      <AppBar variant="back" title="Account" profile={false} />
      <Suspense fallback={<main className="n-main" />}>
        <LoginClient />
      </Suspense>
    </AppShell>
  );
}
