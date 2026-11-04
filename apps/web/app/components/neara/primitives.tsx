import { ReactNode } from 'react';

export function Note({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'error' | 'success';
}) {
  return (
    <p className="n-note" data-tone={tone} role={tone === 'error' ? 'alert' : undefined}>
      {children}
    </p>
  );
}

export function Pill({
  children,
  tone = 'neutral',
  dot = false,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'teal' | 'cobalt';
  dot?: boolean;
}) {
  const classes = ['n-pill', tone === 'teal' ? 'n-pill-teal' : '', tone === 'cobalt' ? 'n-pill-cobalt' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes}>
      {dot ? <span className="n-pill-dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
