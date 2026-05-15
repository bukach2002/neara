'use client';

import { FormEvent, useState } from 'react';
import { adminSend } from '../../../lib/adminApi';

export function NewTenantClient() {
  const [status, setStatus] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus('Creating tenant...');
    try {
      const tenant = await adminSend<{ id: string }>('/api/admin/platform/tenants', 'POST', {
        name: form.get('name'),
        slug: form.get('slug'),
        bookingPrefix: form.get('bookingPrefix'),
        timezone: form.get('timezone') || undefined,
      });
      window.location.href = `/admin/platform/tenants/${tenant.id}`;
    } catch {
      setStatus('Could not create tenant.');
    }
  }

  return (
    <>
      <div className="admin-heading"><h1>Create tenant</h1></div>
      <form className="admin-form" onSubmit={submit}>
        <input name="name" placeholder="Tenant name" required />
        <input name="slug" placeholder="tenant-slug" required />
        <input name="bookingPrefix" placeholder="NEAR" required />
        <input name="timezone" placeholder="Asia/Kolkata" />
        <button type="submit">Create draft</button>
      </form>
      {status && <p className="notice">{status}</p>}
    </>
  );
}
