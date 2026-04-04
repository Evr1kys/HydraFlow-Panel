import { createTheme, MantineColorsTuple } from '@mantine/core';

const dark: MantineColorsTuple = [
  '#c8d4e6','#97a8c2','#556880','#2a3a52','#1a2940','#111b30','#0b1121','#060a12','#040810','#030508',
];

export const theme = createTheme({
  primaryColor: 'teal',
  colors: { dark },
  fontFamily: 'Outfit, sans-serif',
  fontFamilyMonospace: 'JetBrains Mono, monospace',
  headings: { fontFamily: 'Outfit, sans-serif', fontWeight: '600' },
});
