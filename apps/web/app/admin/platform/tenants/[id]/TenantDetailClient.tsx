'use client';

import { FormEvent, useEffect, useState } from 'react';
import { adminGet, adminSend, TenantRow } from '../../../lib/adminApi';

type TenantDetail = TenantRow & {
  memberships: Array<{ id: string; role: string; user: { email: string; name: string } }>;
  services: Array<{ id: string; name: string; isActive: boolean }>;
  experts: Array<{ id: string; displayName: string; isActive: boolean }>;
  locations: Array<{ id: string; name: string; locality: string; isActive: boolean }>;
};

export function TenantDetailClient({ id }: { id: string }) {
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [status, setStatus] = useState('Loading tenant...');

  async function load() {
    const result = await adminGet<TenantDetail>(`/api/admin/platform/tenants/${id}`);
    setTenant(result);
    setStatus('');
  }

  useEffect(() => {
    load().catch(() => setStatus('Could not load tenant.'));
  }, [id]);

  async function transition(path: string) {
    setStatus('Updating tenant...');
    try {
      await adminSend(`/api/admin/platform/tenants/${id}/${path}`, 'POST');
      await load();
    } catch {
      setStatus('Tenant update failed.');
    }
  }

  async function createAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus('Creating first admin...');
    try {
      const result = await adminSend<{ temporaryPassword: string }>(`/api/admin/platform/tenants/${id}/admins/first`, 'POST', {
        name: form.get('name'),
        email: form.get('email'),
      });
      setStatus(`Temporary password: ${result.temporaryPassword}`);
      await load();
    } catch {
      setStatus('Could not create first admin.');
    }
  }

  if (!tenant) return <p className="notice">{status}</p>;

  return (
    <>
      <div className="admin-heading">
        <div>
          <h1>{tenant.name}</h1>
          <p>{tenant.slug} · {tenant.bookingPrefix}</p>
        </div>
        <div className="admin-actions">
          <button onClick={() => transition('activate')}>Activate</button>
          <button onClick={() => transition('inactivate')}>Inactivate</button>
          <button onClick={() => transition('suspend')}>Suspend</button>
        </div>
      </div>
      {status && <p className="notice">{status}</p>}
      <section className="admin-grid-two">
        <div className="compact-card">
          <h2>Setup</h2>
          <p>Status: <span className={`badge ${tenant.status}`}>{tenant.status}</span></p>
          <p>{tenant.locations.length} locations · {tenant.services.length} services · {tenant.experts.length} experts</p>
          <p>{tenant.memberships.length} memberships</p>
        </div>
        <form className="admin-form" onSubmit={createAdmin}>
          <h2>First tenant admin</h2>
          <input name="name" placeholder="Admin name" required />
          <input name="email" placeholder="admin@example.com" type="email" required />
          <button type="submit">Create admin</button>
        </form>
      </section>
    </>
  );
}
