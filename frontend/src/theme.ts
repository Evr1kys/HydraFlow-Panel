import { createTheme } from '@mantine/core';

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
});

export const globalStyles = `
  /* Thin dark scrollbar */
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  ::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.08);
    border-radius: 3px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: rgba(255,255,255,0.14);
  }

  /* Pulsing animation for status dots */
  @keyframes pulse-dot {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  .pulse-dot {
    animation: pulse-dot 2s ease-in-out infinite;
  }

  /* Constellation background particles */
  @keyframes float-particle {
    0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
    25% { transform: translateY(-20px) translateX(10px); opacity: 0.6; }
    50% { transform: translateY(-10px) translateX(-10px); opacity: 0.2; }
    75% { transform: translateY(-30px) translateX(5px); opacity: 0.5; }
  }
`;
