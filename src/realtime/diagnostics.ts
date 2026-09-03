import { env } from '@/config/env';

/**
 * Development-only realtime diagnostics.
 *
 * A bounded in-memory ring buffer of connection and turn events, surfaced by
 * the dev diagnostics panel. Never rendered in production, never contains a
 * key, an ephemeral secret, or conversation content — event names and short
 * technical detail only.
 */

export interface DiagnosticEntry {
  at: number;
  channel: 'connection' | 'peer' | 'data' | 'turn' | 'audio' | 'error';
  label: string;
  detail?: string;
}

const MAX_ENTRIES = 120;

/** Redact anything that looks like a credential before it is ever stored. */
function scrub(detail: string | undefined): string | undefined {
  if (!detail) return undefined;
  return detail
    .replace(/\bek_[A-Za-z0-9_-]+/g, 'ek_[redacted]')
    .replace(/\bsk-[A-Za-z0-9_-]+/g, 'sk-[redacted]')
    .replace(/\bey[A-Za-z0-9._-]{20,}/g, '[jwt redacted]')
    .slice(0, 200);
}

class DiagnosticsLog {
  readonly enabled = env.isDev;
  private entries: DiagnosticEntry[] = [];
  private listeners = new Set<(entries: DiagnosticEntry[]) => void>();

  push(channel: DiagnosticEntry['channel'], label: string, detail?: string): void {
    if (!this.enabled) return;
    this.entries = [...this.entries.slice(-(MAX_ENTRIES - 1)), { at: Date.now(), channel, label, detail: scrub(detail) }];
    for (const listener of this.listeners) listener(this.entries);
  }

  clear(): void {
    this.entries = [];
    for (const listener of this.listeners) listener(this.entries);
  }

  snapshot(): DiagnosticEntry[] {
    return this.entries;
  }

  subscribe(listener: (entries: DiagnosticEntry[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.entries);
    return () => this.listeners.delete(listener);
  }
}

export const diagnostics = new DiagnosticsLog();
