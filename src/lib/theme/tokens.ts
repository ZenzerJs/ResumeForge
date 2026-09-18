/**
 * Forge Terminal Design System Tokens
 * Source of truth for all colors, typography, spacing, border-radius, shadows, and z-index.
 */

export const tokens = {
  colors: {
    // Brand Base & Surfaces (Deep Space dark mode hierarchy)
    background: '#0b1326',
    surface: '#0b1326',
    surfaceDim: '#0b1326',
    surfaceBright: '#31394d',
    surfaceContainerLowest: '#060e20',
    surfaceContainerLow: '#131b2e',
    surfaceContainer: '#171f33',
    surfaceContainerHigh: '#222a3d',
    surfaceContainerHighest: '#2d3449',
    surfaceVariant: '#2d3449',

    // Text & Content Contrast Tokens
    onBackground: '#dae2fd',
    onSurface: '#dae2fd',
    onSurfaceVariant: '#ddc1ae',
    inverseSurface: '#dae2fd',
    inverseOnSurface: '#283044',

    // Action & Brand Accent (High-energy Forge Orange)
    primary: '#ff8c00',
    onPrimary: '#4d2600',
    primaryContainer: '#ff8c00',
    onPrimaryContainer: '#623200',
    primaryFixed: '#ffdcc3',
    primaryFixedDim: '#ffb77d',
    inversePrimary: '#904d00',

    // Verification & Status Accent (Verified Emerald/Green)
    secondary: '#4edea3',
    onSecondary: '#003824',
    secondaryContainer: '#00a572',
    onSecondaryContainer: '#00311f',
    secondaryFixed: '#6ffbbe',
    secondaryFixedDim: '#4edea3',

    // Warning & Alert Accents
    tertiary: '#ffb3ad',
    onTertiary: '#68000a',
    tertiaryContainer: '#ff8780',

    // Error Tokens
    error: '#ffb4ab',
    onError: '#690005',
    errorContainer: '#93000a',
    onErrorContainer: '#ffdad6',

    // Borders & Outlines
    outline: '#a48c7a',
    outlineVariant: '#564334',

    // Translucency & Glow Overlays
    glassBg: 'rgba(45, 52, 73, 0.4)',
    glassBorder: 'rgba(164, 140, 122, 0.2)',
    glowPrimary: 'rgba(255, 140, 0, 0.15)',
    glowSecondary: 'rgba(78, 222, 163, 0.15)',
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
        fontWeight: '800',
        letterSpacing: '-0.02em',
      },
      pageTitleMobile: {
        fontSize: '32px',
        lineHeight: '1.2',
        fontWeight: '800',
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
    glass: '0 0 20px rgba(255, 140, 0, 0.05)',
    glowPrimary: '0 0 20px rgba(255, 140, 0, 0.2)',
    glowSecondary: '0 0 20px rgba(78, 222, 163, 0.2)',
    panel: '0 20px 40px -15px rgba(0, 0, 0, 0.5)',
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
