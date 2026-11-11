'use client';

import {
  ChevronRight,
  Compass,
  KeyRound,
  LogOut,
  Mail,
  Phone,
  ShieldCheck,
  Smartphone,
  Ticket,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { apiDelete, apiGet, apiPost, CustomerUser } from '../lib/api';
import { initials } from '../components/neara/format';
import { PhoneVerificationCard } from '../components/neara/phone-verification';
import { Note, Pill } from '../components/neara/primitives';

export function ProfileClient() {
  const [customer, setCustomer] = useState<CustomerUser | null>(null);
  const [status, setStatus] = useState('Loading your account…');
  const [busy, setBusy] = useState(false);

  const refreshCustomer = useCallback(() => {
    apiGet<{ user: CustomerUser }>('/api/public/auth/me')
      .then((result) => {
        setCustomer(result.user);
        setStatus('');
      })
      .catch(() => {
        window.location.href = `/login?returnTo=${encodeURIComponent('/profile')}`;
      });
  }, []);

  useEffect(() => {
    refreshCustomer();
  }, [refreshCustomer]);

  async function logout() {
    setBusy(true);
    setStatus('Signing out…');
    await apiPost('/api/public/auth/logout', {}).catch(() => null);
    window.location.href = '/login';
  }

  async function deleteAccount() {
    const confirmed = window.confirm(
      'Delete your Neara account? Your login details are removed and you are signed out. Contact the studio to change an existing appointment.',
    );
    if (!confirmed) return;
    setBusy(true);
    setStatus('Deleting account…');
    try {
      await apiDelete('/api/public/auth/me');
      window.location.href = '/';
    } catch {
      setStatus('We could not delete the account. Please try again.');
      setBusy(false);
    }
  }

  if (!customer) {
    return (
      <main className="n-main">
        <Note>{status}</Note>
      </main>
    );
  }

  return (
    <main className="n-main">
      <section className="n-profile-head" aria-labelledby="profile-name">
        <span className="n-avatar-lg" aria-hidden="true">
          {initials(customer.name)}
        </span>
        <div className="n-profile-identity">
          <p className="n-eyebrow">Neara account</p>
          <h1 id="profile-name">{customer.name}</h1>
          <div className="n-profile-contact">
            {customer.email ? (
              <span>
                <Mail aria-hidden="true" size={13} /> {customer.email}
              </span>
            ) : null}
            {customer.mobileNumber ? (
              <span>
                <Phone aria-hidden="true" size={13} /> {customer.mobileNumber}
              </span>
            ) : null}
          </div>
          <div>
            <Pill dot>Signed in</Pill>
          </div>
        </div>
      </section>

      <div className="n-mt-lg">
        <PhoneVerificationCard
          identifier={customer.mobileNumber}
          verified={Boolean(customer.mobileVerified)}
          onVerified={refreshCustomer}
        />
      </div>

      <section className="n-card n-mt-lg n-card-pad" aria-labelledby="profile-mfa">
        <h2 id="profile-mfa" className="n-eyebrow">
          Two-factor authentication
        </h2>
        <p className="n-session-name">
          <ShieldCheck aria-hidden="true" size={16} />
          Authenticator app
          {customer.mfaEnabled ? <Pill tone="teal">Enabled</Pill> : <Pill>Not enabled</Pill>}
        </p>
        <p className="n-session-meta">
          {customer.mfaEnabled
            ? 'Neara asks for your authenticator code when this account signs in to the admin console.'
            : 'TOTP two-factor is available for platform and workspace admins in the admin console. Customer accounts are protected by one-time email sign-in codes and mobile verification.'}
        </p>
      </section>

      <section className="n-card n-mt-lg" aria-labelledby="profile-shortcuts">
        <div className="n-card-pad">
          <h2 id="profile-shortcuts" className="n-eyebrow">
            Shortcuts
          </h2>
          <div className="n-shortcuts">
            <a className="n-shortcut" href="/booking-lookup">
              <span className="n-icon-tile" aria-hidden="true">
                <Ticket size={18} />
              </span>
              <span className="n-shortcut-body">
                <span className="n-shortcut-title">My appointments</span>
                <span className="n-shortcut-sub">Find a booking by reference and phone</span>
              </span>
              <ChevronRight className="n-chevron" aria-hidden="true" size={18} />
            </a>
            <a className="n-shortcut" href="/profile/sessions">
              <span className="n-icon-tile" aria-hidden="true">
                <Smartphone size={18} />
              </span>
              <span className="n-shortcut-body">
                <span className="n-shortcut-title">Devices &amp; sessions</span>
                <span className="n-shortcut-sub">Review browsers and phones signed in to your account</span>
              </span>
              <ChevronRight className="n-chevron" aria-hidden="true" size={18} />
            </a>
            <a className="n-shortcut" href="/forgot-password">
              <span className="n-icon-tile" aria-hidden="true">
                <KeyRound size={18} />
              </span>
              <span className="n-shortcut-body">
                <span className="n-shortcut-title">Sign-in &amp; password</span>
                <span className="n-shortcut-sub">Reset your password with a one-time code</span>
              </span>
              <ChevronRight className="n-chevron" aria-hidden="true" size={18} />
            </a>
            <a className="n-shortcut" href="/">
              <span className="n-icon-tile" aria-hidden="true">
                <Compass size={18} />
              </span>
              <span className="n-shortcut-body">
                <span className="n-shortcut-title">Discover studios</span>
                <span className="n-shortcut-sub">Salons, clinics, wellness and consulting in Pune</span>
              </span>
              <ChevronRight className="n-chevron" aria-hidden="true" size={18} />
            </a>
          </div>
        </div>
      </section>

      <section className="n-card n-mt-lg n-card-pad" aria-label="Account actions">
        <p className="n-receipt-assurance">
          <ShieldCheck aria-hidden="true" size={16} />
          <span>
            Neara keeps only the details needed to confirm and support appointments. Deleting your account
            removes your login; existing studio records stay with the studio.
          </span>
        </p>
        <div className="n-confirm-actions n-mt">
          <button type="button" className="n-btn n-btn-secondary" onClick={logout} disabled={busy}>
            <LogOut aria-hidden="true" size={17} />
            Sign out
          </button>
          <button type="button" className="n-btn n-btn-danger" onClick={deleteAccount} disabled={busy}>
            <Trash2 aria-hidden="true" size={17} />
            Delete account
          </button>
        </div>
        {status ? (
          <div className="n-mt">
            <Note tone={status.startsWith('We could not') ? 'error' : 'neutral'}>{status}</Note>
          </div>
        ) : null}
      </section>

    </main>
  );
}
