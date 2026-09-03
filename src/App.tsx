import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProviderBoundary } from '@/auth/AuthContext';
import { DevBanner } from '@/components/DevBanner';
import { AppShell } from '@/components/layout/AppShell';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { MarketingLayout } from '@/components/layout/MarketingLayout';
import { ROUTES } from '@/config/app';
import { env } from '@/config/env';
import { I18nProvider } from '@/i18n';
import { AssessmentPage } from '@/pages/assessment/AssessmentPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { SignupPage } from '@/pages/auth/SignupPage';
import { VerifyEmailPage } from '@/pages/auth/VerifyEmailPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { GoalsPage } from '@/pages/goals/GoalsPage';
import { SessionDetailPage } from '@/pages/history/SessionDetailPage';
import { SessionHistoryPage } from '@/pages/history/SessionHistoryPage';
import { JournalPage } from '@/pages/journal/JournalPage';
import { PrivacyPage } from '@/pages/legal/PrivacyPage';
import { LandingPage } from '@/pages/marketing/LandingPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { OnboardingPage } from '@/pages/onboarding/OnboardingPage';
import { SafetySupportPage } from '@/pages/safety/SafetySupportPage';
import { SessionPage } from '@/pages/session/SessionPage';
import { SessionSummaryPage } from '@/pages/session/SessionSummaryPage';
import { DeleteAccountPage } from '@/pages/settings/DeleteAccountPage';
import { MemorySettingsPage } from '@/pages/settings/MemorySettingsPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';
import { HumanSupportPage } from '@/pages/support/HumanSupportPage';
import { ToolkitPage } from '@/pages/toolkit/ToolkitPage';
import { RedirectIfAuthenticated, RequireAuth, RequireOnboarded } from '@/routes/guards';

export function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route element={<MarketingLayout />}>
        <Route path={ROUTES.home} element={<LandingPage />} />
        <Route path={ROUTES.privacy} element={<PrivacyPage />} />
        <Route path={ROUTES.safety} element={<SafetySupportPage />} />
      </Route>

      {/* Auth */}
      <Route element={<AuthLayout />}>
        <Route element={<RedirectIfAuthenticated />}>
          <Route path={ROUTES.login} element={<LoginPage />} />
          <Route path={ROUTES.signup} element={<SignupPage />} />
          <Route path={ROUTES.forgotPassword} element={<ForgotPasswordPage />} />
        </Route>
        <Route path={ROUTES.resetPassword} element={<ResetPasswordPage />} />
        <Route path={ROUTES.verifyEmail} element={<VerifyEmailPage />} />
      </Route>

      {/* Signed in, onboarding not yet complete */}
      <Route element={<RequireAuth />}>
        <Route path={ROUTES.onboarding} element={<OnboardingPage />} />

        {/* Full app — requires onboarding */}
        <Route element={<RequireOnboarded />}>
          <Route path={ROUTES.session} element={<SessionPage />} />
          <Route element={<AppShell />}>
            <Route path={ROUTES.dashboard} element={<DashboardPage />} />
            <Route path={ROUTES.assessment} element={<AssessmentPage />} />
            <Route path="/app/session/:id/summary" element={<SessionSummaryPage />} />
            <Route path={ROUTES.sessions} element={<SessionHistoryPage />} />
            <Route path="/app/sessions/:id" element={<SessionDetailPage />} />
            <Route path={ROUTES.journal} element={<JournalPage />} />
            <Route path={ROUTES.goals} element={<GoalsPage />} />
            <Route path={ROUTES.toolkit} element={<ToolkitPage />} />
            <Route path={ROUTES.humanSupport} element={<HumanSupportPage />} />
            <Route path={ROUTES.settings} element={<SettingsPage />} />
            <Route path={ROUTES.memory} element={<MemorySettingsPage />} />
            <Route path={ROUTES.deleteAccount} element={<DeleteAccountPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/dashboard" element={<Navigate to={ROUTES.dashboard} replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  const Router = env.routerMode === 'hash' ? HashRouter : BrowserRouter;
  return (
    <I18nProvider>
      <AuthProviderBoundary>
        <Router>
          <DevBanner />
          <AppRoutes />
        </Router>
      </AuthProviderBoundary>
    </I18nProvider>
  );
}
