import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { bandKey } from '@/assessments/components/AssessmentResult';
import { NoorOrb } from '@/components/brand/NoorOrb';
import { MoodGlyph, MoodPicker } from '@/components/MoodPicker';
import { Badge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { Card, CardHeader, LinkCard } from '@/components/ui/Card';
import { GoalIcon, JournalIcon, PersonIcon, SessionsIcon, ToolkitIcon } from '@/components/ui/Icons';
import { PageLoader } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/States';
import { ROUTES } from '@/config/app';
import { useData } from '@/data/DataContext';
import { evaluateEntitlement } from '@/entitlements/entitlement';
import { useAsync } from '@/hooks/useAsync';
import { useI18n } from '@/i18n';
import { isToday, relativeDay, formatDuration } from '@/lib/dates';
import { suggestExercise } from '@/toolkit/exercises';

function greetingKey(): 'dashboard.greetingMorning' | 'dashboard.greetingAfternoon' | 'dashboard.greetingEvening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'dashboard.greetingMorning';
  if (hour < 18) return 'dashboard.greetingAfternoon';
  return 'dashboard.greetingEvening';
}

export function DashboardPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { repo, profile, entitlement, loading: accountLoading } = useData();
  const [moodBusy, setMoodBusy] = useState(false);
  const [moodError, setMoodError] = useState<string | null>(null);
  const [upgradeNoted, setUpgradeNoted] = useState(false);

  const data = useAsync(
    async () => {
      const [moods, sessions, goals, assessments, tools] = await Promise.all([
        repo.listMoodCheckins(7),
        repo.listSessions(),
        repo.listGoals(),
        repo.listAssessmentRuns(),
        repo.listSavedTools(),
      ]);
      const latest = sessions.find((s) => s.status === 'ended') ?? null;
      const latestSummary = latest ? await repo.getSummary(latest.id) : null;
      return { moods, sessions, goals, assessments, tools, latest, latestSummary };
    },
    [repo],
  );

  if (accountLoading || data.loading) return <PageLoader />;
  if (data.error || !data.data) return <ErrorState message={data.error ?? t('errors.loadFailed')} onRetry={() => void data.reload()} />;

  const { moods, sessions, goals, assessments, tools, latest, latestSummary } = data.data;
  const decision = entitlement ? evaluateEntitlement(entitlement) : null;
  const todayMood = moods.find((m) => isToday(m.createdAt)) ?? null;
  const activeGoals = goals.filter((g) => g.status === 'active').slice(0, 3);
  const suggested = suggestExercise(profile?.primaryConcerns ?? [], tools.map((s) => s.toolSlug));
  const latestPhq = assessments.find((a) => a.instrument === 'phq9');
  const latestGad = assessments.find((a) => a.instrument === 'gad7');

  async function submitMood(mood: number | null) {
    if (mood === null) return;
    setMoodBusy(true);
    setMoodError(null);
    try {
      const created = await repo.addMoodCheckin(mood, null);
      data.setData((prev) => (prev ? { ...prev, moods: [created, ...prev.moods].slice(0, 7) } : prev));
    } catch (err) {
      setMoodError(err instanceof Error ? err.message : t('errors.saveFailed'));
    } finally {
      setMoodBusy(false);
    }
  }

  const sessionsLeftLabel = decision
    ? decision.remaining === Number.POSITIVE_INFINITY
      ? null
      : decision.remaining === 0
        ? t('dashboard.noSessionsLeft')
        : decision.remaining === 1
          ? t('dashboard.sessionLeft')
          : t('dashboard.sessionsLeft', { count: decision.remaining })
    : null;

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <p className="text-sm text-ink-500">{t(greetingKey())}</p>
        <h1 className="text-3xl font-medium text-ink-900 sm:text-4xl">{profile?.displayName ?? t('common.appName')}</h1>
      </div>

      {/* Primary action */}
      {decision?.allowanceExhausted ? (
        <section className="relative overflow-hidden rounded-3xl bg-emerald-800 p-6 text-ivory-50 sm:p-8 grain">
          <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center">
            <NoorOrb state="paused" size="sm" />
            <div className="flex-1">
              <h2 className="text-2xl font-medium">{t('dashboard.upgradeTitle')}</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-ivory-50/80">{t('dashboard.upgradeBody')}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setUpgradeNoted(true)} disabled={upgradeNoted}>
                  {upgradeNoted ? t('dashboard.upgradeNoted') : t('dashboard.upgradeCta')}
                </Button>
                <LinkButton to={ROUTES.safety} variant="ghost" className="text-ivory-50 hover:bg-white/10">
                  {t('nav.safety')}
                </LinkButton>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => navigate(ROUTES.session)}
          className="group relative flex w-full items-center gap-5 overflow-hidden rounded-3xl bg-emerald-800 p-6 text-start text-ivory-50 shadow-lift transition-transform hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 sm:gap-8 sm:p-8 grain"
        >
          <div className="relative z-10 shrink-0">
            <NoorOrb state="ready" size="md" />
          </div>
          <div className="relative z-10 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ivory-50/70">Noor · {t('common.aiGuide')}</p>
            <h2 className="mt-1 text-3xl font-medium sm:text-4xl">{t('dashboard.talkToNoor')}</h2>
            <p className="mt-2 text-sm text-ivory-50/80">{t('dashboard.talkSubtitle')}</p>
            {sessionsLeftLabel && <p className="mt-3 inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-medium">{sessionsLeftLabel}</p>}
          </div>
        </button>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Today's check-in */}
        <Card>
          <CardHeader title={t('dashboard.todaysCheckin')} />
          {todayMood ? (
            <div className="flex items-center gap-3 text-ink-700">
              <MoodGlyph mood={todayMood.mood} className="h-8 w-8 text-emerald-700" />
              <p className="text-sm">{t('dashboard.checkinSaved')}</p>
            </div>
          ) : (
            <>
              <p className="mb-3 text-sm text-ink-500">{t('dashboard.checkinPrompt')}</p>
              <MoodPicker value={null} onChange={(m) => void submitMood(m)} disabled={moodBusy} compact />
              {moodError && <p className="mt-2 text-sm text-danger-600">{moodError}</p>}
            </>
          )}
        </Card>

        {/* Recent mood */}
        <Card>
          <CardHeader title={t('dashboard.recentMood')} />
          {moods.length === 0 ? (
            <p className="text-sm text-ink-500">{t('dashboard.noMood')}</p>
          ) : (
            <ul className="flex items-end gap-2">
              {[...moods].reverse().map((m) => (
                <li key={m.id} className="flex flex-col items-center gap-1 text-[10px] text-ink-500">
                  <MoodGlyph mood={m.mood} className="h-7 w-7 text-emerald-700" />
                  <span>{relativeDay(m.createdAt, locale).slice(0, 6)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Latest session */}
        <Card>
          <CardHeader
            title={t('dashboard.latestSession')}
            action={
              sessions.length > 0 && (
                <Link to={ROUTES.sessions} className="text-sm font-semibold text-emerald-700">
                  {t('dashboard.viewAll')}
                </Link>
              )
            }
          />
          {!latest ? (
            <p className="text-sm text-ink-500">{t('dashboard.noSessions')}</p>
          ) : (
            <Link to={ROUTES.sessionDetail(latest.id)} className="block rounded-xl transition-colors hover:bg-ink-900/[0.03]">
              <p className="font-medium text-ink-900">{latest.title ?? t('history.untitled')}</p>
              <p className="mt-0.5 text-xs text-ink-500">
                {relativeDay(latest.startedAt, locale)} · {formatDuration(latest.durationSeconds)}
              </p>
              {latestSummary && <p className="mt-2 line-clamp-2 text-sm text-ink-700">{latestSummary.whatWeTalkedAbout}</p>}
            </Link>
          )}
        </Card>

        {/* Goals */}
        <Card>
          <CardHeader
            title={t('dashboard.yourGoals')}
            action={
              <Link to={ROUTES.goals} className="text-sm font-semibold text-emerald-700">
                {t('dashboard.viewAll')}
              </Link>
            }
          />
          {activeGoals.length === 0 ? (
            <p className="text-sm text-ink-500">{t('dashboard.noGoals')}</p>
          ) : (
            <ul className="space-y-2">
              {activeGoals.map((g) => (
                <li key={g.id} className="flex items-start gap-2 text-sm text-ink-900">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-700" />
                  {g.title}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Suggested exercise */}
        <Card className="bg-gradient-to-br from-dusk-100/70 to-white">
          <CardHeader eyebrow={t('dashboard.suggestedExercise')} title={suggested.title} />
          <p className="text-sm leading-relaxed text-ink-700">{suggested.summary}</p>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-ink-500">{t('toolkit.minutes', { n: suggested.durationMinutes })}</span>
            <LinkButton to={ROUTES.toolkit} variant="soft" size="sm">
              {t('nav.toolkit')}
            </LinkButton>
          </div>
        </Card>

        {/* Assessment progress */}
        <Card>
          <CardHeader
            title={t('dashboard.assessmentProgress')}
            action={
              <Link to={ROUTES.assessment} className="shrink-0 text-sm font-semibold text-emerald-700">
                {assessments.length > 0 ? t('assessment.retake') : t('dashboard.takeAssessment')}
              </Link>
            }
          />
          {!latestPhq && !latestGad ? (
            <p className="text-sm text-ink-500">{t('dashboard.noAssessment')}</p>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-3">
                {[latestPhq, latestGad].filter(Boolean).map((run) => (
                  <div key={run!.id} className="rounded-xl bg-ivory-100 p-3">
                    <dt className="text-xs font-medium text-ink-500">{run!.instrument.toUpperCase()}</dt>
                    <dd className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="font-display text-2xl">{run!.totalScore}</span>
                      <Badge tone={run!.band === 'minimal' || run!.band === 'mild' ? 'sage' : 'dusk'}>{t(bandKey(run!.band))}</Badge>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 text-xs font-medium text-emerald-800">{t('common.notADiagnosis')}</p>
            </>
          )}
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <LinkCard to={ROUTES.sessions} title={t('dashboard.previousSessions')} icon={<SessionsIcon size={20} />} meta={`${sessions.filter((s) => s.status === 'ended').length}`} />
        <LinkCard to={ROUTES.journal} title={t('dashboard.journal')} icon={<JournalIcon size={20} />} />
        <LinkCard to={ROUTES.toolkit} title={t('dashboard.savedTools')} icon={<ToolkitIcon size={20} />} meta={`${tools.length}`} />
        <LinkCard to={ROUTES.humanSupport} title={t('dashboard.humanSupport')} icon={<PersonIcon size={20} />} />
        <LinkCard to={ROUTES.goals} title={t('nav.goals')} icon={<GoalIcon size={20} />} meta={`${activeGoals.length}`} className="sm:hidden" />
      </div>
    </div>
  );
}
