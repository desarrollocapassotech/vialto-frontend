import { AuthenticateWithRedirectCallback, SignUp, useAuth } from '@clerk/clerk-react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { HomePage } from '@/pages/HomePage';
import { ViajesPage } from '@/pages/ViajesPage';
import { ClientesPage } from '@/pages/ClientesPage';
import { ChoferesPage } from '@/pages/ChoferesPage';
import { VehiculosPage } from '@/pages/VehiculosPage';
import { SuperadminTenantCreatePage } from '@/pages/SuperadminTenantCreatePage';
import { SuperadminTenantEditPage } from '@/pages/SuperadminTenantEditPage';
import { ClienteCreatePage } from '@/pages/ClienteCreatePage';
import { ClienteEditPage } from '@/pages/ClienteEditPage';
import { ChoferCreatePage } from '@/pages/ChoferCreatePage';
import { ChoferEditPage } from '@/pages/ChoferEditPage';
import { VehiculoCreatePage } from '@/pages/VehiculoCreatePage';
import { VehiculoEditPage } from '@/pages/VehiculoEditPage';
import { ViajeCreatePage } from '@/pages/ViajeCreatePage';
import { ViajeEditPage } from '@/pages/ViajeEditPage';
import { SuperadminEmpresasPage } from '@/pages/SuperadminEmpresasPage';
import { SuperadminUsersPage } from '@/pages/SuperadminUsersPage';
import { SuperadminUserCreatePage } from '@/pages/SuperadminUserCreatePage';
import { SuperadminUserEditPage } from '@/pages/SuperadminUserEditPage';
import { PasswordSignInPage } from '@/pages/PasswordSignInPage';

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
        path="/sign-in"
        element={<PasswordSignInPage />}
      />
      <Route
        path="/sign-in/clerk/*"
        element={<Navigate to="/sign-in" replace />}
      />
      <Route
        path="/sso-callback"
        element={
          <div className="min-h-screen flex items-center justify-center bg-vialto-charcoal px-4">
            <AuthenticateWithRedirectCallback signInFallbackRedirectUrl="/" />
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
          <Route path="viajes/nuevo" element={<ViajeCreatePage />} />
          <Route path="viajes/:id/editar" element={<ViajeEditPage />} />
          <Route path="clientes" element={<ClientesPage />} />
          <Route path="clientes/nuevo" element={<ClienteCreatePage />} />
          <Route path="clientes/:id/editar" element={<ClienteEditPage />} />
          <Route path="choferes" element={<ChoferesPage />} />
          <Route path="choferes/nuevo" element={<ChoferCreatePage />} />
          <Route path="choferes/:id/editar" element={<ChoferEditPage />} />
          <Route path="vehiculos" element={<VehiculosPage />} />
          <Route path="vehiculos/nuevo" element={<VehiculoCreatePage />} />
          <Route path="vehiculos/:id/editar" element={<VehiculoEditPage />} />
          <Route path="superadmin/empresas" element={<SuperadminEmpresasPage />} />
          <Route path="superadmin/usuarios" element={<SuperadminUsersPage />} />
          <Route path="superadmin/usuarios/nuevo" element={<SuperadminUserCreatePage />} />
          <Route path="superadmin/usuarios/:userId/editar" element={<SuperadminUserEditPage />} />
          <Route path="superadmin/empresas/nueva" element={<SuperadminTenantCreatePage />} />
          <Route
            path="superadmin/empresas/:orgId/editar"
            element={<SuperadminTenantEditPage />}
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
