'use client';

import { Phone, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiPost, type ApiError } from '../../lib/api';
import { Note, Pill } from './primitives';

type Channel = 'sms' | 'whatsapp';

const RESEND_SECONDS = 30;

function friendlyError(error: unknown, action: 'send' | 'confirm') {
  const status = (error as ApiError | undefined)?.status;
  if (status === 429) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  if (status === 503) {
    return 'Text messages are not configured yet. Please try again later or contact support.';
  }
  return action === 'send'
    ? 'We could not send a code to that number. Check it and try again.'
    : 'That code is wrong or has expired. Request a new one.';
}

/**
 * Confirms the mobile number already on the customer account over SMS or
 * WhatsApp. The number itself is not editable here: changing it requires the
 * studio or support so booking records stay matched.
 */
export function PhoneVerificationCard({
  identifier,
  verified,
  onVerified,
}: {
  identifier: string | null;
  verified: boolean;
  onVerified: () => void;
}) {
  const [channel, setChannel] = useState<Channel>('sms');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'send' | 'confirm' | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const handle = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(handle);
  }, [cooldown]);

  async function send() {
    if (!identifier) return;
    setBusy('send');
    setError(null);
    setNote(null);
    try {
      await apiPost('/api/public/auth/verify/phone/request', { identifier, channel });
      setSent(true);
      setCooldown(RESEND_SECONDS);
      setNote(
        `We sent a 6-digit code to ${identifier} ${channel === 'whatsapp' ? 'on WhatsApp' : 'by SMS'}. It expires in 10 minutes.`,
      );
    } catch (caught) {
      setError(friendlyError(caught, 'send'));
    } finally {
      setBusy(null);
    }
  }

  async function confirm() {
    if (!identifier) return;
    const otp = code.trim();
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit code from the message.');
      return;
    }

    setBusy('confirm');
    setError(null);
    try {
      await apiPost('/api/public/auth/verify/phone/confirm', { identifier, otp, channel });
      setSent(false);
      setCode('');
      setNote('Your mobile number is confirmed.');
      onVerified();
    } catch (caught) {
      setError(friendlyError(caught, 'confirm'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="n-card n-card-pad" aria-labelledby="phone-verification-title">
      <h2 id="phone-verification-title" className="n-eyebrow">
        Mobile number
      </h2>

      {!identifier ? (
        <p className="n-body">
          No mobile number is on this account. Add one with the studio or support, then return here to confirm
          it.
        </p>
      ) : (
        <>
          <p className="n-session-name">
            <Phone aria-hidden="true" size={16} />
            {identifier}
            {verified ? <Pill tone="teal">Verified</Pill> : <Pill>Not verified</Pill>}
          </p>

          {verified ? (
            <p className="n-session-meta">
              This number is confirmed. We use it only to match your bookings and to reach you about
              appointments.
            </p>
          ) : (
            <>
              <p className="n-session-meta">
                {sent
                  ? 'Enter the code below to prove this number belongs to you.'
                  : 'Confirm this number with a one-time code. Neara never shows it publicly.'}
              </p>

              {!sent ? (
                <div className="n-confirm-actions n-mt" role="group" aria-label="Delivery channel">
                  <button
                    type="button"
                    className={channel === 'sms' ? 'n-btn' : 'n-btn n-btn-secondary'}
                    aria-pressed={channel === 'sms'}
                    onClick={() => setChannel('sms')}
                    disabled={busy !== null}
                  >
                    SMS
                  </button>
                  <button
                    type="button"
                    className={channel === 'whatsapp' ? 'n-btn' : 'n-btn n-btn-secondary'}
                    aria-pressed={channel === 'whatsapp'}
                    onClick={() => setChannel('whatsapp')}
                    disabled={busy !== null}
                  >
                    WhatsApp
                  </button>
                </div>
              ) : null}

              {sent ? (
                <label className="n-field n-mt">
                  <span className="n-field-label">6-digit code</span>
                  <span className="n-input-wrap">
                    <input
                      className="n-input"
                      value={code}
                      onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="123456"
                      aria-label="6-digit verification code"
                    />
                  </span>
                </label>
              ) : null}

              <div className="n-confirm-actions n-mt">
                {sent ? (
                  <button
                    type="button"
                    className="n-btn"
                    onClick={() => void confirm()}
                    disabled={busy !== null || code.length !== 6}
                  >
                    <ShieldCheck aria-hidden="true" size={16} />
                    {busy === 'confirm' ? 'Confirming…' : 'Confirm number'}
                  </button>
                ) : (
                  <button type="button" className="n-btn" onClick={() => void send()} disabled={busy !== null}>
                    <Phone aria-hidden="true" size={16} />
                    {busy === 'send' ? 'Sending…' : 'Send code'}
                  </button>
                )}
                {sent ? (
                  <button
                    type="button"
                    className="n-btn n-btn-secondary"
                    onClick={() => void send()}
                    disabled={busy !== null || cooldown > 0}
                  >
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                  </button>
                ) : null}
              </div>
            </>
          )}

          {note ? (
            <div className="n-mt">
              <Note tone={verified ? 'success' : 'neutral'}>{note}</Note>
            </div>
          ) : null}
          {error ? (
            <div className="n-mt">
              <Note tone="error">{error}</Note>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
