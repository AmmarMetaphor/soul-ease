/**
 * Runtime environment configuration.
 *
 * Only VITE_-prefixed variables are ever bundled into the browser. Server-side
 * secrets (OpenAI key, etc.) live exclusively in Netlify Functions — see
 * netlify/functions/realtime-token.ts.
 */

function readBool(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function readInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';
const forceDemo = readBool(import.meta.env.VITE_FORCE_DEMO_MODE);

const supabaseConfigured = supabaseUrl.length > 0 && supabaseAnonKey.length > 0;

export const env = {
  supabaseUrl,
  supabaseAnonKey,
  supabaseConfigured,
  /**
   * DEMO_MODE is active when Supabase is not configured or when explicitly
   * forced. In demo mode all data is stored locally in the browser and no
   * network calls are made. It exists so the product can be reviewed before
   * infrastructure credentials are connected — it is not a production mode.
   */
  isDemoMode: forceDemo || !supabaseConfigured,
  freeSessionAllowance: readInt(import.meta.env.VITE_FREE_SESSION_ALLOWANCE, 3),
  publicSiteUrl: import.meta.env.VITE_PUBLIC_SITE_URL?.trim() || undefined,
  /**
   * 'browser' (default) uses clean URLs and relies on the host's SPA rewrite
   * (netlify.toml). 'hash' works on any static host with no rewrite support
   * — used for standalone preview builds.
   */
  routerMode: (import.meta.env.VITE_ROUTER_MODE?.trim() === 'hash' ? 'hash' : 'browser') as 'browser' | 'hash',
  /**
   * Which engine holds the conversation.
   *
   * 'auto' (default) and 'openai' both run the realtime model, and a realtime
   * connection that cannot be established is reported as unavailable — never
   * answered by a stand-in. 'demo' is the only value that runs the scripted
   * interface harness, and must only be set for interface review: it replies
   * from fixed line pools in the browser's own voice.
   */
  realtimeProvider: ((): 'auto' | 'demo' | 'openai' => {
    const raw = import.meta.env.VITE_REALTIME_PROVIDER?.trim();
    return raw === 'demo' || raw === 'openai' ? raw : 'auto';
  })(),
  isDev: import.meta.env.DEV,
  /**
   * Developer tools (voice audition, realtime diagnostics). On in dev builds;
   * in a deployed preview it must be opted into explicitly. Never on for
   * ordinary production users.
   */
  devToolsEnabled:
    import.meta.env.DEV || readBool(import.meta.env.VITE_ENABLE_DEV_TOOLS),
} as const;

export function siteOrigin(): string {
  if (env.publicSiteUrl) return env.publicSiteUrl.replace(/\/$/, '');
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}
