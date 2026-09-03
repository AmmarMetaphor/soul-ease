import { Link } from 'react-router-dom';
import { ROUTES } from '@/config/app';
import { cn } from '@/lib/cn';

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn('relative inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-ivory-50 ring-1 ring-ink-900/5', className)}
      aria-hidden="true"
    >
      <span className="h-4 w-4 rounded-full bg-[radial-gradient(circle_at_40%_35%,#b8c9b3_0%,#4f7d67_60%,#2f5a49_100%)]" />
      <span className="absolute inset-[3px] rounded-full border border-dusk-300/60" />
    </span>
  );
}

export function Logo({ to = ROUTES.home, className, compact = false }: { to?: string; className?: string; compact?: boolean }) {
  return (
    <Link to={to} className={cn('inline-flex items-center gap-2.5 text-ink-900', className)} aria-label="Soul Ease home">
      <LogoMark />
      {!compact && <span className="font-display text-lg font-medium tracking-tight">Soul Ease</span>}
    </Link>
  );
}
