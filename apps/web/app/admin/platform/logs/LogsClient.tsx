'use client';

import { useEffect, useState } from 'react';
import { adminGet } from '../../lib/adminApi';

type LogItem = { id: string; action?: string; summary?: string; templateKey?: string; status?: string; createdAt: string };

export function LogsClient() {
  const [audit, setAudit] = useState<LogItem[]>([]);
  const [notifications, setNotifications] = useState<LogItem[]>([]);

  useEffect(() => {
    adminGet<{ items: LogItem[] }>('/api/admin/platform/audit-logs?take=20').then((result) => setAudit(result.items)).catch(() => setAudit([]));
    adminGet<{ items: LogItem[] }>('/api/admin/platform/notification-logs?take=20').then((result) => setNotifications(result.items)).catch(() => setNotifications([]));
  }, []);

  return (
    <>
      <div className="admin-heading"><h1>Logs</h1></div>
      <section className="admin-grid-two">
        <div>
          <h2>Audit</h2>
          <div className="admin-table">
            {audit.map((item) => <div className="admin-row" key={item.id}><span>{item.action}<small>{item.summary}</small></span><span>{new Date(item.createdAt).toLocaleString()}</span></div>)}
          </div>
        </div>
        <div>
          <h2>Notifications</h2>
          <div className="admin-table">
            {notifications.map((item) => <div className="admin-row" key={item.id}><span>{item.templateKey}<small>{item.status}</small></span><span>{new Date(item.createdAt).toLocaleString()}</span></div>)}
          </div>
        </div>
      </section>
    </>
  );
}
