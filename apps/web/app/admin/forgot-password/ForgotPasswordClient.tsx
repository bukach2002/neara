'use client';

import { FormEvent, useState } from 'react';
import { adminSend } from '../lib/adminApi';

export function ForgotPasswordClient() {
  const [status, setStatus] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus('Sending reset link...');
    try {
      await adminSend('/api/admin/auth/password-reset/request', 'POST', {
        email: form.get('email'),
      });
      setStatus('If that account exists, a reset link has been sent.');
      event.currentTarget.reset();
    } catch {
      setStatus('Could not request a reset right now.');
    }
  }

  return (
    <main className="admin-login">
      <form className="lookup-form" onSubmit={submit}>
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Reset password</h1>
        </div>
        <label>
          <span>Email</span>
          <input name="email" type="email" required />
        </label>
        <button type="submit">Send reset link</button>
        <a className="inline-link" href="/admin/login">Back to sign in</a>
        {status && <p className="notice">{status}</p>}
      </form>
    </main>
  );
}
