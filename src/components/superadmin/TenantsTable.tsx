import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Upload } from "lucide-react";
import { LimpiarFiltrosPortal } from "@/components/listado/LimpiarFiltrosButton";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import {
  listadoTablaAccionesTdClass,
  listadoTablaTdClass,
  listadoTablaHeadRowClass,
  listadoTablaThClass,
} from "@/lib/listadoTabla";
import { labelModulo } from "@/lib/platformLabels";
import { ViajesListadoHeaderFiltro } from "@/components/viajes/ViajesListadoHeaderFiltro";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { fmtDateUtc } from "@/lib/fmtDateUtc";
import type { Tenant } from "@/types/api";

interface TenantsTableProps {
  loading: boolean;
  items: Tenant[];
  /** Lugar junto al título de la página donde va "Limpiar filtros" (vía portal). */
  limpiarFiltrosSlot?: HTMLElement | null;
}

export function TenantsTable({
  loading,
  items,
  limpiarFiltrosSlot,
}: TenantsTableProps) {
  const navigate = useNavigate();
  const [filtroNombre, setFiltroNombre] = useState("");

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

  const itemsFiltrados = useMemo(
    () => (items ?? []).filter((t) => !filtroNombre || t.name === filtroNombre),
    [items, filtroNombre],
  );

  return (
    <>
      <LimpiarFiltrosPortal
        slot={limpiarFiltrosSlot}
        visible={!!filtroNombre}
        onClick={() => setFiltroNombre("")}
        soloDesktop
      />

      <ListadoDatos
        className="mt-10"
        tableColSpan={4}
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
            id: "modulos",
            header: "Módulos",
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
          filtroNombre
            ? "No hay empresas que coincidan con los filtros aplicados."
            : "No encontramos empresas para este criterio."
        }
        loadingMessage="Cargando empresas…"
        actionsTdClassName={`${listadoTablaAccionesTdClass} text-right`}
        rowActionsSubtitle={(tenant) => tenant.name}
        rowActions={(tenant) => [
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
              navigate(
                `/superadmin/empresas/${encodeURIComponent(tenant.clerkOrgId)}/importar`,
              ),
          },
        ]}
      />
    </>
  );
}
