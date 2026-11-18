import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Power, RotateCcw, Upload } from "lucide-react";
import { LimpiarFiltrosPortal } from "@/components/listado/LimpiarFiltrosButton";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import {
  listadoTablaAccionesTdClass,
  listadoTablaTdClass,
  listadoTablaHeadRowClass,
  listadoTablaThClass,
} from "@/lib/listadoTabla";
import { labelBillingStatus, labelModulo } from "@/lib/platformLabels";
import { ViajesListadoHeaderFiltro } from "@/components/viajes/ViajesListadoHeaderFiltro";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { fmtDateUtc } from "@/lib/fmtDateUtc";
import type { Tenant } from "@/types/api";
import { compararAlfabetico } from "@/lib/ordenAlfabetico";

interface TenantsTableProps {
  loading: boolean;
  items: Tenant[];
  statusUpdatingByOrgId: Record<string, boolean>;
  onToggleEnabled: (clerkOrgId: string, enabled: boolean) => void;
  /** Lugar junto al título de la página donde va "Limpiar filtros" (vía portal). */
  limpiarFiltrosSlot?: HTMLElement | null;
}

export function TenantsTable({
  loading,
  items,
  statusUpdatingByOrgId,
  onToggleEnabled,
  limpiarFiltrosSlot,
}: TenantsTableProps) {
  const navigate = useNavigate();

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
  // SearchableSelect ya ordena A→Z.
  const opcionesNombre = useMemo(
    () =>
      Array.from(
        new Set(
          (items || []).map((t) => t.name).filter((v): v is string => !!v),
        ),
      ).map((name) => ({ value: name, label: name })),
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
                <SearchableSelect
                  value={filtroNombre}
                  onChange={setFiltroNombre}
                  options={opcionesNombre}
                  placeholder="Todas"
                  searchPlaceholder="Buscar empresa…"
                  triggerClassName={filtroNombre ? "text-vialto-fire" : ""}
                  ariaLabel="Filtrar por empresa"
                />
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
            // Deshabilitada (suspendida o vencida): nombre tachado y en gris; el backend
            // ya las manda al final del listado.
            cell: (tenant) =>
              isDisabledStatus(tenant.billingStatus) ? (
                <span className="text-vialto-steel line-through">
                  {tenant.name}
                </span>
              ) : (
                tenant.name
              ),
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
            // Solo la cantidad; el detalle va en el tooltip (y en la ficha de la empresa).
            cell: (tenant) =>
              tenant.modules.length === 0 ? (
                <span className="text-vialto-steel">0</span>
              ) : (
                <span
                  title={tenant.modules.map(labelModulo).join("\n")}
                  className="cursor-default tabular-nums"
                >
                  {tenant.modules.length}
                </span>
              ),
            tdClassName: `${listadoTablaTdClass} whitespace-nowrap`,
          },
          {
            id: "alta",
            header: "Alta",
            cell: (tenant) => fmtDateUtc(tenant.createdAt),
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
            // Sin modal intermedio: "Ver empresa" abre la ficha (datos + configuración).
            {
              id: "ver",
              label: "Ver empresa",
              icon: Eye,
              onClick: () =>
                navigate(
                  `/superadmin/empresas/${encodeURIComponent(tenant.clerkOrgId)}`,
                ),
            },
            {
              id: "importar",
              label: "Importar",
              icon: Upload,
              onClick: () =>
                navigate(`/superadmin/empresas/${tenant.clerkOrgId}/importar`),
            },
            {
              id: deshabilitada ? "habilitar" : "deshabilitar",
              label: deshabilitada
                ? "Habilitar empresa"
                : "Deshabilitar empresa",
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
