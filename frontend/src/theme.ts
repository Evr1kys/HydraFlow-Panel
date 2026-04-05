import { createTheme, Button, ActionIcon, Card, Badge } from '@mantine/core';

export const palette = {
  primary: '#20C997',
  primaryDim: '#12B886',
  accent: '#339AF0',
  success: '#51CF66',
  warning: '#FCC419',
  danger: '#FF6B6B',
  violet: '#845EF7',
  orange: '#FF922B',
  surface0: '#0F1318',
  surface1: '#161B23',
  surface2: '#1E2128',
  surface3: '#2C2E33',
  border: 'rgba(255,255,255,0.06)',
  borderHi: 'rgba(255,255,255,0.12)',
  text: '#C1C2C5',
  textDim: '#909296',
  textMute: '#5c5f66',
};

export const theme = createTheme({
  primaryColor: 'teal',
  fontFamily: "'Outfit', sans-serif",
  fontFamilyMonospace: "'JetBrains Mono', monospace",
  colors: {
    dark: [
      '#C1C2C5', '#A6A7AB', '#909296', '#5c5f66',
      '#373A40', '#2C2E33', '#1E2128', '#161B23',
      '#0F1318', '#0A0E14',
    ],
  },
  defaultRadius: 'md',
  components: {
    Button: Button.extend({
      defaultProps: { radius: 'md' },
      styles: {
        root: {
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        },
      },
    }),
    ActionIcon: ActionIcon.extend({
      defaultProps: { radius: 'md', variant: 'subtle' },
    }),
    Card: Card.extend({
      defaultProps: { radius: 'md' },
    }),
    Badge: Badge.extend({
      defaultProps: { radius: 'md', variant: 'light' },
    }),
  },
});

export const globalStyles = `
  /* Thin dark scrollbar */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.14); }

  /* Pulsing animation for status dots */
  @keyframes pulse-dot {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  .pulse-dot { animation: pulse-dot 2s ease-in-out infinite; }

  /* Page/section staggered fade-in */
  @keyframes sectionFadeIn {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes cardFadeIn {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .hf-section {
    animation: sectionFadeIn 0.35s cubic-bezier(0.4, 0, 0.2, 1) both;
  }
  .hf-section:nth-child(1) { animation-delay: 0ms; }
  .hf-section:nth-child(2) { animation-delay: 80ms; }
  .hf-section:nth-child(3) { animation-delay: 160ms; }
  .hf-section:nth-child(4) { animation-delay: 240ms; }
  .hf-section:nth-child(5) { animation-delay: 320ms; }
  .hf-section:nth-child(6) { animation-delay: 400ms; }
  .hf-card {
    animation: cardFadeIn 0.25s ease-out both;
    animation-delay: calc(var(--i, 0) * 50ms + 150ms);
  }

  /* Teal-tinted skeleton shimmer */
  @keyframes hf-shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  .hf-skeleton {
    position: relative; overflow: hidden;
    background: #1E2128; border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.06);
  }
  .hf-skeleton::after {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(90deg,
      transparent 0%,
      rgba(32, 201, 151, 0.04) 25%,
      rgba(32, 201, 151, 0.10) 50%,
      rgba(32, 201, 151, 0.04) 75%,
      transparent 100%);
    animation: hf-shimmer 1.6s ease-in-out infinite;
  }

  /* Sidebar nav link micro-interactions */
  .hf-nav-link {
    position: relative; overflow: hidden;
    border-left: 3px solid transparent;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .hf-nav-link::before {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(135deg,
      transparent 0%, rgba(32, 201, 151, 0.06) 50%, transparent 100%);
    opacity: 0; transition: opacity 0.2s ease; pointer-events: none;
  }
  .hf-nav-link:hover::before { opacity: 1; }
  .hf-nav-link:hover { transform: translateX(2px); }
  .hf-nav-link:hover svg {
    transform: scale(1.08);
    filter: drop-shadow(0 2px 4px rgba(32, 201, 151, 0.35));
  }
  .hf-nav-link[data-active="true"] {
    background: linear-gradient(135deg,
      rgba(32, 201, 151, 0.15) 0%, rgba(32, 201, 151, 0.08) 100%);
    border-left-color: #20C997;
    transform: translateX(2px);
  }
  .hf-nav-link svg { transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); }

  /* Entity cards with teal glow on hover */
  .hf-entity-card {
    background: linear-gradient(135deg, #1E2128 0%, #161B23 50%, #0F1318 100%);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 12px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative; overflow: hidden;
  }
  .hf-entity-card::before {
    content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
    background: linear-gradient(90deg,
      transparent 0%, #20C997 50%, transparent 100%);
    opacity: 0.5; transition: opacity 0.3s ease;
  }
  .hf-entity-card:hover {
    box-shadow:
      0 20px 25px -5px rgba(0,0,0,0.3),
      0 0 0 1px #20C997,
      0 0 30px -5px rgba(32, 201, 151, 0.3);
    transform: translateY(-2px);
  }
  .hf-entity-card:hover::before { opacity: 1; }

  /* Button press micro-interaction */
  button:active, .mantine-Button-root:active { transform: scale(0.97); }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .hf-section, .hf-card, .hf-nav-link, .hf-entity-card, .pulse-dot {
      animation: none !important;
      transition: none !important;
    }
  }
`;
