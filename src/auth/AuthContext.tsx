import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { env } from '@/config/env';
import { getSupabaseClient } from '@/lib/supabase';
import { DemoAuthProvider } from './demoAuth';
import { SupabaseAuthProvider } from './supabaseAuth';
import { AuthError, type AuthProvider, type AuthSession, type SignUpResult } from './types';

export type AuthStatus = 'loading' | 'signed_out' | 'signed_in';

interface AuthContextValue {
  status: AuthStatus;
  session: AuthSession | null;
  providerKind: AuthProvider['kind'];
  isDemo: boolean;
  signIn: (email: string, password: string) => Promise<AuthSession>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  resendVerificationEmail: (email: string) => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function createAuthProvider(): AuthProvider {
  const client = getSupabaseClient();
  if (env.isDemoMode || !client) return new DemoAuthProvider();
  return new SupabaseAuthProvider(client);
}

export function AuthProviderBoundary({ children, provider }: { children: ReactNode; provider?: AuthProvider }) {
  const providerRef = useRef<AuthProvider>(provider ?? createAuthProvider());
  const auth = providerRef.current;
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    let cancelled = false;
    auth
      .getSession()
      .then((initial) => {
        if (cancelled) return;
        setSession(initial);
        setStatus(initial ? 'signed_in' : 'signed_out');
      })
      .catch(() => {
        if (cancelled) return;
        setSession(null);
        setStatus('signed_out');
      });
    const unsubscribe = auth.onAuthStateChange((next) => {
      setSession(next);
      setStatus(next ? 'signed_in' : 'signed_out');
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [auth]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const next = await auth.signInWithEmail(email, password);
      setSession(next);
      setStatus('signed_in');
      return next;
    },
    [auth],
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      const result = await auth.signUpWithEmail(email, password);
      if (result.session) {
        setSession(result.session);
        setStatus('signed_in');
      }
      return result;
    },
    [auth],
  );

  const signOut = useCallback(async () => {
    try {
      await auth.signOut();
    } finally {
      setSession(null);
      setStatus('signed_out');
    }
  }, [auth]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      providerKind: auth.kind,
      isDemo: auth.kind === 'demo',
      signIn,
      signUp,
      signOut,
      requestPasswordReset: (email) => auth.requestPasswordReset(email),
      updatePassword: (password) => auth.updatePassword(password),
      resendVerificationEmail: (email) => auth.resendVerificationEmail(email),
      getAccessToken: () => auth.getAccessToken(),
    }),
    [status, session, auth, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProviderBoundary');
  return ctx;
}

export function describeAuthError(error: unknown, fallback: string): string {
  if (error instanceof AuthError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
