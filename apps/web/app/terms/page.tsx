import type { Metadata } from 'next';
import { LegalPage, LegalSection } from '../components/neara/legal-page';

export const metadata: Metadata = {
  title: 'Terms of use',
  description: 'The rules for using Neara as a customer or a studio.',
};

export default function TermsPage() {
  return (
    <LegalPage eyebrow="Legal" title="Terms of use" updated="5 November 2026">
      <p className="n-body-lg">
        These terms govern your use of the Neara app and neara.co.in. By creating an account or using
        the service, you agree to them. If you do not agree, do not use Neara.
      </p>

      <LegalSection title="Using Neara">
        <ul className="n-legal-list">
          <li>You must be at least 18 to create an account. Minors may attend appointments with a guardian.</li>
          <li>Give accurate details and keep your password and device secure. You are responsible for activity under your account.</li>
          <li>One person should not operate multiple customer accounts to abuse promotions or bookings.</li>
          <li>We may suspend or close accounts that break these terms or put other users at risk.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Bookings are with the studio">
        <p className="n-body">
          Neara helps you find studios and book appointments. The appointment itself is an agreement
          between you and the studio. Studios set their services, prices, availability, and
          cancellation rules, and they provide the service. Neara does not provide salon, clinic, or
          wellness services and does not take payment for appointments.
        </p>
        <p className="n-body">
          If you need to change or cancel an appointment, contact the studio directly. Repeated
          no-shows or fake bookings may lead to your account being limited.
        </p>
      </LegalSection>

      <LegalSection title="Studio accounts">
        <p className="n-body">
          By creating a business account you confirm you are authorised to list that business. You
          are responsible for keeping the listing accurate, honouring bookings you accept, responding
          to customers, and complying with the laws that apply to your business. Neara may review,
          suspend, or remove a listing that is misleading, inactive, or unlawful.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p className="n-body">You must not:</p>
        <ul className="n-legal-list">
          <li>Scrape, copy, or bulk-download data, or attempt to bypass rate limits or access controls.</li>
          <li>Create fake bookings, impersonate another person or business, or misrepresent your services.</li>
          <li>Upload malware, or content that is illegal, hateful, harassing, or infringes someone else&rsquo;s rights.</li>
          <li>Use Neara to send spam or to interfere with the app, the API, or other users.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Your content">
        <p className="n-body">
          You keep ownership of the content you upload. You give Neara a non-exclusive licence to
          host, display, and resize it so the app and website can show your listing. You confirm you
          have the rights to share it. We may remove content that breaks these terms.
        </p>
      </LegalSection>

      <LegalSection title="Availability and changes">
        <p className="n-body">
          We work to keep Neara available, but the service is provided &ldquo;as is&rdquo; and may
          change, pause, or stop. We may update these terms; the date above shows the current
          version. Continuing to use Neara after an update means you accept the revised terms.
        </p>
      </LegalSection>

      <LegalSection title="Liability">
        <p className="n-body">
          To the extent permitted by law, Neara is not liable for indirect or consequential loss, or
          for the acts and omissions of studios and customers. Nothing in these terms limits rights
          that cannot be limited under applicable law.
        </p>
      </LegalSection>

      <LegalSection title="Governing law">
        <p className="n-body">
          These terms are governed by the laws of India, and the courts of Pune, Maharashtra have
          exclusive jurisdiction over disputes.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p className="n-body">
          Questions about these terms? Email{' '}
          <a href="mailto:support@neara.co.in">support@neara.co.in</a> or visit the{' '}
          <a href="/support">support page</a>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
