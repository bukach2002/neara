import type { Metadata } from 'next';
import './styles.css';

export const metadata: Metadata = {
  title: 'Neara',
  description: 'Find and book local appointments',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
