'use client';

import { Monitor, RefreshCw, ShieldCheck, Smartphone, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { adminGet, adminSend } from '../../admin/lib/adminApi';
import { apiDelete, apiGet } from '../../lib/api';
import { Note, Pill } from './primitives';

type SessionItem = {
  id: string;
  kind: 'web' | 'mobile';
  audience: string | null;
  deviceName: string | null;
  platform: string | null;
  trustedDevice: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  expiresAt: string;
};

type SessionResponse = { items: SessionItem[] };

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

function when(value: string | null) {
  return value ? DATE_FORMAT.format(new Date(value)) : 'Unknown';
}

function deviceLabel(session: SessionItem) {
  if (session.deviceName) return session.deviceName;
  if (session.kind === 'mobile') return 'Neara mobile app';
  return session.audience === 'admin' ? 'Browser (admin)' : 'Browser';
}

/**
 * Lists the web sessions and native token families attached to the signed-in
 * account. Revoking any entry drops it on the next request because cookie
 * sessions and mobile refresh tokens share the same listing.
 */
export function SessionManager({ mode }: { mode: 'customer' | 'admin' }) {
  const endpoint = mode === 'admin' ? '/api/admin/auth/sessions' : '/api/public/auth/sessions';
  const [items, setItems] = useState<SessionItem[] | null>(null);
  const [status, setStatus] = useState('Loading signed-in devices…');
  const [note, setNote] = useState<{ tone: 'neutral' | 'error' | 'success'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('Loading signed-in devices…');
    try {
      const result =
        mode === 'admin'
          ? await adminGet<SessionResponse>(endpoint)
          : await apiGet<SessionResponse>(endpoint);
      setItems(result.items);
      setStatus('');
    } catch {
      setStatus('');
      setNote({ tone: 'error', text: 'We could not load your sessions. Try refreshing the page.' });
    }
  }, [endpoint, mode]);

  useEffect(() => {
    void load();
  }, [load]);

  async function revoke(session: SessionItem) {
    const confirmed = window.confirm(
      `Sign out ${deviceLabel(session)}? That device will need to sign in again with your password and second factor.`,
    );
    if (!confirmed) return;

    setBusy(session.id);
    setNote(null);
    try {
      if (mode === 'admin') {
        await adminSend(`${endpoint}/${encodeURIComponent(session.id)}`, 'DELETE');
      } else {
        await apiDelete(`${endpoint}/${encodeURIComponent(session.id)}`);
      }
      setItems((current) => (current ? current.filter((item) => item.id !== session.id) : current));
      setNote({
        tone: 'success',
        text: session.kind === 'web'
          ? 'Signed that browser out. If it was this one, your next page load will ask you to sign in again.'
          : 'Signed that device out. It will need to sign in again.',
      });
    } catch {
      setNote({ tone: 'error', text: 'We could not revoke that session. Try again.' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="n-card n-card-pad" aria-labelledby="sessions-title">
      <div className="n-session-head">
        <div>
          <h2 id="sessions-title" className="n-eyebrow">
            Devices &amp; sessions
          </h2>
          <p className="n-session-meta">
            Every browser and phone with access to your account. Sign out anything you do not recognise.
          </p>
        </div>
        <button type="button" className="n-btn n-btn-secondary" onClick={() => void load()} disabled={busy !== null}>
          <RefreshCw aria-hidden="true" size={16} />
          Refresh
        </button>
      </div>

      {status ? <p className="n-note">{status}</p> : null}

      {items ? (
        items.length === 0 ? (
          <p className="n-note">No active sessions are recorded for this account.</p>
        ) : (
          <ul className="n-session-list">
            {items.map((session) => (
              <li key={session.id} className="n-session-row">
                <span className="n-session-icon" aria-hidden="true">
                  {session.kind === 'mobile' ? <Smartphone size={18} /> : <Monitor size={18} />}
                </span>
                <div className="n-session-body">
                  <p className="n-session-name">
                    {deviceLabel(session)}
                    {session.trustedDevice ? <Pill tone="teal">Trusted</Pill> : null}
                  </p>
                  <p className="n-session-meta">
                    {[session.platform, session.kind === 'mobile' ? 'Mobile app' : 'Web']
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <p className="n-session-meta">
                    Last used {when(session.lastUsedAt ?? session.createdAt)} · Expires {when(session.expiresAt)}
                  </p>
                </div>
                <button
                  type="button"
                  className="n-btn n-btn-danger"
                  onClick={() => void revoke(session)}
                  disabled={busy !== null}
                  aria-label={`Revoke ${deviceLabel(session)}`}
                >
                  <Trash2 aria-hidden="true" size={15} />
                  {busy === session.id ? 'Revoking…' : 'Revoke'}
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {note ? (
        <div className="n-mt">
          <Note tone={note.tone}>{note.text}</Note>
        </div>
      ) : null}

      <p className="n-session-hint">
        <ShieldCheck aria-hidden="true" size={16} />
        <span>Changing your password or revoking a session signs out every device that uses it.</span>
      </p>
    </section>
  );
}
