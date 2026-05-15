'use client';

import { FormEvent, useState } from 'react';
import { adminSend } from '../lib/adminApi';

export function LoginClient() {
  const [status, setStatus] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus('Signing in...');
    try {
      await adminSend('/api/admin/auth/login', 'POST', {
        email: form.get('email'),
        password: form.get('password'),
      });
      window.location.href = '/admin/platform';
    } catch {
      setStatus('Sign in failed.');
    }
  }

  return (
    <main className="admin-login">
      <form className="lookup-form" onSubmit={submit}>
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Sign in</h1>
        </div>
        <label>
          <span>Email</span>
          <input name="email" type="email" required />
        </label>
        <label>
          <span>Password</span>
          <input name="password" type="password" required />
        </label>
        <button type="submit">Sign in</button>
        <a className="inline-link" href="/admin/forgot-password">Forgot password?</a>
        {status && <p className="notice">{status}</p>}
      </form>
    </main>
  );
}
