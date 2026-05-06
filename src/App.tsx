import { AuthenticateWithRedirectCallback, useAuth } from '@clerk/clerk-react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { HomePage } from '@/pages/HomePage';
import { ViajesPage } from '@/pages/ViajesPage';
import { ClientesPage } from '@/pages/ClientesPage';
import { TransportistasPage } from '@/pages/TransportistasPage';
import { ChoferesPage } from '@/pages/ChoferesPage';
import { VehiculosPage } from '@/pages/VehiculosPage';
import { SuperadminTenantCreatePage } from '@/pages/SuperadminTenantCreatePage';
import { SuperadminTenantEditPage } from '@/pages/SuperadminTenantEditPage';
import { ClienteCreatePage } from '@/pages/ClienteCreatePage';
import { ClienteEditPage } from '@/pages/ClienteEditPage';
import { TransportistaCreatePage } from '@/pages/TransportistaCreatePage';
import { TransportistaEditPage } from '@/pages/TransportistaEditPage';
import { ChoferCreatePage } from '@/pages/ChoferCreatePage';
import { ChoferEditPage } from '@/pages/ChoferEditPage';
import { VehiculoCreatePage } from '@/pages/VehiculoCreatePage';
import { VehiculoEditPage } from '@/pages/VehiculoEditPage';
import { ViajeCreatePage } from '@/pages/ViajeCreatePage';
import { TiposCargaPage } from '@/pages/CargaPage';
import { FacturacionPage } from '@/pages/FacturacionPage';
import { SuperadminEmpresasPage } from '@/pages/SuperadminEmpresasPage';
import { SuperadminUsersPage } from '@/pages/SuperadminUsersPage';
import { SuperadminUserCreatePage } from '@/pages/SuperadminUserCreatePage';
import { SuperadminUserEditPage } from '@/pages/SuperadminUserEditPage';
import { PasswordSignInPage } from '@/pages/PasswordSignInPage';
import { PasswordSignUpPage } from '@/pages/PasswordSignUpPage';

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
            <AuthenticateWithRedirectCallback signInFallbackRedirectUrl="/#/" />
          </div>
        }
      />
      <Route path="/sign-up/*" element={<PasswordSignUpPage />} />

      <Route element={<RequireAuth />}>
        <Route path="/" element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="viajes" element={<ViajesPage />} />
          <Route path="cargas" element={<TiposCargaPage />} />
          <Route path="tipos-carga" element={<Navigate to="/cargas" replace />} />
          <Route path="viajes/nuevo" element={<ViajeCreatePage />} />
          <Route path="viajes/:id/editar" element={<Navigate to="/viajes" replace />} />
          <Route path="facturacion" element={<FacturacionPage />} />
          <Route path="clientes" element={<ClientesPage />} />
          <Route path="clientes/nuevo" element={<ClienteCreatePage />} />
          <Route path="clientes/:id/editar" element={<ClienteEditPage />} />
          <Route path="transportistas" element={<TransportistasPage />} />
          <Route path="transportistas/nuevo" element={<TransportistaCreatePage />} />
          <Route path="transportistas/:id/editar" element={<TransportistaEditPage />} />
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
