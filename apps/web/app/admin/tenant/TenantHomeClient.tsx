'use client';

import { useEffect, useState } from 'react';
import { adminGet, AdminUser } from '../lib/adminApi';

export function TenantHomeClient() {
  const [user, setUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    adminGet<{ user: AdminUser }>('/api/admin/auth/me').then((result) => setUser(result.user)).catch(() => setUser(null));
  }, []);

  return (
    <>
      <div className="admin-heading"><h1>Tenant admin</h1></div>
      <div className="admin-table">
        {user?.memberships.map((membership) => (
          <a className="admin-row" href={`/admin/tenant/${membership.tenantId}`} key={membership.tenantId}>
            <span>{membership.tenant.name}<small>{membership.role}</small></span>
            <span className={`badge ${membership.tenant.status}`}>{membership.tenant.status}</span>
          </a>
        ))}
      </div>
    </>
  );
}
