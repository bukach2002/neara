'use client';

import { FormEvent, useState } from 'react';
import { adminSend } from '../lib/adminApi';

export function ResetPasswordClient({ token }: { token: string }) {
  const [status, setStatus] = useState(token ? '' : 'Reset token is missing.');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get('newPassword') ?? '');
    const confirmPassword = String(form.get('confirmPassword') ?? '');
    if (newPassword !== confirmPassword) {
      setStatus('Passwords do not match.');
      return;
    }

    setStatus('Updating password...');
    try {
      await adminSend('/api/admin/auth/password-reset/confirm', 'POST', {
        token,
        newPassword,
      });
      setStatus('Password updated. You can sign in now.');
      event.currentTarget.reset();
    } catch {
      setStatus('Reset link is invalid or expired.');
    }
  }

  return (
    <main className="admin-login">
      <form className="lookup-form" onSubmit={submit}>
        <div>
          <p className="eyebrow">Admin</p>
          <h1>New password</h1>
        </div>
        <label>
          <span>Password</span>
          <input name="newPassword" type="password" minLength={12} required disabled={!token} />
        </label>
        <label>
          <span>Confirm password</span>
          <input name="confirmPassword" type="password" minLength={12} required disabled={!token} />
        </label>
        <button type="submit" disabled={!token}>Update password</button>
        <a className="inline-link" href="/admin/login">Back to sign in</a>
        {status && <p className="notice">{status}</p>}
      </form>
    </main>
  );
}
