import { ReactNode } from 'react';

type PropsWithClass = {
  children?: ReactNode;
  className?: string;
};

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={cx('brand-lockup', compact && 'brand-lockup-compact')}>
      <span className="brand-mark">N</span>
      {!compact && <span>Neara</span>}
    </span>
  );
}

export function Card({ children, className }: PropsWithClass) {
  return <div className={cx('ui-card', className)}>{children}</div>;
}

export function SectionHeader({
  eyebrow,
  title,
  action,
  children,
  className,
}: PropsWithClass & { eyebrow?: string; title: string; action?: ReactNode }) {
  return (
    <div className={cx('section-heading', className)}>
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {children}
      </div>
      {action}
    </div>
  );
}

export function Notice({ children, tone = 'neutral' }: PropsWithClass & { tone?: 'neutral' | 'error' | 'success' }) {
  return <p className={cx('notice', tone === 'error' && 'error', tone === 'success' && 'success')}>{children}</p>;
}

export function Badge({ children, tone }: PropsWithClass & { tone?: string }) {
  return <span className={cx('badge', tone)}>{children}</span>;
}
