import { ReactNode } from 'react';
import { UserRound } from 'lucide-react';
import { BackButton, BottomTabs, TopNav } from './client-bits';

export function AppShell({
  children,
  tabbar = true,
  sticky = false,
}: {
  children: ReactNode;
  tabbar?: boolean;
  sticky?: boolean;
}) {
  const classes = ['n-app', tabbar ? '' : 'n-app-tabless', sticky ? 'n-app-sticky' : ''].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {children}
      {tabbar ? <BottomTabs /> : null}
    </div>
  );
}

export function AppBar({
  variant = 'brand',
  title,
  profile = true,
}: {
  variant?: 'brand' | 'back';
  title?: string;
  profile?: boolean;
}) {
  return (
    <header className="n-bar">
      <div className="n-bar-inner">
        {variant === 'brand' ? (
          <a className="n-brand" href="/" aria-label="Neara home">
            <span className="n-brand-mark" aria-hidden="true">
              N
            </span>
            <span>Neara</span>
          </a>
        ) : (
          <BackButton />
        )}
        {variant === 'brand' ? <TopNav /> : null}
        {variant === 'back' && title ? <h1 className="n-bar-title">{title}</h1> : null}
        {profile ? (
          <div className="n-bar-actions">
            <a className="n-avatar" href="/profile" aria-label="Your profile">
              <UserRound aria-hidden="true" size={17} />
            </a>
          </div>
        ) : null}
      </div>
    </header>
  );
}

export function SectionHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="n-section-head">
      <h2>{title}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="n-empty">
      <h3>{title}</h3>
      {children}
    </div>
  );
}
