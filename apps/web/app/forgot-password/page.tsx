import { Suspense } from 'react';
import { AppBar, AppShell } from '../components/neara/app-shell';
import { ForgotPasswordClient } from './ForgotPasswordClient';

export default function ForgotPasswordPage() {
  return (
    <AppShell tabbar={false}>
      <AppBar variant="back" title="Reset password" profile={false} />
      <Suspense fallback={<main className="n-main" />}>
        <ForgotPasswordClient />
      </Suspense>
    </AppShell>
  );
}
