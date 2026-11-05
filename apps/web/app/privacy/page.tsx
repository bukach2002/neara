import type { Metadata } from 'next';
import { LegalPage, LegalSection } from '../components/neara/legal-page';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'How Neara collects, uses, and protects personal information.',
};

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="Legal" title="Privacy policy" updated="5 November 2026">
      <p className="n-body-lg">
        Neara is an appointment booking platform for studios and their customers in India. This
        page explains what we collect, why we collect it, and the choices you have. It applies to
        the Neara mobile app and to neara.co.in.
      </p>

      <LegalSection title="Who we are">
        <p className="n-body">
          Neara (&ldquo;Neara&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) operates the app and
          website. For privacy questions, contact{' '}
          <a href="mailto:support@neara.co.in">support@neara.co.in</a>.
        </p>
      </LegalSection>

      <LegalSection title="What we collect">
        <ul className="n-legal-list">
          <li>
            <strong>Account details.</strong> Your name, email address, mobile number, and a hashed
            password. We never store your password in readable form.
          </li>
          <li>
            <strong>Bookings.</strong> The studio, service, expert, date and time you choose, any
            note you add, and the contact details you give for that booking.
          </li>
          <li>
            <strong>Studio listing details.</strong> For business accounts: the business name, page
            address, address and location, public contact details, staff display names, services,
            working hours, and any images you upload.
          </li>
          <li>
            <strong>Device and security data.</strong> A session identifier held in the iOS Keychain
            or Android Keystore, plus IP address, request metadata, and audit records used for rate
            limiting, abuse prevention, and account security.
          </li>
          <li>
            <strong>Communications.</strong> The emails we send you (such as booking confirmations,
            cancellations, and reminders) and their delivery status.
          </li>
        </ul>
        <p className="n-body">
          We do not collect payment card details. Any payment for an appointment is made directly
          with the studio.
        </p>
      </LegalSection>

      <LegalSection title="How we use it">
        <ul className="n-legal-list">
          <li>Create and secure your account, and decide which workspace you see.</li>
          <li>Show studios, services, experts, and live availability, and record your bookings.</li>
          <li>Give studio owners the tools to manage their listing, services, and appointments.</li>
          <li>Send transactional email about your account and bookings.</li>
          <li>Prevent fraud, abuse, and attacks, and keep audit records of administrative actions.</li>
          <li>Respond to support requests and meet legal obligations.</li>
        </ul>
        <p className="n-body">
          We do not sell personal information, show advertising, use advertising identifiers, or
          track you across other apps or websites.
        </p>
      </LegalSection>

      <LegalSection title="Who we share it with">
        <ul className="n-legal-list">
          <li>
            <strong>The studio you book with.</strong> It receives the booking details it needs to
            provide the appointment, including the name and contact details you supplied.
          </li>
          <li>
            <strong>Service providers.</strong> Vendors that host the app and database, deliver
            email, run rate limiting and background jobs, and store uploaded images. They process
            data on our instructions.
          </li>
          <li>
            <strong>Legal and safety.</strong> Where required by law, a valid legal request, or to
            protect the rights and safety of Neara, studios, or customers.
          </li>
          <li>
            <strong>Business transfers.</strong> If Neara is merged or acquired, information may
            transfer as part of that transaction, under this policy.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Cookies and sessions">
        <p className="n-body">
          The website uses a session cookie to keep you signed in. The mobile app never uses browser
          cookies for advertising; it stores its session in the device&rsquo;s encrypted Keychain or
          Keystore. We do not use advertising or cross-site tracking cookies.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <p className="n-body">
          Account and listing data is kept while your account is open. When a customer account is
          deleted, the login is removed and personal details are anonymised; booking records stay
          with the studio for its accounting and legal records. Security and audit logs are kept
          only as long as needed for those purposes. Backups are rotated on a fixed schedule.
        </p>
      </LegalSection>

      <LegalSection title="Your choices and rights">
        <p className="n-body">
          Subject to applicable law, including India&rsquo;s Digital Personal Data Protection Act,
          2023, you can ask to access, correct, or erase your personal information, withdraw consent,
          or raise a grievance. In the customer app, open <strong>Account &rarr; Delete account</strong>{' '}
          to delete your login immediately. Studio owners can request deletion from{' '}
          <strong>Studio &rarr; Business account</strong>. You can also email{' '}
          <a href="mailto:support@neara.co.in">support@neara.co.in</a>; we respond within 30 days.
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <p className="n-body">
          Traffic is encrypted with HTTPS, passwords are hashed, session material is stored in the
          device&rsquo;s encrypted storage, and administrative actions are authorised by the API and
          written to an audit log. No system is completely secure, so please use a unique password
          and tell us promptly if you suspect unauthorised access.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p className="n-body">
          Neara is not directed to children under 13. If you are under 18, use the service with the
          involvement of a parent or guardian.
        </p>
      </LegalSection>

      <LegalSection title="Changes to this policy">
        <p className="n-body">
          We may update this policy as the service changes. The date at the top shows the current
          version, and material changes will be announced in the app or by email.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
