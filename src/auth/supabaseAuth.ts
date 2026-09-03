import type { AuthError as SupabaseAuthError, Session, SupabaseClient } from '@supabase/supabase-js';
import { ROUTES } from '@/config/app';
import { siteOrigin } from '@/config/env';
import {
  AuthError,
  validateEmail,
  validatePassword,
  type AuthProvider,
  type AuthSession,
  type SignUpResult,
} from './types';

function toSession(session: Session | null): AuthSession | null {
  if (!session?.user) return null;
  return {
    user: {
      id: session.user.id,
      email: session.user.email ?? null,
      emailConfirmedAt: session.user.email_confirmed_at ?? null,
      createdAt: session.user.created_at,
    },
    accessToken: session.access_token,
  };
}

function mapError(error: SupabaseAuthError | Error | null | undefined): AuthError {
  if (!error) return new AuthError('unknown', 'Something went wrong. Please try again.');
  const message = error.message ?? '';
  const status = 'status' in error ? (error as SupabaseAuthError).status : undefined;
  const code = 'code' in error ? (error as SupabaseAuthError).code : undefined;

  if (code === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
    return new AuthError('invalid_credentials', 'That email and password do not match.');
  }
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(message)) {
    return new AuthError('email_not_confirmed', 'Please confirm your email before signing in.');
  }
  if (code === 'user_already_exists' || /already registered/i.test(message)) {
    return new AuthError('user_already_exists', 'An account with that email already exists.');
  }
  if (code === 'weak_password' || /password/i.test(message) && /weak|short|at least/i.test(message)) {
    return new AuthError('weak_password', message);
  }
  if (status === 429 || code === 'over_request_rate_limit' || /rate limit/i.test(message)) {
    return new AuthError('rate_limited', 'Too many attempts. Please wait a moment and try again.');
  }
  if (/fetch|network/i.test(message)) {
    return new AuthError('network', 'We could not reach the sign-in service. Check your connection.');
  }
  return new AuthError('unknown', message || 'Something went wrong. Please try again.');
}

export class SupabaseAuthProvider implements AuthProvider {
  readonly kind = 'supabase' as const;

  constructor(private readonly client: SupabaseClient) {}

  async getSession(): Promise<AuthSession | null> {
    const { data, error } = await this.client.auth.getSession();
    if (error) throw mapError(error);
    return toSession(data.session);
  }

  onAuthStateChange(callback: (session: AuthSession | null) => void): () => void {
    const { data } = this.client.auth.onAuthStateChange((_event, session) => {
      callback(toSession(session));
    });
    return () => data.subscription.unsubscribe();
  }

  async signUpWithEmail(email: string, password: string): Promise<SignUpResult> {
    if (!validateEmail(email)) throw new AuthError('invalid_email', 'Enter a valid email address.');
    const weak = validatePassword(password);
    if (weak) throw new AuthError('weak_password', weak);
    const { data, error } = await this.client.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${siteOrigin()}${ROUTES.verifyEmail}` },
    });
    if (error) throw mapError(error);
    // Supabase returns a user with an empty identities array when the email is
    // already registered and confirmation is enabled.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new AuthError('user_already_exists', 'An account with that email already exists.');
    }
    const session = toSession(data.session);
    return { session, needsEmailVerification: session === null };
  }

  async signInWithEmail(email: string, password: string): Promise<AuthSession> {
    const { data, error } = await this.client.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw mapError(error);
    const session = toSession(data.session);
    if (!session) throw new AuthError('unknown', 'Sign-in did not return a session.');
    return session;
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) throw mapError(error);
  }

  async requestPasswordReset(email: string): Promise<void> {
    if (!validateEmail(email)) throw new AuthError('invalid_email', 'Enter a valid email address.');
    const { error } = await this.client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${siteOrigin()}${ROUTES.resetPassword}`,
    });
    if (error) throw mapError(error);
  }

  async updatePassword(newPassword: string): Promise<void> {
    const weak = validatePassword(newPassword);
    if (weak) throw new AuthError('weak_password', weak);
    const { error } = await this.client.auth.updateUser({ password: newPassword });
    if (error) throw mapError(error);
  }

  async resendVerificationEmail(email: string): Promise<void> {
    const { error } = await this.client.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: `${siteOrigin()}${ROUTES.verifyEmail}` },
    });
    if (error) throw mapError(error);
  }

  async getAccessToken(): Promise<string | null> {
    const { data } = await this.client.auth.getSession();
    return data.session?.access_token ?? null;
  }
}
