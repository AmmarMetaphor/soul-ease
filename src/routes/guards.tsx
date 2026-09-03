import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { PageLoader } from '@/components/ui/Spinner';
import { ROUTES } from '@/config/app';
import { DataProvider, useData } from '@/data/DataContext';
import { ErrorState } from '@/components/ui/States';

/**
 * Requires a signed-in member. Unauthenticated visitors are sent to login
 * with the intended destination preserved.
 */
export function RequireAuth({ children }: { children?: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <PageLoader />;
  if (status === 'signed_out') {
    return <Navigate to={ROUTES.login} replace state={{ from: location.pathname + location.search }} />;
  }
  return <DataProvider>{children ?? <Outlet />}</DataProvider>;
}

/**
 * Requires the member to have completed onboarding (age + consent). Members
 * who have not are sent to onboarding; safety pages are never gated by this.
 */
export function RequireOnboarded({ children }: { children?: ReactNode }) {
  const { profile, loading, error, refresh } = useData();
  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={() => void refresh()} className="m-6" />;
  if (!profile?.onboardingCompletedAt) return <Navigate to={ROUTES.onboarding} replace />;
  return children ?? <Outlet />;
}

/** Sends already-signed-in members away from auth pages. */
export function RedirectIfAuthenticated({ children }: { children?: ReactNode }) {
  const { status } = useAuth();
  if (status === 'loading') return <PageLoader />;
  if (status === 'signed_in') return <Navigate to={ROUTES.dashboard} replace />;
  return children ?? <Outlet />;
}
