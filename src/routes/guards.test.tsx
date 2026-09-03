import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthProviderBoundary } from '@/auth/AuthContext';
import type { AuthProvider, AuthSession } from '@/auth/types';
import { I18nProvider } from '@/i18n';
import { RedirectIfAuthenticated, RequireAuth } from './guards';

function fakeAuth(session: AuthSession | null): AuthProvider {
  return {
    kind: 'demo',
    getSession: async () => session,
    onAuthStateChange: () => () => undefined,
    signUpWithEmail: async () => ({ session, needsEmailVerification: false }),
    signInWithEmail: async () => session!,
    signOut: async () => undefined,
    requestPasswordReset: async () => undefined,
    updatePassword: async () => undefined,
    resendVerificationEmail: async () => undefined,
    getAccessToken: async () => null,
  };
}

const SESSION: AuthSession = {
  user: { id: 'user-1', email: 'member@example.com', emailConfirmedAt: null, createdAt: '2026-01-01T00:00:00Z' },
  accessToken: null,
};

function renderAt(path: string, auth: AuthProvider) {
  return render(
    <I18nProvider initialLocale="en">
      <AuthProviderBoundary provider={auth}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/login" element={<RedirectIfAuthenticated><p>login page</p></RedirectIfAuthenticated>} />
            <Route path="/app" element={<RequireAuth><p>private dashboard</p></RequireAuth>} />
          </Routes>
        </MemoryRouter>
      </AuthProviderBoundary>
    </I18nProvider>,
  );
}

describe('protected routes', () => {
  it('redirects signed-out visitors from /app to /login', async () => {
    renderAt('/app', fakeAuth(null));
    await waitFor(() => expect(screen.getByText('login page')).toBeInTheDocument());
    expect(screen.queryByText('private dashboard')).not.toBeInTheDocument();
  });

  it('renders protected content for signed-in members', async () => {
    renderAt('/app', fakeAuth(SESSION));
    await waitFor(() => expect(screen.getByText('private dashboard')).toBeInTheDocument());
  });

  it('sends signed-in members away from /login', async () => {
    renderAt('/login', fakeAuth(SESSION));
    await waitFor(() => expect(screen.queryByText('login page')).not.toBeInTheDocument());
  });

  it('shows the login page to signed-out visitors', async () => {
    renderAt('/login', fakeAuth(null));
    await waitFor(() => expect(screen.getByText('login page')).toBeInTheDocument());
  });
});
