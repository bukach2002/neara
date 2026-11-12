import type { Metadata } from 'next';
import { LegalPage, LegalSection } from '../components/neara/legal-page';

export const metadata: Metadata = {
  title: 'Help and support',
  description: 'Get help with a Neara account, booking, or studio listing.',
};

export default function SupportPage() {
  return (
    <LegalPage eyebrow="Support" title="Help and support">
      <p className="n-body-lg">
        We answer support email within one business day. Write to{' '}
        <a href="mailto:support@neara.co.in">support@neara.co.in</a> from the address on your account and
        include your booking reference if you have one.
      </p>

      <LegalSection title="Delete your account">
        <p className="n-body">
          <strong>Customers:</strong> open the Neara app, go to <strong>Account</strong>, and choose{' '}
          <strong>Delete account</strong>. Your login is removed immediately. Bookings you already
          made stay with the studio for its records, so contact the studio to change an appointment.
        </p>
        <p className="n-body">
          <strong>Studio owners:</strong> open the Neara app, go to{' '}
          <strong>Studio &rarr; Business account</strong>, and choose{' '}
          <strong>Delete business account</strong>. This starts a support request so bookings,
          payouts, and staff records can be settled first. We complete deletion within 7 days.
        </p>
      </LegalSection>

      <LegalSection title="Change or cancel a booking">
        <p className="n-body">
          Contact the studio directly using the phone number or email on its Neara page. Studios set
          their own cancellation and rescheduling rules.
        </p>
      </LegalSection>

      <LegalSection title="Sign-in and password problems">
        <p className="n-body">
          Use <strong>Forgot password?</strong> on the sign-in screen to get a one-time code by
          email. If the code does not arrive, check your spam folder, then email support. Accounts
          are locked briefly after repeated failed attempts.
        </p>
      </LegalSection>

      <LegalSection title="Privacy requests">
        <p className="n-body">
          To access, correct, or erase personal information, email{' '}
          <a href="mailto:support@neara.co.in">support@neara.co.in</a>. See our{' '}
          <a href="/privacy">privacy policy</a> for what we collect and how long we keep it.
        </p>
      </LegalSection>

      <LegalSection title="Report a problem">
        <p className="n-body">
          Tell us what happened, what you expected, your device model, and the approximate time. Do
          not send passwords or one-time codes. For security issues, use the same address with
          &ldquo;Security&rdquo; in the subject.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
