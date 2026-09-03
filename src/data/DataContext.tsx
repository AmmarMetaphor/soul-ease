import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { CONSENT_VERSION } from '@/config/app';
import { env } from '@/config/env';
import { getSupabaseClient } from '@/lib/supabase';
import { consentStateFromRecords, DEFAULT_CONSENT_STATE, type ConsentState, type ConsentType } from '@/memory/permissions';
import { DemoRepository } from './demoRepository';
import type { SoulEaseRepository } from './repository';
import { SupabaseRepository } from './supabaseRepository';
import type { Profile, ProfileUpdate, UsageEntitlement } from './types';

interface DataContextValue {
  repo: SoulEaseRepository;
  /** Profile/consent/entitlement are loaded once and cached; call refresh() after writes. */
  profile: Profile | null;
  consent: ConsentState;
  entitlement: UsageEntitlement | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateProfile: (update: ProfileUpdate) => Promise<Profile>;
  setConsent: (type: ConsentType, granted: boolean) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

function createRepository(userId: string): SoulEaseRepository {
  const client = getSupabaseClient();
  if (env.isDemoMode || !client) return new DemoRepository(userId);
  return new SupabaseRepository(client, userId);
}

/**
 * Mounted only inside protected routes — requires a signed-in member.
 */
export function DataProvider({ children, repository }: { children: ReactNode; repository?: SoulEaseRepository }) {
  const { session } = useAuth();
  const userId = session?.user.id;
  if (!userId) throw new Error('DataProvider requires an authenticated session');

  const repo = useMemo(() => repository ?? createRepository(userId), [repository, userId]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [consent, setConsentState] = useState<ConsentState>(DEFAULT_CONSENT_STATE);
  const [entitlement, setEntitlement] = useState<UsageEntitlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [nextProfile, consents, nextEntitlement] = await Promise.all([
        repo.getProfile(),
        repo.listConsents(),
        repo.getEntitlement(),
      ]);
      setProfile(nextProfile);
      setConsentState(consentStateFromRecords(consents));
      setEntitlement(nextEntitlement);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your account.');
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  const updateProfile = useCallback(
    async (update: ProfileUpdate) => {
      const next = await repo.updateProfile(update);
      setProfile(next);
      return next;
    },
    [repo],
  );

  const setConsent = useCallback(
    async (type: ConsentType, granted: boolean) => {
      await repo.recordConsent(type, granted, CONSENT_VERSION);
      const consents = await repo.listConsents();
      setConsentState(consentStateFromRecords(consents));
    },
    [repo],
  );

  const value = useMemo<DataContextValue>(
    () => ({ repo, profile, consent, entitlement, loading, error, refresh, updateProfile, setConsent }),
    [repo, profile, consent, entitlement, loading, error, refresh, updateProfile, setConsent],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
