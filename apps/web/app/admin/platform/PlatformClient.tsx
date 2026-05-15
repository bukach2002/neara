'use client';

import { useEffect, useState } from 'react';
import { adminGet, TenantRow } from '../lib/adminApi';

export function PlatformClient() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [status, setStatus] = useState('Loading tenants...');

  useEffect(() => {
    adminGet<TenantRow[]>('/api/admin/platform/tenants')
      .then((result) => {
        setTenants(result);
        setStatus('');
      })
      .catch(() => setStatus('Could not load tenants.'));
  }, []);

  return (
    <>
      <div className="admin-heading">
        <h1>Tenants</h1>
        <div className="admin-actions">
          <a className="admin-action" href="/admin/platform/bookings">Booking lookup</a>
          <a className="admin-action" href="/admin/platform/tenants/new">Create tenant</a>
        </div>
      </div>
      {status && <p className="notice">{status}</p>}
      <div className="admin-table">
        <div className="admin-row admin-row-head">
          <span>Name</span>
          <span>Status</span>
          <span>Category</span>
          <span>Setup</span>
        </div>
        {tenants.map((tenant) => (
          <a className="admin-row" href={`/admin/platform/tenants/${tenant.id}`} key={tenant.id}>
            <span>{tenant.name}<small>{tenant.slug}</small></span>
            <span className={`badge ${tenant.status}`}>{tenant.status}</span>
            <span>{tenant.primaryCategory?.name ?? 'Unassigned'}</span>
            <span>{tenant._count.services} services · {tenant._count.experts} experts</span>
          </a>
        ))}
      </div>
    </>
  );
}
