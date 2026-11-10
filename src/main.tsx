import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import Capture from './views/Capture';
import Mini from './views/Mini';
import './styles.css';

function route(): string {
  return window.location.hash.replace(/^#/, '') || '/';
}

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
