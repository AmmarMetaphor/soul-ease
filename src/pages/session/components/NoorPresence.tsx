import { NoorPortrait } from '@/components/brand/NoorPortrait';
import { GUIDE_DESIGNATION, GUIDE_NAME } from '@/config/app';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { cn } from '@/lib/cn';
import type { ConversationState } from '@/realtime/types';

interface NoorPresenceProps {
  conversation: ConversationState;
  /** 0–1 live level. */
  level: number;
  levelSource: 'user' | 'noor';
  statusLabel: string;
  hint?: string;
  onInterrupt?: () => void;
  interruptLabel?: string;
  safety?: boolean;
}

/**
 * Noor's presence during a live session: her portrait, a slim audio
 * indicator that distinguishes who is speaking, and the state in words.
 *
 * The portrait stays static and modest in size so it never covers the
 * controls; motion lives in the ring and the indicator. State is always
 * conveyed in text as well as colour and movement.
 */
export function NoorPresence({
  conversation,
  level,
  levelSource,
  statusLabel,
  hint,
  onInterrupt,
  interruptLabel,
  safety,
}: NoorPresenceProps) {
  const speaking = conversation === 'speaking';
  const listening = conversation === 'listening';
  const thinking = conversation === 'thinking' || conversation === 'connecting';
  const canInterrupt = speaking && !!onInterrupt;

  return (
    <div className="flex flex-col items-center">
      <NoorPortrait size="xl" ambient={!safety} level={levelSource === 'noor' && speaking ? level : level * 0.4} />

      <p className="mt-5 font-display text-xl font-medium text-ink-900">{GUIDE_NAME}</p>
      <p className="text-xs text-ink-500">{GUIDE_DESIGNATION}</p>

      <AudioIndicator
        level={level}
        active={speaking || listening}
        source={levelSource}
        speaking={speaking}
        thinking={thinking}
      />

      <p className="mt-4 text-sm font-medium text-ink-700" role="status" aria-live="polite">
        {statusLabel}
      </p>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}

      {canInterrupt && (
        <button
          type="button"
          onClick={onInterrupt}
          className="mt-4 rounded-full bg-white/80 px-4 py-1.5 text-xs font-semibold text-emerald-800 ring-1 ring-ink-900/10 transition-colors hover:bg-white"
        >
          {interruptLabel}
        </button>
      )}
    </div>
  );
}

/**
 * A calm horizontal indicator rather than a music-player waveform. Bars
 * respond to the real level; who is speaking changes both colour and shape,
 * so the state does not rest on colour alone.
 */
function AudioIndicator({
  level,
  active,
  source,
  speaking,
  thinking,
}: {
  level: number;
  active: boolean;
  source: 'user' | 'noor';
  speaking: boolean;
  thinking: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const bars = 9;
  const clamped = Math.min(1, Math.max(0, level));

  if (thinking) {
    return (
      <span className="dot-pulse mt-6 flex h-6 items-center gap-1.5" aria-hidden="true">
        <span className="h-1.5 w-1.5 rounded-full bg-dusk-400" />
        <span className="h-1.5 w-1.5 rounded-full bg-dusk-400" />
        <span className="h-1.5 w-1.5 rounded-full bg-dusk-400" />
      </span>
    );
  }

  return (
    <span className="mt-6 flex h-6 items-end gap-1" aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => {
        // Centre bars react most; a static, even shape when idle.
        const distance = Math.abs(i - (bars - 1) / 2) / ((bars - 1) / 2);
        const envelope = 1 - distance * 0.65;
        const height = active && !reduced ? 3 + clamped * 21 * envelope : 3;
        return (
          <span
            key={i}
            className={cn(
              'w-[3px] rounded-full transition-[height,background-color] duration-100 ease-out',
              !active && 'bg-ink-300/50',
              active && speaking && 'bg-dusk-400',
              active && !speaking && source === 'user' && 'bg-emerald-600',
              active && !speaking && source === 'noor' && 'bg-dusk-400',
            )}
            style={{ height: `${Math.max(3, height).toFixed(1)}px` }}
          />
        );
      })}
    </span>
  );
}
