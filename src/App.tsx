import { SignIn, SignUp, useAuth } from '@clerk/clerk-react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { HomePage } from '@/pages/HomePage';
import { ViajesPage } from '@/pages/ViajesPage';
import { ClientesPage } from '@/pages/ClientesPage';
import { ChoferesPage } from '@/pages/ChoferesPage';
import { VehiculosPage } from '@/pages/VehiculosPage';

function RequireAuth() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-vialto-mist text-vialto-steel">
        Un momento…
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route
        path="/sign-in/*"
        element={
          <div className="min-h-screen flex items-center justify-center bg-vialto-charcoal px-4">
            <SignIn
              routing="path"
              path="/sign-in"
              signUpUrl="/sign-up"
              appearance={{
                elements: {
                  rootBox: 'mx-auto',
                  card: 'bg-vialto-graphite border border-white/10 shadow-xl',
                  headerTitle: 'font-display text-2xl tracking-wide',
                  headerSubtitle: 'text-white/60',
                  formButtonPrimary:
                    'bg-vialto-fire hover:bg-vialto-bright text-sm uppercase tracking-wider',
                  footerActionLink: 'text-vialto-bright hover:text-vialto-light',
                },
              }}
            />
          </div>
        }
      />
      <Route
        path="/sign-up/*"
        element={
          <div className="min-h-screen flex items-center justify-center bg-vialto-charcoal px-4">
            <SignUp
              routing="path"
              path="/sign-up"
              signInUrl="/sign-in"
              appearance={{
                elements: {
                  rootBox: 'mx-auto',
                  card: 'bg-vialto-graphite border border-white/10 shadow-xl',
                  headerTitle: 'font-display text-2xl tracking-wide',
                  formButtonPrimary:
                    'bg-vialto-fire hover:bg-vialto-bright text-sm uppercase tracking-wider',
                  footerActionLink: 'text-vialto-bright hover:text-vialto-light',
                },
              }}
            />
          </div>
        }
      />

      <Route element={<RequireAuth />}>
        <Route path="/" element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="viajes" element={<ViajesPage />} />
          <Route path="clientes" element={<ClientesPage />} />
          <Route path="choferes" element={<ChoferesPage />} />
          <Route path="vehiculos" element={<VehiculosPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
