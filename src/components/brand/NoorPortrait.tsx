import { useState } from 'react';
import { GUIDE_DESIGNATION, GUIDE_NAME } from '@/config/app';
import { env } from '@/config/env';
import { cn } from '@/lib/cn';
import { NoorPortraitArt } from './NoorPortraitArt';

/**
 * Noor's portrait.
 *
 * Renders original vector artwork of an adult South Asian woman
 * (NoorPortraitArt) — a warm, non-clinical, illustrated identity, and the
 * portrait members actually see. This replaced an abstract initial-in-a-circle
 * mark.
 *
 * A designed raster portrait can take over: drop the two files into
 * public/images/noor/ and set VITE_NOOR_PORTRAIT_ASSET=true. The flag exists
 * so a missing asset is never *attempted* — an <img> pointing at nothing gets
 * the SPA's index.html back with a 200, which fails as an image only after the
 * request, giving every page a wasted round trip and a visible flash.
 *
 * Never a stock photograph of a real person standing in for a fictional AI
 * guide. See public/images/noor/README.md for the asset brief.
 *
 * Noor is always labelled "Soul Ease AI Wellbeing Guide"; never "Dr", never
 * "therapist". The portrait itself never animates: the audio indicator is the
 * ring around it, because a moving mouth on a static face is fake lip sync.
 */

const SIZES = {
  sm: 'h-12 w-12',
  md: 'h-20 w-20',
  lg: 'h-28 w-28 sm:h-32 sm:w-32',
  xl: 'h-36 w-36 sm:h-44 sm:w-44',
} as const;

export type PortraitSize = keyof typeof SIZES;

const SRC = '/images/noor/noor-portrait.webp';
const SRC_2X = '/images/noor/noor-portrait@2x.webp';

interface NoorPortraitProps {
  size?: PortraitSize;
  className?: string;
  /** Soft ambient ring that breathes while Noor is present. */
  ambient?: boolean;
  /** Level 0–1; nudges the ring, never the portrait itself — no fake lip sync. */
  level?: number;
}

export function NoorPortrait({ size = 'md', className, ambient = false, level = 0 }: NoorPortraitProps) {
  // A supplied asset can still fail to decode; fall back to the artwork
  // rather than leaving Noor with no face.
  const [assetFailed, setAssetFailed] = useState(false);
  const useArtwork = !env.noorPortraitAsset || assetFailed;
  const ringScale = 1 + Math.min(1, Math.max(0, level)) * 0.1;

  return (
    <span className={cn('relative inline-flex shrink-0 items-center justify-center', SIZES[size], className)}>
      {ambient && (
        <span
          aria-hidden="true"
          className="absolute inset-[-14%] rounded-full bg-sage-300/45 blur-xl transition-transform duration-150 ease-out motion-reduce:transform-none"
          style={{ transform: `scale(${ringScale.toFixed(3)})` }}
        />
      )}
      <span
        className={cn(
          'relative h-full w-full overflow-hidden rounded-full ring-1 ring-ink-900/10',
          'shadow-[0_10px_30px_-14px_rgba(35,69,58,0.45)]',
          ambient && 'orb-breathe',
        )}
      >
        {useArtwork ? (
          <NoorPortraitArt className="h-full w-full" />
        ) : (
          <img
            src={SRC}
            srcSet={`${SRC} 1x, ${SRC_2X} 2x`}
            alt={`${GUIDE_NAME}, ${GUIDE_DESIGNATION}`}
            width={352}
            height={352}
            loading="eager"
            decoding="async"
            className="h-full w-full object-cover object-center"
            onError={() => setAssetFailed(true)}
          />
        )}
      </span>
    </span>
  );
}

/** Portrait plus name and designation — the pairing used across the app. */
export function NoorIdentity({
  size = 'md',
  ambient,
  level,
  className,
  tone = 'light',
}: NoorPortraitProps & { tone?: 'light' | 'dark' }) {
  return (
    <span className={cn('flex items-center gap-3', className)}>
      <NoorPortrait size={size} ambient={ambient} level={level} />
      <span className="min-w-0">
        <span className={cn('block font-display text-lg font-medium', tone === 'dark' ? 'text-ivory-50' : 'text-ink-900')}>
          {GUIDE_NAME}
        </span>
        <span className={cn('block text-xs', tone === 'dark' ? 'text-ivory-50/70' : 'text-ink-500')}>
          {GUIDE_DESIGNATION}
        </span>
      </span>
    </span>
  );
}
