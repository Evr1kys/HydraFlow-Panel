import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { theme, globalStyles } from './theme';
import { App } from './App';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dates/styles.css';

// Inject global styles
const styleEl = document.createElement('style');
styleEl.textContent = globalStyles;
document.head.appendChild(styleEl);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <Notifications position="top-right" />
      <ModalsProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ModalsProvider>
    </MantineProvider>
  </React.StrictMode>,
);
