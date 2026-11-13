import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import Capture from './views/Capture';
import Mini from './views/Mini';
import '@fontsource/instrument-serif/latin-400.css';
import '@fontsource/instrument-serif/latin-400-italic.css';
import './styles.css';

function route(): string {
  return window.location.hash.replace(/^#/, '') || '/';
}

if (route() === '/mini') document.documentElement.classList.add('is-mini');

function Root() {
  const r = route();
  if (r === '/capture') return <Capture />;
  if (r === '/mini') return <Mini />;
  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
