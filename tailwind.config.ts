import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
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
  					fontWeight: '800'
  				}
  			],
  			'page-title-mobile': [
  				'32px',
  				{
  					lineHeight: '1.2',
  					letterSpacing: '-0.02em',
  					fontWeight: '800'
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
        background: 'rgb(var(--theme-background) / <alpha-value>)',
  			foreground: '#dae2fd',
        surface: 'rgb(var(--theme-background) / <alpha-value>)',
        'surface-dim': 'rgb(var(--theme-background) / <alpha-value>)',
  			'surface-bright': '#31394d',
  			'surface-container-lowest': '#060e20',
  			'surface-container-low': '#131b2e',
        'surface-container': 'rgb(var(--theme-card) / <alpha-value>)',
        'surface-container-high': 'rgb(var(--theme-muted) / <alpha-value>)',
  			'surface-container-highest': '#2d3449',
  			'surface-variant': '#2d3449',
  			'on-background': '#dae2fd',
  			'on-surface': '#dae2fd',
  			'on-surface-variant': '#a3afc4',
  			'inverse-surface': '#dae2fd',
  			'inverse-on-surface': '#283044',
  			primary: '#ff8c00',
  			'on-primary': '#4d2600',
  			'primary-container': '#ff8c00',
  			'on-primary-container': '#623200',
  			'primary-fixed': '#ffdcc3',
  			'primary-fixed-dim': '#ffb77d',
  			'inverse-primary': '#904d00',
  			secondary: '#4edea3',
  			'on-secondary': '#003824',
  			'secondary-container': '#00a572',
  			'on-secondary-container': '#00311f',
  			'secondary-fixed': '#6ffbbe',
  			'secondary-fixed-dim': '#4edea3',
  			tertiary: '#ffb3ad',
  			'on-tertiary': '#68000a',
  			'tertiary-container': '#ff8780',
  			'on-tertiary-container': '#830010',
  			error: '#ffb4ab',
  			'on-error': '#690005',
  			'error-container': '#93000a',
  			'on-error-container': '#ffdad6',
        border: 'rgb(var(--theme-border) / calc(var(--theme-border-alpha) * <alpha-value>))',
  			outline: '#475569',
  			'outline-variant': '#2b3550',
  			/* shadcn semantic tokens (were undefined, so bg-card / bg-muted rendered transparent) */
        card: 'rgb(var(--theme-card) / <alpha-value>)',
  			'card-foreground': '#dae2fd',
        popover: 'rgb(var(--theme-popover) / <alpha-value>)',
  			'popover-foreground': '#dae2fd',
        muted: 'rgb(var(--theme-muted) / <alpha-value>)',
  			'muted-foreground': '#94a3b8',
        accent: 'rgb(var(--theme-accent) / <alpha-value>)',
  			'accent-foreground': '#dae2fd',
  			'primary-foreground': '#1a0e00',
  			'secondary-foreground': '#003824',
  			destructive: '#f87171',
  			'destructive-foreground': '#0b1326',
        input: 'rgb(var(--theme-input) / <alpha-value>)',
  			ring: '#ff8c00',
  			rf: {
          bg: 'rgb(var(--rf-bg-rgb) / <alpha-value>)',
        surface: 'rgb(var(--rf-surface-rgb) / <alpha-value>)',
          elevated: 'rgb(var(--rf-elevated-rgb) / <alpha-value>)',
  				cloud: 'var(--rf-cloud)',
  				body: 'var(--rf-body)',
  				meta: 'var(--rf-meta)',
  				border: 'var(--rf-border)',
  				amber: 'var(--rf-amber)',
  				emerald: 'var(--rf-emerald)'
  			}
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [],
};

export default config;
