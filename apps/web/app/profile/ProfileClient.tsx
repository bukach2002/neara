'use client';

import { LogIn, LogOut, Mail, Phone, Trash2, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiDelete, apiGet, apiPost, CustomerUser } from '../lib/api';
import { Notice } from '../components/ui';

export function ProfileClient() {
  const [customer, setCustomer] = useState<CustomerUser | null>(null);
  const [status, setStatus] = useState('Loading profile...');

  useEffect(() => {
    apiGet<{ user: CustomerUser }>('/api/public/auth/me')
      .then((result) => {
        setCustomer(result.user);
        setStatus('');
      })
      .catch(() => {
        window.location.href = `/login?returnTo=${encodeURIComponent('/profile')}`;
      });
  }, []);

  if (!customer) {
    return <Notice>{status}</Notice>;
  }

  async function logout() {
    setStatus('Logging out...');
    await apiPost('/api/public/auth/logout', {}).catch(() => null);
    window.location.href = '/login';
  }

  async function deleteAccount() {
    const confirmed = window.confirm('Delete your Neara account? Your login details will be removed and you will be signed out.');
    if (!confirmed) return;
    setStatus('Deleting account...');
    try {
      await apiDelete('/api/public/auth/me');
      window.location.href = '/';
    } catch {
      setStatus('Could not delete account. Please try again.');
    }
  }

  return (
    <>
      <section className="profile-card">
        <div className="profile-avatar" aria-hidden="true">
          <UserRound size={34} />
        </div>
        <div>
          <p className="eyebrow">Logged in</p>
          <h2>{customer.name}</h2>
          <div className="profile-details">
            <span>
              <Mail aria-hidden="true" size={17} />
              {customer.email ?? 'No email saved'}
            </span>
            <span>
              <Phone aria-hidden="true" size={17} />
              {customer.mobileNumber ?? 'No mobile number saved'}
            </span>
          </div>
          <a className="button-link" href="/booking-lookup">
            <LogIn aria-hidden="true" size={17} />
            View bookings
          </a>
        </div>
      </section>

      <section className="profile-actions" aria-label="Account actions">
        <button type="button" onClick={logout}>
          <LogOut aria-hidden="true" size={18} />
          Logout
        </button>
        <button type="button" className="danger-action" onClick={deleteAccount}>
          <Trash2 aria-hidden="true" size={18} />
          Delete account
        </button>
      </section>
      {status && <Notice tone={status.startsWith('Could') ? 'error' : 'neutral'}>{status}</Notice>}
    </>
  );
}
