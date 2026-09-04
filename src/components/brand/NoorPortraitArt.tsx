import { GUIDE_DESIGNATION, GUIDE_NAME } from '@/config/app';

/**
 * Noor's portrait — original vector artwork, drawn for this product.
 *
 * Deliberately an illustration rather than a photorealistic render. Noor is a
 * fictional AI guide, and a photoreal face invites a member to believe there
 * is a woman behind it. An illustration is honest about being a depiction
 * while still giving her a warm, consistent, human presence instead of an
 * abstract shape.
 *
 * Depicts an adult South Asian woman, late twenties to mid thirties, calm and
 * approachable, in a dupatta draped over her head and shoulders in Soul Ease's
 * palette. There is no medical coat, no stethoscope, no clinical setting and
 * no glamour styling: she is not a doctor and must never look like one.
 *
 * No real person is referenced. Nothing is traced from a photograph, and the
 * geometry is hand-placed rather than sampled, so there is no identifiable
 * likeness to infringe.
 *
 * Static by design — Stage 3 explicitly excludes fake lip sync. The audio
 * indicator is the ring around the portrait, never the face.
 *
 * Draw order matters and is the reason this reads as a dupatta rather than a
 * headband: the cloth is laid down as one silhouette first, then the kameez,
 * neck, hair and face are drawn on top, so the cloth is left showing as a
 * crown above the hairline and as two panels falling past the shoulders.
 */

const SKIN = '#c68e67';
const SKIN_SHADE = '#ad7350';
const HAIR = '#2a2018';
const KAMEEZ = '#5b7f6e';
const KAMEEZ_DARK = '#46685a';
const CLOTH = '#cabbdb';
const CLOTH_SHADE = '#ab99c4';
const LIP = '#a05f4c';
const EYE = '#4a3524';
const WHITE = '#fdfaf5';

