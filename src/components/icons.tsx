/** Inline, currentColor icons. No icon library, no extra request. */

type IconProps = React.SVGProps<SVGSVGElement>;

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
};

export const PhoneIcon = (p: IconProps) => (
  <svg {...base} width="18" height="18" {...p}>
    <path d="M6.5 3.5h3l1.5 4-2 1.2a12 12 0 0 0 6.3 6.3l1.2-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7 2 2 0 0 1 6.5 3.5Z" />
  </svg>
);

export const WhatsAppIcon = (p: IconProps) => (
  <svg {...base} width="18" height="18" {...p}>
    <path d="M3.8 20.2 5 16.4A7.8 7.8 0 1 1 8 19.2l-4.2 1Z" />
    <path d="M9 9.2c.2 1 .7 2 1.5 2.8.8.8 1.8 1.3 2.8 1.5l.9-1.1 1.8.8v1.3c-.6.5-1.5.5-2.3.2a8.4 8.4 0 0 1-4.9-4.9c-.3-.8-.3-1.7.2-2.3h1.3l.8 1.8L9 9.2Z" />
  </svg>
);

export const MailIcon = (p: IconProps) => (
  <svg {...base} width="18" height="18" {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="m3.8 7 7.3 5.2a1.5 1.5 0 0 0 1.8 0L20.2 7" />
  </svg>
);

export const ArrowIcon = (p: IconProps) => (
  <svg {...base} width="18" height="18" {...p}>
    <path d="M4.5 12h15M13.5 6l6 6-6 6" />
  </svg>
);

export const MenuIcon = (p: IconProps) => (
  <svg {...base} width="22" height="22" {...p}>
    <path d="M4 8h16M4 16h16" />
  </svg>
);

export const CloseIcon = (p: IconProps) => (
  <svg {...base} width="22" height="22" {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const CheckIcon = (p: IconProps) => (
  <svg {...base} width="18" height="18" {...p}>
    <path d="m4.5 12.5 4.5 4.5 10.5-11" />
  </svg>
);

export const AlertIcon = (p: IconProps) => (
  <svg {...base} width="18" height="18" {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5v5M12 16h.01" />
  </svg>
);

export const SpinnerIcon = (p: IconProps) => (
  <svg {...base} width="18" height="18" {...p}>
    <circle cx="12" cy="12" r="8.5" opacity="0.25" />
    <path d="M20.5 12A8.5 8.5 0 0 0 12 3.5">
      <animateTransform
        attributeName="transform"
        type="rotate"
        from="0 12 12"
        to="360 12 12"
        dur="0.8s"
        repeatCount="indefinite"
      />
    </path>
  </svg>
);

/** Division marks. Abstract, one per division, keyed by `scene.shape`. */
/**
 * The security microsite's trust-strip marks. Same construction rules as the
 * shape marks below: one stroke weight, currentColor, no fills.
 */
export const securityMarks: Record<string, (p: IconProps) => JSX.Element> = {
  shield: (p) => (
    <svg {...base} width="24" height="24" {...p}>
      <path d="M12 3.5 5 6.2v5.6c0 4 2.9 7.2 7 8.2 4.1-1 7-4.2 7-8.2V6.2L12 3.5Z" />
      <path d="m9 12 2.2 2.2L15.2 10" />
    </svg>
  ),
  clock: (p) => (
    <svg {...base} width="24" height="24" {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.2V12l3.2 1.9" />
    </svg>
  ),
  wrench: (p) => (
    <svg {...base} width="24" height="24" {...p}>
      <path d="M15.4 4.2a4.4 4.4 0 0 0-5.2 5.6l-6 6a1.6 1.6 0 0 0 0 2.3l1.7 1.7a1.6 1.6 0 0 0 2.3 0l6-6a4.4 4.4 0 0 0 5.6-5.2l-2.7 2.7-2.6-.7-.7-2.6 2.6-2.7Z" />
    </svg>
  ),
  'phone-app': (p) => (
    <svg {...base} width="24" height="24" {...p}>
      <rect x="7" y="2.8" width="10" height="18.4" rx="2.4" />
      <path d="M10.6 5.6h2.8M12 17.6h.01" />
    </svg>
  ),
};

export const shapeMarks: Record<string, (p: IconProps) => JSX.Element> = {
  slab: (p) => (
    <svg {...base} width="28" height="28" {...p}>
      <path d="M3 14.5h18M5.5 14.5 7 9.5h10l1.5 5M7 18.5v-4M17 18.5v-4" />
    </svg>
  ),
  column: (p) => (
    <svg {...base} width="28" height="28" {...p}>
      <path d="M4 20h16M6 20V9.5l6-4.5 6 4.5V20M10 20v-5h4v5" />
    </svg>
  ),
  lattice: (p) => (
    <svg {...base} width="28" height="28" {...p}>
      <path d="M12 3.5 4.5 6.5v6c0 4.3 3.1 7.6 7.5 8.5 4.4-.9 7.5-4.2 7.5-8.5v-6L12 3.5Z" />
      <circle cx="12" cy="12" r="2.4" />
    </svg>
  ),
  stack: (p) => (
    <svg {...base} width="28" height="28" {...p}>
      <path d="M3 16.5V9h10v7.5M13 11.5h4.2l2.8 3.2v1.8" />
      <circle cx="7" cy="17.5" r="1.8" />
      <circle cx="17" cy="17.5" r="1.8" />
    </svg>
  ),
  ring: (p) => (
    <svg {...base} width="28" height="28" {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5c2.6 2.4 4 5.3 4 8.5s-1.4 6.1-4 8.5c-2.6-2.4-4-5.3-4-8.5s1.4-6.1 4-8.5Z" />
    </svg>
  ),
  arc: (p) => (
    <svg {...base} width="28" height="28" {...p}>
      <path d="M3.5 11a12 12 0 0 1 17 0M7 14.5a7 7 0 0 1 10 0" />
      <circle cx="12" cy="18.5" r="1.4" />
    </svg>
  ),
  prism: (p) => (
    <svg {...base} width="28" height="28" {...p}>
      <path d="m12 3.5 8.5 5v7l-8.5 5-8.5-5v-7l8.5-5ZM12 12l8.5-3.5M12 12v8.5M12 12 3.5 8.5" />
    </svg>
  ),
};
