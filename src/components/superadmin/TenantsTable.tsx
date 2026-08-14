import { useState, useMemo } from "react";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import {
  listadoTablaAccionClass,
  listadoTablaTdClass,
  listadoTablaHeadRowClass,
  listadoTablaThClass,
} from "@/lib/listadoTabla";
import { labelBillingStatus, labelModulo } from "@/lib/platformLabels";
import { ViajesListadoHeaderFiltro } from "@/components/viajes/ViajesListadoHeaderFiltro";
import type { Tenant } from "@/types/api";
import { ImportacionModal } from "./ImportacionModal";
import { TenantViewModal } from "./TenantViewModal";

interface TenantsTableProps {
  loading: boolean;
  items: Tenant[];
  statusUpdatingByOrgId: Record<string, boolean>;
  onToggleEnabled: (clerkOrgId: string, enabled: boolean) => void;
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("es-AR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

export function TenantsTable({
  loading,
  items,
  statusUpdatingByOrgId,
  onToggleEnabled,
}: TenantsTableProps) {
  const [importTenant, setImportTenant] = useState<Tenant | null>(null);
  const [viewingTenant, setViewingTenant] = useState<Tenant | null>(null);

  // Estados de los filtros de columna
  const [filtroNombre, setFiltroNombre] = useState("");
  const [filtroSuscripcion, setFiltroSuscripcion] = useState("");

  const isDisabledStatus = (status: string) =>
    ["suspended", "expired"].includes(status.toLowerCase());

  function limpiarFiltros() {
    setFiltroNombre("");
    setFiltroSuscripcion("");
  }

  const anyFiltroActivo = !!filtroNombre || !!filtroSuscripcion;

  // Extracción de opciones únicas para los selectores
  const opcionesNombre = useMemo(
    () =>
      Array.from(
        new Set(
          (items || []).map((t) => t.name).filter((v): v is string => !!v),
        ),
      ).sort(),
    [items],
  );
  const opcionesSuscripcion = useMemo(
    () =>
      Array.from(
        new Set(
          (items || [])
            .map((t) => t.billingStatus)
            .filter((v): v is string => !!v),
        ),
      ).sort(),
    [items],
  );

  const itemsFiltrados = useMemo(() => {
    if (!items) return [];
    return items.filter((t) => {
      if (filtroNombre && t.name !== filtroNombre) return false;
      if (filtroSuscripcion && t.billingStatus !== filtroSuscripcion)
        return false;
      return true;
    });
  }, [items, filtroNombre, filtroSuscripcion]);

  return (
    <>
      {importTenant && (
        <ImportacionModal
          tenantId={importTenant.clerkOrgId}
          tenantName={importTenant.name}
          tenantModules={importTenant.modules}
          onClose={() => setImportTenant(null)}
        />
      )}
      {viewingTenant && (
        <TenantViewModal
          tenant={viewingTenant}
          onClose={() => setViewingTenant(null)}
        />
      )}

      {anyFiltroActivo && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={limpiarFiltros}
            className="hidden lg:inline-flex h-10 items-center px-4 border border-black/20 text-vialto-steel text-sm uppercase tracking-wider hover:bg-vialto-mist"
          >
            Limpiar filtros
          </button>
        </div>
      )}

      <ListadoDatos
        className={anyFiltroActivo ? "mt-4" : "mt-10"}
        tableColSpan={5}
        tableHead={
          <tr className={listadoTablaHeadRowClass}>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Empresa"
                filterActive={!!filtroNombre}
                filterSignature={filtroNombre}
              >
                <select
                  value={filtroNombre}
                  onChange={(e) => setFiltroNombre(e.target.value)}
                  className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                    filtroNombre ? "text-vialto-fire" : "text-vialto-charcoal"
                  }`}
                  aria-label="Filtrar por Empresa"
                >
                  <option value="">Todas</option>
                  {opcionesNombre.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Suscripción"
                filterActive={!!filtroSuscripcion}
                filterSignature={filtroSuscripcion}
              >
                <select
                  value={filtroSuscripcion}
                  onChange={(e) => setFiltroSuscripcion(e.target.value)}
                  className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                    filtroSuscripcion
                      ? "text-vialto-fire"
                      : "text-vialto-charcoal"
                  }`}
                  aria-label="Filtrar por Suscripción"
                >
                  <option value="">Todas</option>
                  {opcionesSuscripcion.map((o) => (
                    <option key={o} value={o}>
                      {labelBillingStatus(o)}
                    </option>
                  ))}
                </select>
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={listadoTablaThClass}>
              Funciones
            </th>
            <th scope="col" className={listadoTablaThClass}>
              Alta
            </th>
            <th scope="col" className={`${listadoTablaThClass} text-right`}>
              Acciones
            </th>
          </tr>
        }
        columns={[
          {
            id: "empresa",
            header: "Empresa",
            primary: true,
            cell: (tenant) => tenant.name,
            tdClassName: `${listadoTablaTdClass} font-medium`,
          },
          {
            id: "suscripcion",
            header: "Suscripción",
            cell: (tenant) => (
              <span className="inline-block font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-wider px-2 py-0.5 bg-vialto-charcoal text-white">
                {labelBillingStatus(tenant.billingStatus)}
              </span>
            ),
            tdClassName: listadoTablaTdClass,
          },
          {
            id: "funciones",
            header: "Funciones",
            cell: (tenant) =>
              tenant.modules.length === 0 ? (
                <span className="text-vialto-steel">Ninguna</span>
              ) : (
                <span className="flex flex-wrap gap-1">
                  {tenant.modules.slice(0, 4).map((m) => (
                    <span
                      key={m}
                      className="inline-block text-[11px] px-2 py-0.5 bg-vialto-mist text-vialto-charcoal rounded"
                    >
                      {labelModulo(m)}
                    </span>
                  ))}
                  {tenant.modules.length > 4 ? (
                    <span className="text-xs text-vialto-steel self-center">
                      +{tenant.modules.length - 4}
                    </span>
                  ) : null}
                </span>
              ),
            tdClassName: `${listadoTablaTdClass} max-w-[240px]`,
          },
          {
            id: "alta",
            header: "Alta",
            cell: (tenant) => formatDate(tenant.createdAt),
            tdClassName: `${listadoTablaTdClass} text-vialto-steel whitespace-nowrap`,
          },
        ]}
        rows={loading ? null : itemsFiltrados}
        rowKey={(tenant) => tenant.id}
        emptyMessage={
          anyFiltroActivo
            ? "No hay empresas que coincidan con los filtros aplicados."
            : "No encontramos empresas para este criterio."
        }
        loadingMessage="Cargando empresas…"
        actionsTdClassName={listadoTablaTdClass}
        renderActions={(tenant) => (
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={!isDisabledStatus(tenant.billingStatus)}
              aria-label={`Estado de ${tenant.name}`}
              disabled={Boolean(statusUpdatingByOrgId[tenant.clerkOrgId])}
              onClick={() =>
                onToggleEnabled(
                  tenant.clerkOrgId,
                  isDisabledStatus(tenant.billingStatus),
                )
              }
              className={[
                "group relative inline-flex h-7 w-28 items-center rounded-full border transition-colors px-2",
                isDisabledStatus(tenant.billingStatus)
                  ? "bg-white border-black/20"
                  : "bg-vialto-charcoal border-vialto-charcoal",
                statusUpdatingByOrgId[tenant.clerkOrgId]
                  ? "opacity-60 cursor-wait"
                  : "cursor-pointer",
              ].join(" ")}
            >
              <span
                className={[
                  "w-full text-[10px] uppercase tracking-wider text-center select-none",
                  isDisabledStatus(tenant.billingStatus)
                    ? "text-vialto-steel"
                    : "text-white",
                ].join(" ")}
              >
                {isDisabledStatus(tenant.billingStatus)
                  ? "Deshabilitado"
                  : "Habilitado"}
              </span>
              <span
                className={[
                  "absolute h-5 w-5 rounded-full shadow-sm transition-transform",
                  isDisabledStatus(tenant.billingStatus)
                    ? "left-1 bg-vialto-steel/70"
                    : "left-[5.5rem] bg-white",
                ].join(" ")}
              />
            </button>
            <button
              type="button"
              onClick={() => setImportTenant(tenant)}
              className={listadoTablaAccionClass}
            >
              Importar
            </button>
            <button
              type="button"
              onClick={() => setViewingTenant(tenant)}
              className={listadoTablaAccionClass}
            >
              Ver
            </button>
          </div>
        )}
      />
    </>
  );
}
