import { Suspense } from 'react';
import { AppBar, AppShell } from '../components/neara/app-shell';
import { RegisterClient } from './RegisterClient';

export default function RegisterPage() {
  return (
    <AppShell tabbar={false}>
      <AppBar variant="back" title="Create account" profile={false} />
      <Suspense fallback={<main className="n-main" />}>
        <RegisterClient />
      </Suspense>
    </AppShell>
  );
}
