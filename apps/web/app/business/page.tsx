import type { Metadata } from 'next';
import { BusinessSignupClient } from './BusinessSignupClient';

export const metadata: Metadata = {
  title: 'List your business',
  description: 'Create a business account, reserve your Neara page address and start taking bookings in six steps.',
};

export default function BusinessSignupPage() {
  return (
    <div className="n-app n-app-tabless">
      <BusinessSignupClient />
    </div>
  );
}
