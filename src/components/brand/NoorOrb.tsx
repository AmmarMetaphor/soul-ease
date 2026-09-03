import { useEffect, useRef } from 'react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { cn } from '@/lib/cn';
import type { ConversationState } from '@/realtime/types';

export type OrbMood = ConversationState | 'safety';

interface NoorOrbProps {
  state?: OrbMood;
  /** 0–1 live level; drives the responsive halo. */
  level?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  onClick?: () => void;
  label?: string;
}

const SIZES = {
  sm: 'h-16 w-16',
  md: 'h-28 w-28',
  lg: 'h-48 w-48 sm:h-56 sm:w-56',
  xl: 'h-60 w-60 sm:h-72 sm:w-72',
};

/**
 * Noor's visual identity — an abstract, softly animated orb. No face, no
 * photograph. State changes are expressed through colour, breathing tempo and
 * a level-responsive halo rather than dramatic motion.
 */
export function NoorOrb({ state = 'ready', level = 0, size = 'lg', className, onClick, label }: NoorOrbProps) {
  const haloRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const el = haloRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(1, level));
    const scale = 1 + clamped * (reducedMotion ? 0.12 : 0.28);
    el.style.transform = `scale(${scale.toFixed(3)})`;
    el.style.opacity = (0.35 + clamped * 0.4).toFixed(2);
  }, [level, reducedMotion]);

  const isSafety = state === 'safety';
  const isListening = state === 'listening';
  const isSpeaking = state === 'speaking';
  const isThinking = state === 'thinking' || state === 'connecting';
  const isPaused = state === 'paused' || state === 'ended' || state === 'idle';

  const gradient = isSafety
    ? 'bg-[radial-gradient(circle_at_42%_38%,#e9efe6_0%,#b8c9b3_45%,#7a9273_100%)]'
    : isListening
      ? 'bg-[radial-gradient(circle_at_40%_35%,#d3dfcf_0%,#4f7d67_55%,#23453a_100%)]'
      : isSpeaking
        ? 'bg-[radial-gradient(circle_at_38%_34%,#d9d0e6_0%,#7c6a98_50%,#2f5a49_100%)]'
        : isThinking
          ? 'bg-[radial-gradient(circle_at_45%_40%,#ece7f3_0%,#b9a7cf_50%,#4f7d67_100%)]'
          : 'bg-[radial-gradient(circle_at_40%_35%,#b8c9b3_0%,#4f7d67_60%,#2f5a49_100%)]';

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-label={label}
      className={cn(
        'relative isolate flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-600/30',
        SIZES[size],
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {/* Level-responsive halo */}
      <div
        ref={haloRef}
        className={cn(
          'absolute inset-0 -z-10 rounded-full blur-2xl transition-[transform,opacity] duration-150 ease-out',
          isSafety ? 'bg-sage-300' : isSpeaking ? 'bg-dusk-300' : 'bg-sage-400',
        )}
        style={{ opacity: 0.35 }}
      />

      {/* Listening rings */}
      {isListening && !reducedMotion && (
        <>
          <span className="orb-ring absolute inset-0 rounded-full border border-emerald-600/40" />
          <span className="orb-ring absolute inset-0 rounded-full border border-emerald-600/25 [animation-delay:1.2s]" />
        </>
      )}

      {/* Core */}
      <div
        className={cn(
          'relative h-full w-full overflow-hidden rounded-full shadow-[inset_-18px_-22px_48px_rgba(35,69,58,0.35),inset_14px_18px_36px_rgba(255,255,255,0.35),0_24px_60px_-24px_rgba(35,69,58,0.5)] transition-[filter] duration-700',
          gradient,
          !isPaused && !reducedMotion && 'orb-breathe',
          isSpeaking && !reducedMotion && '[animation-duration:2.8s]',
          isPaused && 'saturate-[0.6] brightness-[1.05]',
        )}
      >
        {/* Drifting inner light */}
        <span
          className={cn(
            'absolute -left-1/4 -top-1/4 h-3/4 w-3/4 rounded-full bg-white/25 blur-xl',
            !isPaused && !reducedMotion && 'orb-drift',
          )}
        />
        <span className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/20" />
      </div>

      {/* Thinking dots */}
      {isThinking && (
        <span className="dot-pulse absolute -bottom-8 flex items-center gap-1.5" aria-hidden="true">
          <span className="h-1.5 w-1.5 rounded-full bg-dusk-400" />
          <span className="h-1.5 w-1.5 rounded-full bg-dusk-400" />
          <span className="h-1.5 w-1.5 rounded-full bg-dusk-400" />
        </span>
      )}
    </Wrapper>
  );
}
