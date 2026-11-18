import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		borderRadius: {
  			DEFAULT: '0.125rem',
  			sm: '0.125rem',
  			md: '0.375rem',
  			lg: '0.5rem',
  			surface: '0.625rem',
  			xl: '0.75rem',
  			full: '9999px'
  		},
  		spacing: {
  			unit: '4px',
  			gutter: '16px',
  			'margin-desktop': '32px',
  			'margin-mobile': '16px',
  			'panel-padding': '20px'
  		},
      fontFamily: {
        sans: ['var(--font-hanken)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
        'page-title': ['var(--font-hanken)', 'sans-serif'],
        'page-title-mobile': ['var(--font-hanken)', 'sans-serif'],
        'body-regular': ['var(--font-hanken)', 'sans-serif'],
        'body-dense': ['var(--font-hanken)', 'sans-serif'],
        'section-label': ['var(--font-mono)', 'monospace'],
        'mono-data': ['var(--font-mono)', 'monospace']
      },
  		fontSize: {
  			'page-title': [
  				'40px',
  				{
  					lineHeight: '1.2',
  					letterSpacing: '-0.02em',
  					fontWeight: '700'
  				}
  			],
  			'page-title-mobile': [
  				'32px',
  				{
  					lineHeight: '1.2',
  					letterSpacing: '-0.02em',
  					fontWeight: '700'
  				}
  			],
  			'heading-xl': [
  				'28px',
  				{
  					lineHeight: '1.3',
  					letterSpacing: '-0.02em',
  					fontWeight: '700'
  				}
  			],
  			'heading-lg': [
  				'22px',
  				{
  					lineHeight: '1.3',
  					letterSpacing: '-0.01em',
  					fontWeight: '700'
  				}
  			],
  			'heading-md': [
  				'18px',
  				{
  					lineHeight: '1.4',
  					fontWeight: '600'
  				}
  			],
  			'body-regular': [
  				'16px',
  				{
  					lineHeight: '1.6',
  					fontWeight: '400'
  				}
  			],
  			'body-dense': [
  				'14px',
  				{
  					lineHeight: '1.4',
  					fontWeight: '400'
  				}
  			],
  			'mono-data': [
  				'13px',
  				{
  					lineHeight: '1.5',
  					fontWeight: '400'
  				}
  			],
  			'section-label': [
  				'12px',
  				{
  					lineHeight: '16px',
  					letterSpacing: '0.1em',
  					fontWeight: '600'
  				}
  			],
  			caption: [
  				'11px',
  				{
  					lineHeight: '1.4',
  					fontWeight: '400'
  				}
  			]
  		},
  		colors: {
        deep: 'rgb(var(--surface-deep) / <alpha-value>)',
        canvas: 'rgb(var(--surface-canvas) / <alpha-value>)',
        panel: 'rgb(var(--surface-panel) / <alpha-value>)',
        elevated: 'rgb(var(--surface-elevated) / <alpha-value>)',
        inset: 'rgb(var(--surface-inset) / <alpha-value>)',
        paper: 'rgb(var(--paper-sheet) / <alpha-value>)',
        'paper-ink': 'rgb(var(--paper-ink) / <alpha-value>)',
        'text-primary': 'rgb(var(--text-primary) / <alpha-value>)',
        'text-secondary': 'rgb(var(--text-secondary) / <alpha-value>)',
        'text-muted': 'rgb(var(--text-muted) / <alpha-value>)',
        hairline: 'rgb(var(--border-hairline) / <alpha-value>)',
        control: 'rgb(var(--border-control) / <alpha-value>)',
        'accent-secondary': 'rgb(var(--accent-secondary) / <alpha-value>)',
        ember: 'rgb(var(--accent-secondary) / <alpha-value>)',
        'accent-contrast': 'rgb(var(--accent-contrast) / <alpha-value>)',
        signal: 'rgb(var(--accent-contrast) / <alpha-value>)',
        'accent-ink': 'rgb(var(--accent-ink) / <alpha-value>)',
        'contrast-ink': 'rgb(var(--contrast-ink) / <alpha-value>)',
        'status-success': 'rgb(var(--status-success) / <alpha-value>)',
        'status-warning': 'rgb(var(--status-warning) / <alpha-value>)',
        'status-danger': 'rgb(var(--status-danger) / <alpha-value>)',
        'status-info': 'rgb(var(--status-info) / <alpha-value>)',

        background: 'rgb(var(--surface-canvas) / <alpha-value>)',
        foreground: 'rgb(var(--text-primary) / <alpha-value>)',
        surface: 'rgb(var(--surface-canvas) / <alpha-value>)',
        'surface-dim': 'rgb(var(--surface-canvas) / <alpha-value>)',
        'surface-bright': 'rgb(var(--surface-elevated) / <alpha-value>)',
        'surface-container-lowest': 'rgb(var(--surface-inset) / <alpha-value>)',
        'surface-container-low': 'rgb(var(--surface-canvas) / <alpha-value>)',
        'surface-container': 'rgb(var(--surface-panel) / <alpha-value>)',
        'surface-container-high': 'rgb(var(--surface-elevated) / <alpha-value>)',
        'surface-container-highest': 'rgb(var(--surface-elevated) / <alpha-value>)',
        'surface-variant': 'rgb(var(--surface-elevated) / <alpha-value>)',
        'on-background': 'rgb(var(--text-primary) / <alpha-value>)',
        'on-surface': 'rgb(var(--text-primary) / <alpha-value>)',
        'on-surface-variant': 'rgb(var(--text-secondary) / <alpha-value>)',
        'inverse-surface': 'rgb(var(--paper-sheet) / <alpha-value>)',
        'inverse-on-surface': 'rgb(var(--paper-ink) / <alpha-value>)',
        primary: 'rgb(var(--accent-action) / <alpha-value>)',
        'on-primary': 'rgb(var(--accent-ink) / <alpha-value>)',
        'primary-container': 'rgb(var(--accent-action) / <alpha-value>)',
        'on-primary-container': 'rgb(var(--accent-ink) / <alpha-value>)',
        'primary-fixed': 'rgb(var(--accent-action) / <alpha-value>)',
        'primary-fixed-dim': 'rgb(var(--accent-action) / <alpha-value>)',
        'inverse-primary': 'rgb(var(--accent-ink) / <alpha-value>)',
        secondary: 'rgb(var(--status-success) / <alpha-value>)',
        'on-secondary': 'rgb(var(--accent-ink) / <alpha-value>)',
        'secondary-container': 'rgb(var(--status-success) / <alpha-value>)',
        'on-secondary-container': 'rgb(var(--accent-ink) / <alpha-value>)',
        'secondary-fixed': 'rgb(var(--status-success) / <alpha-value>)',
        'secondary-fixed-dim': 'rgb(var(--status-success) / <alpha-value>)',
        tertiary: 'rgb(var(--status-danger) / <alpha-value>)',
        'on-tertiary': 'rgb(var(--accent-ink) / <alpha-value>)',
        'tertiary-container': 'rgb(var(--status-danger) / <alpha-value>)',
        'on-tertiary-container': 'rgb(var(--accent-ink) / <alpha-value>)',
        error: 'rgb(var(--status-danger) / <alpha-value>)',
        'on-error': 'rgb(var(--accent-ink) / <alpha-value>)',
        'error-container': 'rgb(var(--status-danger) / <alpha-value>)',
        'on-error-container': 'rgb(var(--text-primary) / <alpha-value>)',
        border: 'rgb(var(--border-hairline) / <alpha-value>)',
        outline: 'rgb(var(--border-control) / <alpha-value>)',
        'outline-variant': 'rgb(var(--border-hairline) / <alpha-value>)',

        /* shadcn semantic tokens */
        card: 'rgb(var(--surface-panel) / <alpha-value>)',
        'card-foreground': 'rgb(var(--text-primary) / <alpha-value>)',
        popover: 'rgb(var(--surface-elevated) / <alpha-value>)',
        'popover-foreground': 'rgb(var(--text-primary) / <alpha-value>)',
        muted: 'rgb(var(--surface-elevated) / <alpha-value>)',
        'muted-foreground': 'rgb(var(--text-muted) / <alpha-value>)',
        accent: 'rgb(var(--surface-elevated) / <alpha-value>)',
        'accent-foreground': 'rgb(var(--text-primary) / <alpha-value>)',
        'primary-foreground': 'rgb(var(--accent-ink) / <alpha-value>)',
        'secondary-foreground': 'rgb(var(--accent-ink) / <alpha-value>)',
        destructive: 'rgb(var(--status-danger) / <alpha-value>)',
        'destructive-foreground': 'rgb(var(--accent-ink) / <alpha-value>)',
        input: 'rgb(var(--surface-inset) / <alpha-value>)',
        ring: 'rgb(var(--focus-ring) / <alpha-value>)',

        /* Legacy rf.* aliases mapped to Section 0 tokens */
        rf: {
          bg: 'rgb(var(--surface-canvas) / <alpha-value>)',
          surface: 'rgb(var(--surface-panel) / <alpha-value>)',
          elevated: 'rgb(var(--surface-elevated) / <alpha-value>)',
          cloud: 'rgb(var(--text-primary) / <alpha-value>)',
          body: 'rgb(var(--text-primary) / <alpha-value>)',
          meta: 'rgb(var(--text-muted) / <alpha-value>)',
          border: 'rgb(var(--border-hairline) / <alpha-value>)',
          amber: 'rgb(var(--accent-action) / <alpha-value>)',
          emerald: 'rgb(var(--status-success) / <alpha-value>)'
        },
        /* Alias slate to warm Ember Ink stone/espresso so zero cool navy/blue-gray leaks */
        slate: {
          50: '#f4eee7',
          100: '#f4eee7',
          200: '#e6ddd3',
          300: '#d0c5b9',
          400: '#9e9287',
          500: '#7a6e65',
          600: '#5c514a',
          700: '#3a322f',
          800: '#272120',
          900: '#1b1716',
          950: '#151211',
        }
  		}
  	}
  },
  plugins: [],
};

export default config;
