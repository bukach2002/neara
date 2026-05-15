'use client';

import { ReactNode, useEffect, useState } from 'react';
import { adminGet, adminSend, AdminUser } from '../lib/adminApi';

export function AdminShell({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    adminGet<{ user: AdminUser }>('/api/admin/auth/me')
      .then((result) => setUser(result.user))
      .catch(() => setUser(null));
  }, []);

  async function logout() {
    await adminSend('/api/admin/auth/logout', 'POST').catch(() => null);
    window.location.href = '/admin/login';
  }

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <a className="brand-row brand-row-dark" href="/admin/platform">
          <span className="brand-mark brand-mark-dark">N</span>
          <span>Neara</span>
        </a>
        <nav>
          <a href="/admin/platform">Platform</a>
          <a href="/admin/platform/bookings">Bookings</a>
          <a href="/admin/platform/categories">Categories</a>
          <a href="/admin/platform/logs">Logs</a>
          <a href="/admin/tenant">Tenant admin</a>
        </nav>
        <p>{user ? `${user.name} - ${user.email}` : 'Not signed in'}</p>
        <button className="sidebar-button" type="button" onClick={logout}>
          Logout
        </button>
      </aside>
      <section className="admin-content">{children}</section>
    </main>
  );
}
