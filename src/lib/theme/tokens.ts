/**
 * Unified Studio Design System Tokens
 * Mirrors the Section 0 CSS custom properties in src/app/globals.css.
 */

export const tokens = {
  colors: {
    // Studio Surfaces (Section 0)
    background: 'rgb(21, 24, 26)',
    surface: 'rgb(21, 24, 26)',
    surfaceDim: 'rgb(21, 24, 26)',
    surfaceBright: 'rgb(37, 42, 45)',
    surfaceContainerLowest: 'rgb(17, 20, 22)',
    surfaceContainerLow: 'rgb(21, 24, 26)',
    surfaceContainer: 'rgb(28, 32, 35)',
    surfaceContainerHigh: 'rgb(37, 42, 45)',
    surfaceContainerHighest: 'rgb(37, 42, 45)',
    surfaceVariant: 'rgb(37, 42, 45)',
    paperSheet: 'rgb(255, 255, 255)',
    paperInk: 'rgb(28, 30, 32)',

    // Text & Content Contrast Tokens
    onBackground: 'rgb(237, 239, 237)',
    onSurface: 'rgb(237, 239, 237)',
    onSurfaceVariant: 'rgb(194, 201, 199)',
    textMuted: 'rgb(151, 161, 159)',
    inverseSurface: 'rgb(255, 255, 255)',
    inverseOnSurface: 'rgb(28, 30, 32)',

    // Action & Brand Accent
    primary: 'rgb(241, 181, 101)',
    onPrimary: 'rgb(31, 24, 14)',
    primaryContainer: 'rgb(241, 181, 101)',
    onPrimaryContainer: 'rgb(31, 24, 14)',
    primaryFixed: 'rgb(241, 181, 101)',
    primaryFixedDim: 'rgb(241, 181, 101)',
    inversePrimary: 'rgb(31, 24, 14)',

    // Verification & Status Tokens
    secondary: 'rgb(124, 204, 165)',
    onSecondary: 'rgb(31, 24, 14)',
    secondaryContainer: 'rgb(124, 204, 165)',
    onSecondaryContainer: 'rgb(31, 24, 14)',
    secondaryFixed: 'rgb(124, 204, 165)',
    secondaryFixedDim: 'rgb(124, 204, 165)',

    // Warning & Alert Accents
    tertiary: 'rgb(242, 148, 144)',
    onTertiary: 'rgb(31, 24, 14)',
    tertiaryContainer: 'rgb(242, 148, 144)',
    statusInfo: 'rgb(145, 186, 217)',

    // Error Tokens
    error: 'rgb(242, 148, 144)',
    onError: 'rgb(31, 24, 14)',
    errorContainer: 'rgb(242, 148, 144)',
    onErrorContainer: 'rgb(237, 239, 237)',

    // Borders & Outlines
    outline: 'rgb(119, 130, 129)',
    outlineVariant: 'rgb(55, 62, 64)',
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
