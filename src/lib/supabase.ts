import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/config/env';

let client: SupabaseClient | null = null;

/**
 * Browser Supabase client using the public anon key. Data access is enforced
 * by Row Level Security — the anon key alone grants nothing. Returns null in
 * demo mode so callers cannot accidentally hit the network.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (env.isDemoMode) return null;
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    });
  }
  return client;
}
