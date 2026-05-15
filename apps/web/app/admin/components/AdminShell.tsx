'use client';

import { ReactNode, useEffect, useState } from 'react';
import { BarChart3, CalendarDays, Layers3, LogOut, ScrollText, Store } from 'lucide-react';
import { adminGet, adminSend, AdminUser } from '../lib/adminApi';
import { BrandMark } from '../../components/ui';

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
        <a className="brand-link" href="/admin/platform">
          <BrandMark />
        </a>
        <nav>
          <a href="/admin/platform"><BarChart3 aria-hidden="true" size={18} />Platform</a>
          <a href="/admin/platform/bookings"><CalendarDays aria-hidden="true" size={18} />Bookings</a>
          <a href="/admin/platform/categories"><Layers3 aria-hidden="true" size={18} />Categories</a>
          <a href="/admin/platform/logs"><ScrollText aria-hidden="true" size={18} />Logs</a>
          <a href="/admin/tenant"><Store aria-hidden="true" size={18} />Tenant admin</a>
        </nav>
        <p>{user ? `${user.name} - ${user.email}` : 'Not signed in'}</p>
        <button className="sidebar-button" type="button" onClick={logout}>
          <LogOut aria-hidden="true" size={16} />
          Logout
        </button>
      </aside>
      <section className="admin-content">{children}</section>
    </main>
  );
}
