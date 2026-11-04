'use client';

import { ArrowLeft, CalendarDays, Compass, UserRound } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

const tabs = [
  { href: '/', label: 'Discover', icon: Compass },
  { href: '/booking-lookup', label: 'Bookings', icon: CalendarDays },
  { href: '/profile', label: 'Profile', icon: UserRound },
];

function isActive(pathname: string, href: string) {
  if (href === '/') {
    return pathname === '/' || pathname.startsWith('/search') || pathname.startsWith('/tenants');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TopNav() {
  const pathname = usePathname() ?? '/';

  return (
    <nav className="n-bar-nav" aria-label="Primary">
      {tabs.map(({ href, label }) => (
        <a href={href} key={href} aria-current={isActive(pathname, href) ? 'page' : undefined}>
          {label}
        </a>
      ))}
    </nav>
  );
}

export function BottomTabs() {
  const pathname = usePathname() ?? '/';

  return (
    <nav className="n-tabbar" aria-label="Primary">
      <div className="n-tabbar-inner">
        {tabs.map(({ href, label, icon: Icon }) => (
          <a className="n-tab" href={href} key={href} aria-current={isActive(pathname, href) ? 'page' : undefined}>
            <Icon aria-hidden="true" size={20} />
            <span>{label}</span>
          </a>
        ))}
      </div>
    </nav>
  );
}

export function BackButton({ fallbackHref = '/' }: { fallbackHref?: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      className="n-icon-btn"
      aria-label="Go back"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
          return;
        }
        router.push(fallbackHref);
      }}
    >
      <ArrowLeft aria-hidden="true" size={22} />
    </button>
  );
}
