export interface AuthUser {
  id: string;
  email: string | null;
  emailConfirmedAt: string | null;
  createdAt: string;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string | null;
}

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'invalid_email'
  | 'email_not_confirmed'
  | 'user_already_exists'
  | 'weak_password'
  | 'rate_limited'
  | 'network'
  | 'session_expired'
  | 'unknown';

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export interface SignUpResult {
  session: AuthSession | null;
  /** True when the provider requires the member to confirm their email first. */
  needsEmailVerification: boolean;
}

/**
 * Authentication contract. Supabase Auth in production; a clearly-labelled
 * local implementation in demo mode. Passwords are never handled by app code
 * beyond passing them to the provider.
 */
export interface AuthProvider {
  readonly kind: 'supabase' | 'demo';
  getSession(): Promise<AuthSession | null>;
  onAuthStateChange(callback: (session: AuthSession | null) => void): () => void;
  signUpWithEmail(email: string, password: string): Promise<SignUpResult>;
  signInWithEmail(email: string, password: string): Promise<AuthSession>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  updatePassword(newPassword: string): Promise<void>;
  resendVerificationEmail(email: string): Promise<void>;
  getAccessToken(): Promise<string | null>;
}

export const MIN_PASSWORD_LENGTH = 8;

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}
