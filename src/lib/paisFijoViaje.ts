import type { Pais, Tenant } from "@/types/api";

/**
 * País fijo de origen/destino de Viajes (`Tenant.paisOrigenDestinoOculto` +
 * `paisOrigenDestinoFijoId`), o null si la empresa elige el país.
 *
 * Se busca en el catálogo de países; mientras ese catálogo no cargó, se arma con el
 * código y nombre que el backend ya resuelve en el tenant (`paisOrigenDestinoFijoCodigo`
 * / `Nombre`). Sin esto el selector de país aparecía un momento y desaparecía al llegar
 * la lista. Si el país fijado fue borrado (el backend no devuelve código y no está en
 * la lista), no aplica y se muestra el selector.
 */
export function resolverPaisFijoViaje(
  tenant:
    | (Pick<Tenant, "paisOrigenDestinoOculto" | "paisOrigenDestinoFijoId"> &
        Partial<
          Pick<
            Tenant,
            "paisOrigenDestinoFijoCodigo" | "paisOrigenDestinoFijoNombre" | "clerkOrgId"
          >
        >)
    | null
    | undefined,
  paises: Pais[],
): Pais | null {
  if (!tenant?.paisOrigenDestinoOculto || !tenant.paisOrigenDestinoFijoId) return null;
  const enLista = paises.find((p) => p.id === tenant.paisOrigenDestinoFijoId);
  if (enLista) return enLista;
  if (!tenant.paisOrigenDestinoFijoCodigo) return null;
  return {
    id: tenant.paisOrigenDestinoFijoId,
    tenantId: tenant.clerkOrgId ?? "",
    nombre: tenant.paisOrigenDestinoFijoNombre ?? tenant.paisOrigenDestinoFijoCodigo,
    codigo: tenant.paisOrigenDestinoFijoCodigo,
    esPredefinido: false,
    createdAt: "",
    createdBy: null,
  };
}
