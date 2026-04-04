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
