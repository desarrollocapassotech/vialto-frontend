import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, useNavigate } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import { esUY } from '@clerk/localizations';
import './index.css';
import App from './App.tsx';
import { initSentry } from './lib/sentry';
import { MissingClerkConfig } from './components/MissingClerkConfig';
import { ToastProvider } from './lib/toast';

initSentry();

const clerkPub = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function ClerkWithRouter() {
  const navigate = useNavigate();
  return (
    <ClerkProvider
      publishableKey={clerkPub!}
      localization={esUY}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      taskUrls={{
        'setup-mfa': '/tasks/setup-mfa',
        'choose-organization': '/tasks/choose-organization',
        'reset-password': '/tasks/reset-password',
      }}
    >
      <ToastProvider>
        <App />
      </ToastProvider>
    </ClerkProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {clerkPub ? (
      <HashRouter>
        <ClerkWithRouter />
      </HashRouter>
    ) : (
      <MissingClerkConfig />
    )}
  </StrictMode>,
);
