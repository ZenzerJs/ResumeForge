/**
 * Unified Studio Design System Tokens
 * Mirrors the Section 0 CSS custom properties in src/app/globals.css.
 */

export const tokens = {
  colors: {
    // Studio Surfaces — Ember Ink (Section 0)
    deep: 'rgb(10, 8, 8)',
    background: 'rgb(18, 16, 16)',
    surface: 'rgb(18, 16, 16)',
    surfaceDim: 'rgb(18, 16, 16)',
    surfaceBright: 'rgb(39, 33, 32)',
    surfaceContainerLowest: 'rgb(21, 18, 17)',
    surfaceContainerLow: 'rgb(18, 16, 16)',
    surfaceContainer: 'rgb(27, 23, 22)',
    surfaceContainerHigh: 'rgb(39, 33, 32)',
    surfaceContainerHighest: 'rgb(39, 33, 32)',
    surfaceVariant: 'rgb(39, 33, 32)',
    paperSheet: 'rgb(255, 255, 255)',
    paperInk: 'rgb(28, 30, 32)',

    // Text & Content Contrast Tokens
    onBackground: 'rgb(244, 238, 231)',
    onSurface: 'rgb(244, 238, 231)',
    onSurfaceVariant: 'rgb(208, 197, 185)',
    textMuted: 'rgb(158, 146, 135)',
    inverseSurface: 'rgb(255, 255, 255)',
    inverseOnSurface: 'rgb(28, 30, 32)',

    // Action & Brand Accent (Gold + Ember + Electric Blue 3-color motif)
    primary: 'rgb(247, 189, 63)',
    onPrimary: 'rgb(42, 28, 0)',
    primaryContainer: 'rgb(247, 189, 63)',
    onPrimaryContainer: 'rgb(42, 28, 0)',
    primaryFixed: 'rgb(247, 189, 63)',
    primaryFixedDim: 'rgb(247, 189, 63)',
    inversePrimary: 'rgb(42, 28, 0)',
    accentSecondary: 'rgb(255, 139, 61)',
    accentContrast: 'rgb(79, 143, 255)',
    contrastInk: 'rgb(3, 19, 47)',

    // Verification & Status Tokens
    secondary: 'rgb(107, 214, 154)',
    onSecondary: 'rgb(42, 28, 0)',
    secondaryContainer: 'rgb(107, 214, 154)',
    onSecondaryContainer: 'rgb(42, 28, 0)',
    secondaryFixed: 'rgb(107, 214, 154)',
    secondaryFixedDim: 'rgb(107, 214, 154)',

    // Warning & Alert Accents
    tertiary: 'rgb(255, 138, 128)',
    onTertiary: 'rgb(42, 28, 0)',
    tertiaryContainer: 'rgb(255, 138, 128)',
    statusInfo: 'rgb(79, 143, 255)',

    // Error Tokens
    error: 'rgb(255, 138, 128)',
    onError: 'rgb(42, 28, 0)',
    errorContainer: 'rgb(255, 138, 128)',
    onErrorContainer: 'rgb(244, 238, 231)',

    // Borders & Outlines
    outline: 'rgb(122, 110, 101)',
    outlineVariant: 'rgb(58, 50, 47)',
  },

  typography: {
    fontFamilies: {
      headline: "'Hanken Grotesk', sans-serif",
      body: "'Hanken Grotesk', sans-serif",
      mono: "'JetBrains Mono', monospace",
    },
    scale: {
      pageTitle: {
        fontSize: '40px',
        lineHeight: '1.2',
        fontWeight: '700',
        letterSpacing: '-0.02em',
      },
      pageTitleMobile: {
        fontSize: '32px',
        lineHeight: '1.2',
        fontWeight: '700',
        letterSpacing: '-0.02em',
      },
      headingXl: {
        fontSize: '28px',
        lineHeight: '1.3',
        fontWeight: '700',
        letterSpacing: '-0.02em',
      },
      headingLg: {
        fontSize: '22px',
        lineHeight: '1.3',
        fontWeight: '700',
        letterSpacing: '-0.01em',
      },
      headingMd: {
        fontSize: '18px',
        lineHeight: '1.4',
        fontWeight: '600',
      },
      bodyRegular: {
        fontSize: '16px',
        lineHeight: '1.6',
        fontWeight: '400',
      },
      bodyDense: {
        fontSize: '14px',
        lineHeight: '1.4',
        fontWeight: '400',
      },
      monoData: {
        fontSize: '13px',
        lineHeight: '1.5',
        fontWeight: '400',
      },
      sectionLabel: {
        fontSize: '12px',
        lineHeight: '16px',
        fontWeight: '600',
        letterSpacing: '0.1em',
      },
      caption: {
        fontSize: '11px',
        lineHeight: '1.4',
        fontWeight: '400',
      },
    },
  },

  spacing: {
    unit: '4px',
    gutter: '16px',
    marginMobile: '16px',
    marginDesktop: '32px',
    panelPadding: '20px',
  },

  borderRadius: {
    sm: '0.125rem', // 2px
    default: '0.25rem', // 4px
    md: '0.375rem', // 6px
    lg: '0.5rem', // 8px
    xl: '0.75rem', // 12px
    full: '9999px',
  },

  shadows: {
    paper: '0 4px 16px rgba(0, 0, 0, 0.45)',
    panel: '0 10px 25px -5px rgba(0, 0, 0, 0.45)',
  },

  zIndex: {
    behind: -1,
    base: 0,
    content: 10,
    overlay: 20,
    sticky: 30,
    modal: 40,
    nav: 50,
    toast: 60,
  },
} as const;

export type ThemeTokens = typeof tokens;
