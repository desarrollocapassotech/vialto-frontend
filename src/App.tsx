import { AuthenticateWithRedirectCallback, useAuth } from '@clerk/clerk-react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { HomePage } from '@/pages/HomePage';
import { ViajesPage } from '@/pages/ViajesPage';
import { BaseDeDatosPage } from '@/pages/BaseDeDatosPage';
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
import { IngresosStockPage } from '@/pages/IngresosStockPage';
import { IngresosStockHistorialPage } from '@/pages/IngresosStockHistorialPage';
import { EgresosStockPage } from '@/pages/EgresosStockPage';
import { EgresosStockHistorialPage } from '@/pages/EgresosStockHistorialPage';
import { DivisionesStockPage } from '@/pages/DivisionesStockPage';
import { DivisionesStockHistorialPage } from '@/pages/DivisionesStockHistorialPage';
import { MovimientoStockDetallePage } from '@/pages/MovimientoStockDetallePage';
import { StockMovimientosPage } from '@/pages/StockMovimientosPage';
import { FacturacionPage } from '@/pages/FacturacionPage';
import { SuperadminEmpresasPage } from '@/pages/SuperadminEmpresasPage';
import { SuperadminUsersPage } from '@/pages/SuperadminUsersPage';
import { SuperadminUserCreatePage } from '@/pages/SuperadminUserCreatePage';
import { SuperadminUserEditPage } from '@/pages/SuperadminUserEditPage';
import { SuperadminArcaPage } from '@/pages/SuperadminArcaPage';
import { LiquidacionesTenantPage } from '@/pages/LiquidacionesTenantPage';
import { PasswordSignInPage } from '@/pages/PasswordSignInPage';
import { PasswordSignUpPage } from '@/pages/PasswordSignUpPage';
import { TaskSetupMFAPage } from '@/pages/TaskSetupMFAPage';
import { TaskChooseOrganizationPage } from '@/pages/TaskChooseOrganizationPage';

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
      <Route path="/tasks/setup-mfa" element={<TaskSetupMFAPage />} />
      <Route path="/tasks/choose-organization" element={<TaskChooseOrganizationPage />} />

      <Route element={<RequireAuth />}>
        <Route path="/" element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="viajes" element={<ViajesPage />} />
          <Route path="viajes/nuevo" element={<ViajeCreatePage />} />
          <Route path="viajes/:id/editar" element={<Navigate to="/viajes" replace />} />
          <Route path="facturacion" element={<FacturacionPage />} />
          <Route path="liquidaciones" element={<LiquidacionesTenantPage />} />
          <Route path="base-de-datos" element={<BaseDeDatosPage />} />
          {/* rutas legacy → redirigen al tab correspondiente en /base-de-datos */}
          <Route path="clientes" element={<Navigate to="/base-de-datos?tab=clientes" replace />} />
          <Route path="transportistas" element={<Navigate to="/base-de-datos?tab=transportistas" replace />} />
          <Route path="choferes" element={<Navigate to="/base-de-datos?tab=choferes" replace />} />
          <Route path="vehiculos" element={<Navigate to="/base-de-datos?tab=vehiculos" replace />} />
          <Route path="stock/productos" element={<Navigate to="/base-de-datos?tab=productos" replace />} />
          <Route path="stock/depositos" element={<Navigate to="/base-de-datos?tab=depositos" replace />} />
          <Route path="clientes/nuevo" element={<ClienteCreatePage />} />
          <Route path="clientes/:id/editar" element={<ClienteEditPage />} />
          <Route path="transportistas/nuevo" element={<TransportistaCreatePage />} />
          <Route path="transportistas/:id/editar" element={<TransportistaEditPage />} />
          <Route path="choferes/nuevo" element={<ChoferCreatePage />} />
          <Route path="choferes/:id/editar" element={<ChoferEditPage />} />
          <Route path="vehiculos/nuevo" element={<VehiculoCreatePage />} />
          <Route path="vehiculos/:id/editar" element={<VehiculoEditPage />} />
          <Route path="stock/ingresos" element={<IngresosStockPage />} />
          <Route path="stock/ingresos/historial" element={<IngresosStockHistorialPage />} />
          <Route path="stock/egresos" element={<EgresosStockPage />} />
          <Route path="stock/egresos/historial" element={<EgresosStockHistorialPage />} />
          <Route path="stock/divisiones" element={<DivisionesStockPage />} />
          <Route path="stock/divisiones/historial" element={<DivisionesStockHistorialPage />} />
          <Route path="stock/movimientos" element={<StockMovimientosPage />} />
          <Route path="stock/movimientos/:id" element={<MovimientoStockDetallePage />} />
          <Route path="superadmin/empresas" element={<SuperadminEmpresasPage />} />
          <Route path="superadmin/usuarios" element={<SuperadminUsersPage />} />
          <Route path="superadmin/arca" element={<SuperadminArcaPage />} />
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
