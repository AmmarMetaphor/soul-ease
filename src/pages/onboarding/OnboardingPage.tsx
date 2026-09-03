import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { FocusLayout } from '@/components/layout/FocusLayout';
import { PageLoader } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/States';
import { ROUTES } from '@/config/app';
import { useData } from '@/data/DataContext';
import type { ConcernId, InteractionMode } from '@/data/types';
import { useI18n } from '@/i18n';
import { nowIso } from '@/lib/ids';
import type { ConsentState } from '@/memory/permissions';
import { AgeStep } from './steps/AgeStep';
import { ConcernsStep } from './steps/ConcernsStep';
import { ConsentStep } from './steps/ConsentStep';
import { InteractionStep } from './steps/InteractionStep';
import { MeetNoorStep } from './steps/MeetNoorStep';
import { ScreeningStep } from './steps/ScreeningStep';
import { WelcomeStep } from './steps/WelcomeStep';

export type OnboardingStep = 'welcome' | 'age' | 'consent' | 'interaction' | 'concerns' | 'screening' | 'meet';

const ORDER: OnboardingStep[] = ['welcome', 'age', 'consent', 'interaction', 'concerns', 'screening', 'meet'];

export function OnboardingPage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { profile, consent, loading, error, refresh, updateProfile, setConsent } = useData();
  const { t, locale } = useI18n();
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [busy, setBusy] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);

  // Members who already finished never see onboarding again.
  useEffect(() => {
    if (profile?.onboardingCompletedAt) navigate(ROUTES.dashboard, { replace: true });
  }, [profile?.onboardingCompletedAt, navigate]);

  const stepIndex = ORDER.indexOf(step);
  const stepLabel = useMemo(
    () => (step === 'welcome' ? null : t('onboarding.stepOf', { current: stepIndex, total: ORDER.length - 1 })),
    [step, stepIndex, t],
  );

  async function run(action: () => Promise<void>, next: OnboardingStep) {
    setBusy(true);
    setStepError(null);
    try {
      await action();
      setStep(next);
    } catch (err) {
      setStepError(err instanceof Error ? err.message : t('errors.saveFailed'));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <PageLoader />;
  if (error || !profile) {
    return (
      <FocusLayout>
        <ErrorState message={error ?? t('errors.loadFailed')} onRetry={() => void refresh()} />
      </FocusLayout>
    );
  }

  return (
    <FocusLayout right={stepLabel ? <span className="text-xs font-medium text-ink-500">{stepLabel}</span> : undefined}>
      {stepError && <ErrorState message={stepError} className="mb-6" />}

      {step === 'welcome' && <WelcomeStep onContinue={() => setStep(profile.ageConfirmedAt ? 'consent' : 'age')} />}

      {step === 'age' && (
        <AgeStep
          busy={busy}
          onEligible={() => void run(async () => void (await updateProfile({ ageConfirmedAt: nowIso() })), 'consent')}
          onExit={() => void signOut().then(() => navigate(ROUTES.home, { replace: true }))}
        />
      )}

      {step === 'consent' && (
        <ConsentStep
          initial={consent}
          busy={busy}
          onBack={() => setStep('age')}
          onAccept={(choices: ConsentState) =>
            void run(async () => {
              await setConsent('core_terms_and_ai_disclosure', true);
              await setConsent('transcript_storage', choices.transcriptStorage);
              await setConsent('long_term_memory', choices.longTermMemory);
              await setConsent('assessment_storage', choices.assessmentStorage);
            }, 'interaction')
          }
        />
      )}

      {step === 'interaction' && (
        <InteractionStep
          initial={profile.preferredMode}
          busy={busy}
          onBack={() => setStep('consent')}
          onContinue={(mode: InteractionMode) =>
            void run(async () => void (await updateProfile({ preferredMode: mode, preferredLanguage: locale })), 'concerns')
          }
        />
      )}

      {step === 'concerns' && (
        <ConcernsStep
          initial={profile.primaryConcerns}
          busy={busy}
          onBack={() => setStep('interaction')}
          onContinue={(concerns: ConcernId[]) =>
            void run(async () => void (await updateProfile({ primaryConcerns: concerns })), 'screening')
          }
        />
      )}

      {step === 'screening' && <ScreeningStep onBack={() => setStep('concerns')} onContinue={() => setStep('meet')} />}

      {step === 'meet' && (
        <MeetNoorStep
          initialName={profile.displayName}
          busy={busy}
          onStart={(name: string | null) =>
            void run(async () => {
              await updateProfile({ displayName: name, onboardingCompletedAt: nowIso() });
              navigate(ROUTES.session, { replace: true });
            }, 'meet')
          }
          onDashboard={(name: string | null) =>
            void run(async () => {
              await updateProfile({ displayName: name, onboardingCompletedAt: nowIso() });
              navigate(ROUTES.dashboard, { replace: true });
            }, 'meet')
          }
        />
      )}
    </FocusLayout>
  );
}
