import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import { esUY } from '@clerk/localizations';
import './index.css';
import App from './App.tsx';
import { initSentry } from './lib/sentry';
import { MissingClerkConfig } from './components/MissingClerkConfig';

initSentry();

const clerkPub = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {clerkPub ? (
      <ClerkProvider
        publishableKey={clerkPub}
        localization={esUY}
        signInUrl="/#/sign-in"
        signUpUrl="/#/sign-up"
      >
        <HashRouter>
          <App />
        </HashRouter>
      </ClerkProvider>
    ) : (
      <MissingClerkConfig />
    )}
  </StrictMode>,
);
