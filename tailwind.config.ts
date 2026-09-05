import type { Config } from 'tailwindcss';

/**
 * Colours are declared as `r g b` channel triplets in globals.css so Tailwind's
 * `/opacity` syntax works on every token. The `accent-*` family reads from CSS
 * variables that a themed subtree can override — that is how one division page
 * recolours its buttons, focus rings and rules without any per-page CSS.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  // Every hover: / group-hover: variant compiles inside
  // @media (hover: hover) and (pointer: fine). A touch browser applies :hover
  // on tap and leaves it stuck, which is wrong for a phone-first site.
  future: {
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          soft: 'rgb(var(--ink-soft) / <alpha-value>)',
          mute: 'rgb(var(--ink-mute) / <alpha-value>)',
        },
        paper: {
          DEFAULT: 'rgb(var(--paper) / <alpha-value>)',
          raised: 'rgb(var(--paper-raised) / <alpha-value>)',
          sunk: 'rgb(var(--paper-sunk) / <alpha-value>)',
        },
        night: {
          DEFAULT: 'rgb(var(--night) / <alpha-value>)',
          soft: 'rgb(var(--night-soft) / <alpha-value>)',
          line: 'rgb(var(--night-line) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'rgb(var(--line) / <alpha-value>)',
          strong: 'rgb(var(--line-strong) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          ink: 'rgb(var(--accent-ink) / <alpha-value>)',
          soft: 'rgb(var(--accent-soft) / <alpha-value>)',
          contrast: 'rgb(var(--accent-contrast) / <alpha-value>)',
          bright: 'rgb(var(--accent-bright) / <alpha-value>)',
        },
        danger: 'rgb(var(--danger) / <alpha-value>)',
        ok: 'rgb(var(--ok) / <alpha-value>)',
      },

      fontFamily: {
        // Display: Archivo — a tight, squarish grotesk with real presence at
        // large sizes. Body: Inter — neutral, optically tuned for small text.
        display: ['var(--font-display)', 'Archivo', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
      },

      /**
       * A modular scale, roughly 1.25 at the top and 1.15 through the text
       * sizes. Tracking is size-specific and tightens as type grows — a single
       * global letter-spacing is wrong somewhere by definition.
       */
      fontSize: {
        micro: ['0.6875rem', { lineHeight: '1.35', letterSpacing: '0.1em' }],
        caption: ['0.8125rem', { lineHeight: '1.5', letterSpacing: '0.004em' }],
        body: ['1rem', { lineHeight: '1.65', letterSpacing: '0em' }],
        'body-lg': ['1.125rem', { lineHeight: '1.6', letterSpacing: '-0.006em' }],
        lead: ['1.375rem', { lineHeight: '1.45', letterSpacing: '-0.014em' }],
        'card-title': ['1.5rem', { lineHeight: '1.2', letterSpacing: '-0.022em' }],
        h3: ['1.875rem', { lineHeight: '1.15', letterSpacing: '-0.026em' }],
        h2: ['2.75rem', { lineHeight: '1.06', letterSpacing: '-0.032em' }],
        h1: ['3.75rem', { lineHeight: '1.0', letterSpacing: '-0.038em' }],
        display: ['5.5rem', { lineHeight: '0.92', letterSpacing: '-0.045em' }],
        'display-xl': ['7rem', { lineHeight: '0.9', letterSpacing: '-0.05em' }],
      },

      /** Vertical rhythm: section padding steps, used as `py-section` etc. */
      spacing: {
        section: '5rem',
        'section-lg': '7.5rem',
      },

      maxWidth: {
        prose: '68ch',
        measure: '62ch',
        shell: '84rem',
      },

      borderRadius: {
        card: '1.25rem',
        panel: '1.75rem',
      },

      boxShadow: {
        // Soft ambient elevation, never a hard drop shadow (collectui pattern).
        raise: '0 1px 2px rgb(var(--ink) / 0.04), 0 12px 28px -18px rgb(var(--ink) / 0.30)',
        lift: '0 1px 2px rgb(var(--ink) / 0.05), 0 26px 60px -32px rgb(var(--ink) / 0.42)',
        float: '0 2px 4px rgb(var(--ink) / 0.06), 0 40px 90px -44px rgb(var(--ink) / 0.55)',
      },

      transitionTimingFunction: {
        // Mirrored pair, so a reversible transition retraces its own path.
        'out-soft': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'in-soft': 'cubic-bezier(0.64, 0, 0.78, 0)',
      },

    },
  },
  plugins: [],
};

export default config;
