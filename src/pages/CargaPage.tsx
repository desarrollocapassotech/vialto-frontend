import { useUser } from '@clerk/clerk-react';
import { isPlatformSuperadmin } from '@/lib/roleLabels';
import { TiposCargaTenantPage } from '@/pages/CargaTenantPage';

export function TiposCargaPage() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="text-vialto-steel py-12 text-center">Un momento…</div>
    );
  }

  if (isPlatformSuperadmin(user?.publicMetadata)) {
    return (
      <div className="w-full max-w-2xl">
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-wide text-vialto-charcoal">
          Cargas
        </h1>
        <p className="mt-3 text-vialto-steel">
          Para administrar el catálogo de cargas de una empresa, usá el conmutador de organización de Clerk
          y entrá con una cuenta de esa empresa, o gestioná viajes desde{' '}
          <span className="font-medium text-vialto-charcoal">Empresas</span> y el flujo de edición
          de viajes con <code className="text-xs bg-vialto-mist px-1">tenantId</code> en la URL.
        </p>
      </div>
    );
  }

  return <TiposCargaTenantPage />;
}
