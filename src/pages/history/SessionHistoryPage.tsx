import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { LinkButton } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageLoader } from '@/components/ui/Spinner';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { ROUTES } from '@/config/app';
import { useData } from '@/data/DataContext';
import { useAsync } from '@/hooks/useAsync';
import { useI18n } from '@/i18n';
import { formatDate, formatDuration } from '@/lib/dates';

const KNOWN_TAGS = [
  'anxiety',
  'low_mood',
  'stress',
  'overthinking',
  'grief',
  'relationships',
  'someone_to_talk_to',
  'something_else',
  'safety',
] as const;
type KnownTag = (typeof KNOWN_TAGS)[number];

function isKnownTag(tag: string): tag is KnownTag {
  return (KNOWN_TAGS as readonly string[]).includes(tag);
}

export function SessionHistoryPage() {
  const { t, locale } = useI18n();
  const { repo } = useData();
  const sessions = useAsync(() => repo.listSessions(), [repo]);

  return (
    <div>
      <PageHeader title={t('history.title')} subtitle={t('history.subtitle')} />
      {sessions.loading && <PageLoader />}
      {sessions.error && <ErrorState message={sessions.error} onRetry={() => void sessions.reload()} />}
      {sessions.data && sessions.data.filter((s) => s.status !== 'active').length === 0 && (
        <EmptyState title={t('history.empty')} body={t('dashboard.noSessions')} action={<LinkButton to={ROUTES.session}>{t('nav.talk')}</LinkButton>} className="card" />
      )}
      {sessions.data && (
        <ul className="space-y-3">
          {sessions.data
            .filter((s) => s.status !== 'active')
            .map((s) => (
              <li key={s.id}>
                <Link to={ROUTES.sessionDetail(s.id)} className="card block p-5 transition-all hover:-translate-y-0.5 hover:shadow-lift motion-reduce:hover:translate-y-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-ink-900">{s.title ?? t('history.untitled')}</p>
                      <p className="mt-0.5 text-xs text-ink-500">
                        {formatDate(s.startedAt, locale)} · {formatDuration(s.durationSeconds)} · {s.mode}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {s.topicTags.map((tag) => (
                        <Badge key={tag} tone={tag === 'safety' ? 'dusk' : 'sage'}>
                          {safeTag(tag, t)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}

export function safeTag(tag: string, t: ReturnType<typeof useI18n>['t']): string {
  return isKnownTag(tag) ? t(`history.tag_${tag}`) : tag.replace(/_/g, ' ');
}
