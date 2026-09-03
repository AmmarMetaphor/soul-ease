import { useState } from 'react';
import { GUIDE_DESIGNATION, GUIDE_NAME } from '@/config/app';
import { cn } from '@/lib/cn';

/**
 * Noor's portrait.
 *
 * Integration point for the original synthetic portrait described in
 * public/images/noor/README.md. Until that asset is added the component
 * renders an abstract identity mark in Noor's palette — never a stock
 * photograph of a real person standing in for a fictional AI guide.
 *
 * Noor is always labelled "Soul Ease AI Wellbeing Guide"; never "Dr", never
 * "therapist".
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
  /** Level 0–1; nudges the ring, never the photograph itself. */
  level?: number;
}

export function NoorPortrait({ size = 'md', className, ambient = false, level = 0 }: NoorPortraitProps) {
  const [assetMissing, setAssetMissing] = useState(false);
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
        {assetMissing ? (
          <IdentityMark />
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
            onError={() => setAssetMissing(true)}
          />
        )}
      </span>
    </span>
  );
}

/**
 * Abstract stand-in: a soft dusk-to-emerald field with Noor's initial. Reads
 * as a considered identity rather than a broken image.
 */
function IdentityMark() {
  return (
    <span
      role="img"
      aria-label={`${GUIDE_NAME}, ${GUIDE_DESIGNATION}`}
      // Mid-tone gradient so the ivory glyph keeps its contrast at every size.
      className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_38%_30%,#b9a7cf_0%,#7c6a98_45%,#2f5a49_100%)]"
    >
      {/* SVG rather than a percentage font-size: this scales with the box,
          which a % font-size does not (it resolves against the parent's size). */}
      <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
        <text
          x="50"
          y="52"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="54"
          fill="#fbf9f4"
          fillOpacity="0.95"
          style={{ fontFamily: "'Noto Nastaliq Urdu', 'Noto Naskh Arabic', serif" }}
        >
          ن
        </text>
      </svg>
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
