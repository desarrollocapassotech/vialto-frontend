import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Power, RotateCcw, Upload } from "lucide-react";
import { LimpiarFiltrosPortal } from "@/components/listado/LimpiarFiltrosButton";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import {
  listadoTablaAccionesTdClass, listadoTablaTdClass,
  listadoTablaHeadRowClass,
  listadoTablaThClass,
} from "@/lib/listadoTabla";
import { labelBillingStatus, labelModulo } from "@/lib/platformLabels";
import { ViajesListadoHeaderFiltro } from "@/components/viajes/ViajesListadoHeaderFiltro";
import type { Tenant } from "@/types/api";
import { TenantViewModal } from "./TenantViewModal";
import { compararAlfabetico } from "@/lib/ordenAlfabetico";

interface TenantsTableProps {
  loading: boolean;
  items: Tenant[];
  statusUpdatingByOrgId: Record<string, boolean>;
  onToggleEnabled: (clerkOrgId: string, enabled: boolean) => void;
  /** Lugar junto al título de la página donde va "Limpiar filtros" (vía portal). */
  limpiarFiltrosSlot?: HTMLElement | null;
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
  limpiarFiltrosSlot,
}: TenantsTableProps) {
  const navigate = useNavigate();
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
      ).sort(compararAlfabetico),
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
      ).sort(compararAlfabetico),
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
      {viewingTenant && (
        <TenantViewModal
          tenant={viewingTenant}
          onClose={() => setViewingTenant(null)}
        />
      )}

      <LimpiarFiltrosPortal
        slot={limpiarFiltrosSlot}
        visible={anyFiltroActivo}
        onClick={limpiarFiltros}
        soloDesktop
      />

      <ListadoDatos
        className="mt-10"
        tableColSpan={5}
        tableHead={
          <tr className={listadoTablaHeadRowClass}>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Empresa"
                filterActive={!!filtroNombre}
                filterSignature={filtroNombre}
                onClear={() => setFiltroNombre("")}
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
                onClear={() => setFiltroSuscripcion("")}
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
              Módulos
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
        actionsTdClassName={`${listadoTablaAccionesTdClass} text-right`}
        rowActionsMaxIconos={3}
        rowActionsSubtitle={(tenant) => tenant.name}
        rowActions={(tenant) => {
          const deshabilitada = isDisabledStatus(tenant.billingStatus);
          return [
            { id: "ver", label: "Ver empresa", icon: Eye, onClick: () => setViewingTenant(tenant) },
            {
              id: "importar",
              label: "Importar",
              icon: Upload,
              onClick: () => navigate(`/superadmin/empresas/${tenant.clerkOrgId}/importar`),
            },
            {
              id: deshabilitada ? "habilitar" : "deshabilitar",
              label: deshabilitada ? "Habilitar empresa" : "Deshabilitar empresa",
              icon: deshabilitada ? RotateCcw : Power,
              danger: !deshabilitada,
              disabled: Boolean(statusUpdatingByOrgId[tenant.clerkOrgId]),
              onClick: () => onToggleEnabled(tenant.clerkOrgId, deshabilitada),
            },
          ];
        }}
      />
    </>
  );
}
