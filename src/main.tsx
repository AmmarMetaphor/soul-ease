import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { env } from './config/env';
import { RESOURCES_VERIFIED_FOR_PRODUCTION } from './safety/resources';
import './index.css';

if (!RESOURCES_VERIFIED_FOR_PRODUCTION) {
  // Loud, deliberate, and present in every build until resources are verified.
  console.warn(
    '[Soul Ease] Crisis resources in src/safety/resources.ts are NOT verified. Do not deploy this build to production.',
  );
}
if (env.isDemoMode) {
  console.info('[Soul Ease] Running in DEMO MODE — data is stored in this browser only.');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
