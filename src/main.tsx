import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
// Fonts are bundled with the app (no request to Google Fonts): Mitr for headings, IBM Plex Sans Thai for text.
import '@fontsource/mitr/500.css';
import '@fontsource/mitr/600.css';
import '@fontsource/ibm-plex-sans-thai/400.css';
import '@fontsource/ibm-plex-sans-thai/600.css';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