export function NoorPortraitArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label={`${GUIDE_NAME}, ${GUIDE_DESIGNATION}`}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <radialGradient id="noor-bg" cx="36%" cy="22%" r="88%">
          <stop offset="0%" stopColor="#f7f2e8" />
          <stop offset="52%" stopColor="#e7dfd1" />
          <stop offset="100%" stopColor="#cbd8cb" />
        </radialGradient>
        <linearGradient id="noor-cloth" x1="0.1" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor={CLOTH} />
          <stop offset="100%" stopColor={CLOTH_SHADE} />
        </linearGradient>
        <linearGradient id="noor-kameez" x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0%" stopColor={KAMEEZ} />
          <stop offset="100%" stopColor={KAMEEZ_DARK} />
        </linearGradient>
        <radialGradient id="noor-cheek" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#d3856b" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#d3856b" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="100" height="100" fill="url(#noor-bg)" />

      {/* The dupatta as one silhouette: over the crown, down past both
          shoulders. Everything else is drawn on top of it, which is what
          leaves cloth showing as a crown and as two falling panels. */}
      <path
        d="M15 70 C9 32 26 5 50 5 C74 5 91 32 85 70 L93 100 L7 100 Z"
        fill="url(#noor-cloth)"
      />
      {/* Folds, so the cloth has some weight rather than reading as a shape. */}
      <path d="M79 66 C83 78 85 90 86 100 L80 100 C80 88 79 76 77 67 Z" fill={CLOTH_SHADE} fillOpacity="0.5" />
      <path d="M21 66 C17 78 15 90 14 100 L20 100 C20 88 21 76 23 67 Z" fill={CLOTH_SHADE} fillOpacity="0.28" />

      {/* Kameez, visible between the two falling panels of the dupatta. */}
      <path d="M25 100 C26 84 37 77 50 77 C63 77 74 84 75 100 Z" fill="url(#noor-kameez)" />

      {/* Neck */}
      <path d="M45 58 C45 68 44 74 42.5 79 C47.5 77.5 52.5 77.5 57.5 79 C56 74 55 68 55 58 Z" fill={SKIN_SHADE} />

      {/* Hair. A dupatta worn over the head leaves a band at the front and
          some falling beside the cheeks, so that is what is drawn — kept thin
          and soft-edged, because a thick hard band reads as a headband. */}
      <path
        d="M28 52 C26 29 36 16 50 16 C64 16 74 29 72 52 C71 41 69 34 66 30 C61 25 55.5 23.5 50 23.5 C44.5 23.5 39 25 34 30 C31 34 29 41 28 52 Z"
        fill={HAIR}
      />
      <path d="M28.5 46 C26.8 55 27.4 62 29.6 67 C32 61 31.4 53 31.6 47 Z" fill={HAIR} />
      <path d="M71.5 46 C73.2 55 72.6 62 70.4 67 C68 61 68.6 53 68.4 47 Z" fill={HAIR} />

      {/* Face */}
      <ellipse cx="50" cy="45" rx="18.5" ry="22.5" fill={SKIN} />
      {/* Shading down the side away from the light. */}
      <path d="M50 22.5 C60 23 68.5 32 68.5 45 C68.5 58 60 67.5 50 67.5 Z" fill={SKIN_SHADE} fillOpacity="0.15" />
      <ellipse cx="38.5" cy="48" rx="6" ry="4" fill="url(#noor-cheek)" />
      <ellipse cx="61.5" cy="48" rx="6" ry="4" fill="url(#noor-cheek)" />
      {/* Hairline, with a slight centre peak so it follows a real forehead
          rather than sitting across it as a straight edge. */}
      <path
        d="M32 38 C33.5 28.5 41 24 50 24 C59 24 66.5 28.5 68 38 C65 32 60 29.5 54 29 C52 30.4 51 31 50 31 C49 31 48 30.4 46 29 C40 29.5 35 32 32 38 Z"
        fill={HAIR}
      />

      {/* Brows — level and relaxed, neither raised nor knitted. */}
      <path d="M39.6 40.6 C41.6 39.4 44.4 39.4 46.4 40.5" stroke={HAIR} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M53.6 40.5 C55.6 39.4 58.4 39.4 60.4 40.6" stroke={HAIR} strokeWidth="1.4" fill="none" strokeLinecap="round" />

      {/* Eyes — attentive, looking at the viewer, not widened. */}
      <ellipse cx="43" cy="45.6" rx="3.1" ry="2.1" fill={WHITE} />
      <ellipse cx="57" cy="45.6" rx="3.1" ry="2.1" fill={WHITE} />
      <circle cx="43" cy="45.7" r="1.55" fill={EYE} />
      <circle cx="57" cy="45.7" r="1.55" fill={EYE} />
      <circle cx="43.5" cy="45.1" r="0.5" fill={WHITE} fillOpacity="0.9" />
      <circle cx="57.5" cy="45.1" r="0.5" fill={WHITE} fillOpacity="0.9" />
      {/* The upper lash line does most of the work of looking calm. */}
      <path d="M39.9 44.6 C41.5 42.9 44.5 42.9 46.1 44.7" stroke={HAIR} strokeWidth="1" fill="none" strokeLinecap="round" />
      <path d="M53.9 44.7 C55.5 42.9 58.5 42.9 60.1 44.6" stroke={HAIR} strokeWidth="1" fill="none" strokeLinecap="round" />

      {/* Nose */}
      <path d="M50 48.6 C49.2 51.6 48.9 53.1 49.4 54.3 C50.1 55.1 51 55 51.6 54.4" stroke={SKIN_SHADE} strokeWidth="1" fill="none" strokeLinecap="round" />

      {/* Mouth — a settled half-smile, not a grin. */}
      <path d="M46.2 58.4 C47.8 59.8 52.2 59.8 53.8 58.4" stroke={LIP} strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <path d="M47.2 60.4 C48.4 61.1 51.6 61.1 52.8 60.4" stroke={SKIN_SHADE} strokeWidth="0.7" fill="none" strokeLinecap="round" strokeOpacity="0.5" />
    </svg>
  );
}
