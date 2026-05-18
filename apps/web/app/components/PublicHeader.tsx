import { Bell, CalendarDays, Home, UserRound } from 'lucide-react';
import { BrandMark } from './ui';

export function PublicHeader() {
  return (
    <>
      <header className="topbar public-topbar">
        <a className="brand-link" href="/" aria-label="Neara home">
          <BrandMark />
        </a>
        <a className="icon-button" href="/booking-lookup" aria-label="Find booking">
          <Bell aria-hidden="true" size={21} />
        </a>
      </header>
      <nav className="bottom-nav" aria-label="Primary">
        <a href="/">
          <Home aria-hidden="true" size={22} />
          <span>Home</span>
        </a>
        <a href="/booking-lookup">
          <CalendarDays aria-hidden="true" size={22} />
          <span>Bookings</span>
        </a>
        <a href="/profile">
          <UserRound aria-hidden="true" size={22} />
          <span>Profile</span>
        </a>
      </nav>
    </>
  );
}
