import { Link } from 'react-router-dom';
import { ROUTES } from '@/config/app';
import { env } from '@/config/env';
import { RESOURCES_VERIFIED_FOR_PRODUCTION, UNVERIFIED_RESOURCE_COUNT } from '@/safety/resources';

/**
 * Persistent developer notices, rendered as a slim strip at the very top of
 * the document (normal flow, so it never covers controls). Deliberately
 * visible in every environment: an unverified crisis-resource list must never
 * ship quietly.
 */
export function DevBanner() {
  const notices: Array<{ id: string; tone: 'warn' | 'dusk'; text: string; to?: string }> = [];

  if (!RESOURCES_VERIFIED_FOR_PRODUCTION) {
    notices.push({
      id: 'resources',
      tone: 'warn',
      text: `Development build — ${UNVERIFIED_RESOURCE_COUNT} crisis resource${UNVERIFIED_RESOURCE_COUNT === 1 ? '' : 's'} unverified. Do not deploy to production.`,
      to: ROUTES.safety,
    });
  }
  if (env.isDemoMode) {
    notices.push({
      id: 'demo',
      tone: 'dusk',
      text: 'Demo mode — data stays in this browser; no Supabase connected.',
    });
  }

  if (notices.length === 0) return null;

  return (
    <div
      role="status"
      aria-label="Development notices"
      dir="ltr"
      lang="en"
      className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 bg-ink-900 px-4 py-1.5 text-center text-[11px] font-medium text-ivory-100"
    >
      {notices.map((n) => {
        const dot = n.tone === 'warn' ? 'bg-warn-100' : 'bg-dusk-300';
        const content = (
          <>
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
            {n.text}
          </>
        );
        // The demo notice is secondary; keep the safety warning alone on small screens.
        const visibility = n.id === 'demo' ? 'hidden sm:inline-flex' : 'inline-flex';
        return n.to ? (
          <Link key={n.id} to={n.to} className={`${visibility} items-center gap-1.5 underline-offset-2 hover:underline`}>
            {content}
          </Link>
        ) : (
          <span key={n.id} className={`${visibility} items-center gap-1.5`}>
            {content}
          </span>
        );
      })}
    </div>
  );
}
