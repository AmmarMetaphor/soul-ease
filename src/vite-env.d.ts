/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_FREE_SESSION_ALLOWANCE?: string;
  readonly VITE_FORCE_DEMO_MODE?: string;
  readonly VITE_PUBLIC_SITE_URL?: string;
  readonly VITE_REALTIME_PROVIDER?: string;
  readonly VITE_ROUTER_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
