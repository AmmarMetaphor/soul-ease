import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 20, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...rest,
  };
}

export const MicIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" />
  </svg>
);
export const MicOffIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 9v2a3 3 0 0 0 5.12 2.12M15 9.34V6a3 3 0 0 0-5.94-.6" />
    <path d="M5 11a7 7 0 0 0 11.66 5.24M19 11a7 7 0 0 1-.4 2.3M12 18v3M8 21h8M3 3l18 18" />
  </svg>
);
export const PauseIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M8 5v14M16 5v14" strokeWidth="2.2" />
  </svg>
);
export const PlayIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M7 5v14l11-7z" fill="currentColor" stroke="none" />
  </svg>
);
export const StopIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" stroke="none" />
  </svg>
);
export const KeyboardIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="3" y="6" width="18" height="12" rx="2.5" />
    <path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" />
  </svg>
);
export const TranscriptIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 5h14v14H5zM8 9h8M8 12h8M8 15h5" />
  </svg>
);
export const SettingsIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.51 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z" />
  </svg>
);
export const HomeIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" />
  </svg>
);
export const JournalIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 3h11a2 2 0 0 1 2 2v16H8a2 2 0 0 1-2-2zM6 3v16M10 8h5M10 12h5" />
  </svg>
);
export const GoalIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </svg>
);
export const ToolkitIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3c2 3 5 4 5 8a5 5 0 0 1-10 0c0-2 1-3 1-3s1 2 2 2c1-2 1-5 2-7z" />
  </svg>
);
export const SessionsIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 6h16M4 12h16M4 18h10" />
  </svg>
);
export const PersonIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);
export const ShieldIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);
export const ChevronLeftIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
export const ChevronRightIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M9 5l7 7-7 7" />
  </svg>
);
export const CheckIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M5 12l5 5L20 7" />
  </svg>
);
export const CloseIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const PlusIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const TrashIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
  </svg>
);
export const SparkIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
  </svg>
);
export const HeartIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />
  </svg>
);
export const WaveIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 12h1M8 8v8M12 5v14M16 8v8M20 12h-1" strokeWidth="2.2" />
  </svg>
);
export const SendIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <path d="M4 12l16-8-6 16-2.5-6.5z" />
  </svg>
);
export const LockIcon = (p: IconProps) => (
  <svg {...base(p)}>
    <rect x="5" y="10" width="14" height="11" rx="2.5" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);
