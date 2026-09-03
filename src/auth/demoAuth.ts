import { newId, nowIso } from '@/lib/ids';
import {
  AuthError,
  validateEmail,
  validatePassword,
  type AuthProvider,
  type AuthSession,
  type SignUpResult,
} from './types';

const ACCOUNTS_KEY = 'soulease:demo:accounts';
const SESSION_KEY = 'soulease:demo:session';

interface DemoAccount {
  id: string;
  email: string;
  passwordDigest: string;
  createdAt: string;
}

async function digest(input: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(input);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Extremely old environment — demo only, never production.
  return `plain:${input.length}:${input.slice(0, 2)}`;
}

function readAccounts(): DemoAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    return raw ? (JSON.parse(raw) as DemoAccount[]) : [];
  } catch {
    return [];
  }
}

function writeAccounts(accounts: DemoAccount[]): void {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function readSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as AuthSession) : null;
  } catch {
    return null;
  }
}

function writeSession(session: AuthSession | null): void {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}

/**
 * DEMO MODE authentication.
 *
 * Accounts live only in this browser's localStorage so the product can be
 * reviewed without a Supabase project. Emails are not verified and reset
 * links are simulated. Clearly not for production.
 */
export class DemoAuthProvider implements AuthProvider {
  readonly kind = 'demo' as const;
  private listeners = new Set<(session: AuthSession | null) => void>();

  async getSession(): Promise<AuthSession | null> {
    return readSession();
  }

  onAuthStateChange(callback: (session: AuthSession | null) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify(session: AuthSession | null): void {
    writeSession(session);
    for (const listener of this.listeners) listener(session);
  }

  async signUpWithEmail(email: string, password: string): Promise<SignUpResult> {
    const normalised = email.trim().toLowerCase();
    if (!validateEmail(normalised)) throw new AuthError('invalid_email', 'Enter a valid email address.');
    const weak = validatePassword(password);
    if (weak) throw new AuthError('weak_password', weak);
    const accounts = readAccounts();
    if (accounts.some((a) => a.email === normalised)) {
      throw new AuthError('user_already_exists', 'An account with that email already exists in this browser.');
    }
    const account: DemoAccount = {
      id: newId(),
      email: normalised,
      passwordDigest: await digest(password),
      createdAt: nowIso(),
    };
    writeAccounts([...accounts, account]);
    const session: AuthSession = {
      user: { id: account.id, email: account.email, emailConfirmedAt: account.createdAt, createdAt: account.createdAt },
      accessToken: null,
    };
    this.notify(session);
    return { session, needsEmailVerification: false };
  }

  async signInWithEmail(email: string, password: string): Promise<AuthSession> {
    const normalised = email.trim().toLowerCase();
    const account = readAccounts().find((a) => a.email === normalised);
    if (!account || account.passwordDigest !== (await digest(password))) {
      throw new AuthError('invalid_credentials', 'That email and password do not match.');
    }
    const session: AuthSession = {
      user: { id: account.id, email: account.email, emailConfirmedAt: account.createdAt, createdAt: account.createdAt },
      accessToken: null,
    };
    this.notify(session);
    return session;
  }

  async signOut(): Promise<void> {
    this.notify(null);
  }

  async requestPasswordReset(email: string): Promise<void> {
    if (!validateEmail(email)) throw new AuthError('invalid_email', 'Enter a valid email address.');
    // Demo: nothing is sent. The UI explains this.
  }

  async updatePassword(newPassword: string): Promise<void> {
    const weak = validatePassword(newPassword);
    if (weak) throw new AuthError('weak_password', weak);
    const session = readSession();
    if (!session) throw new AuthError('session_expired', 'Sign in again to change your password.');
    const accounts = readAccounts();
    const idx = accounts.findIndex((a) => a.id === session.user.id);
    if (idx === -1) throw new AuthError('unknown', 'Account not found in this browser.');
    accounts[idx] = { ...accounts[idx], passwordDigest: await digest(newPassword) };
    writeAccounts(accounts);
  }

  async resendVerificationEmail(_email: string): Promise<void> {
    // Demo: emails are always treated as verified.
  }

  async getAccessToken(): Promise<string | null> {
    return null;
  }
}
