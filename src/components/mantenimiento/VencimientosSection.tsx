import { useEffect, useMemo, useState } from "react";
import { Wrench } from "lucide-react";
import { ListadoDatos } from "@/components/listado/ListadoDatos";
import { SearchableEntitySelect } from "@/components/forms/SearchableEntitySelect";
import { filtrarVehiculos } from "@/components/forms/maestroSearchFilters";
import { ViajesListadoHeaderFiltro } from "@/components/viajes/ViajesListadoHeaderFiltro";
import { AccionesFila } from "@/components/ui/AccionesFila";
import { EstadoVencimientoBadge } from "@/components/mantenimiento/MantenimientoBadges";
import { useMaestroData } from "@/hooks/useMaestroData";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { listadoTablaHeadRowClass, listadoTablaTdClass, listadoTablaThClass } from "@/lib/listadoTabla";
import { mantUrl } from "@/lib/mantenimientoApi";
import {
  CATEGORIA_PLAN_LABELS,
  ESTADO_VENCIMIENTO,
  ESTADOS_VENCIMIENTO_ORDEN,
  fmtFaltan,
  fmtFecha,
  fmtKm,
  fmtOrigenKm,
  fmtReferencia,
} from "@/lib/mantenimientoLabels";
import type { Vehiculo } from "@/types/api";
import type { EstadoVencimiento, FilaVencimiento, PrecargaOrden } from "@/types/mantenimiento";

const CONTADOR_ACTIVO: Record<EstadoVencimiento, string> = {
  vencido: "border-red-300 bg-red-50",
  proximo: "border-amber-300 bg-amber-50",
  sin_datos: "border-gray-300 bg-gray-100",
  ok: "border-emerald-300 bg-emerald-50",
};

/**
 * Pestaña Vencimientos (default de Mantenimiento): el semáforo que calcula el backend
 * (`GET mantenimiento/vencimientos`), una fila por plan asignado a una unidad. Se trae una vez y
 * se filtra en el cliente, así los contadores no cambian al filtrar.
 */
export function VencimientosSection({
  getToken,
  tenantId,
  soloLectura,
  reloadKey,
  onRegistrarService,
}: {
  getToken: () => Promise<string | null>;
  tenantId?: string;
  soloLectura: boolean;
  reloadKey: number;
  onRegistrarService: (precarga: PrecargaOrden) => void;
}) {
  const maestro = useMaestroData();
  const [filas, setFilas] = useState<FilaVencimiento[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoVencimiento | "">("");
  const [vehiculoId, setVehiculoId] = useState("");
  const [categoria, setCategoria] = useState("");

  useEffect(() => {
    let cancelado = false;
    setFilas(null);
    apiJson<FilaVencimiento[]>(mantUrl("vencimientos", tenantId), () => getToken())
      .then((data) => {
        if (cancelado) return;
        setFilas(data);
        setError(null);
      })
      .catch((e) => {
        if (cancelado) return;
        setFilas([]);
        setError(friendlyError(e, "mantenimiento"));
      });
    return () => {
      cancelado = true;
    };
  }, [getToken, tenantId, reloadKey]);

  const contadores = useMemo(() => {
    const c: Record<EstadoVencimiento, number> = { vencido: 0, proximo: 0, sin_datos: 0, ok: 0 };
    for (const f of filas ?? []) c[f.estado]++;
    return c;
  }, [filas]);

  const hayFiltros = !!estado || !!vehiculoId || !!categoria;
  const filtradas = useMemo(() => {
    if (!filas) return null;
    return filas.filter(
      (f) =>
        (!estado || f.estado === estado) &&
        (!vehiculoId || f.vehiculo.id === vehiculoId) &&
        (!categoria || f.plan.categoria === categoria),
    );
  }, [filas, estado, vehiculoId, categoria]);

  const vehiculosConPlanes = useMemo(() => {
    const ids = new Set((filas ?? []).map((f) => f.vehiculo.id));
    return maestro.vehiculos.filter((v) => ids.has(v.id));
  }, [filas, maestro.vehiculos]);

  function registrarService(f: FilaVencimiento) {
    onRegistrarService({
      vehiculoId: f.vehiculo.id,
      vehiculoPlanIds: [f.vehiculoPlanId],
      tareas: f.plan.tareas,
      km: f.odometro?.km ?? null,
    });
  }

  return (
    <div>
      {error && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      )}

      {/* Contadores: un click filtra por ese estado; otro click lo saca. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ESTADOS_VENCIMIENTO_ORDEN.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setEstado(estado === e ? "" : e)}
            aria-pressed={estado === e}
            className={[
              "flex flex-col items-start rounded border px-4 py-3 text-left transition-colors",
              estado === e ? CONTADOR_ACTIVO[e] : "border-black/10 bg-white hover:bg-vialto-mist",
            ].join(" ")}
          >
            <span className="font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.16em] text-vialto-steel">
              {ESTADO_VENCIMIENTO[e].contador}
            </span>
            <span className="mt-1 font-[family-name:var(--font-display)] text-3xl tabular-nums">
              {filas ? contadores[e] : "–"}
            </span>
          </button>
        ))}
      </div>

      <ListadoDatos<FilaVencimiento>
        className="mt-6"
        tableColSpan={soloLectura ? 7 : 8}
        tableHead={
          <tr className={listadoTablaHeadRowClass}>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Estado"
                filterActive={!!estado}
                filterSignature={estado}
                onClear={() => setEstado("")}
              >
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value as EstadoVencimiento | "")}
                  aria-label="Filtrar por estado"
                  className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${estado ? "text-vialto-fire" : ""}`}
                >
                  <option value="">Todos</option>
                  {ESTADOS_VENCIMIENTO_ORDEN.map((e) => (
                    <option key={e} value={e}>
                      {ESTADO_VENCIMIENTO[e].contador}
                    </option>
                  ))}
                </select>
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Vehículo"
                filterActive={!!vehiculoId}
                filterSignature={vehiculoId}
                onClear={() => setVehiculoId("")}
              >
                <SearchableEntitySelect<Vehiculo>
                  id="vencimientos-filtro-unidad"
                  items={vehiculosConPlanes}
                  value={vehiculoId}
                  onChange={setVehiculoId}
                  filterItems={filtrarVehiculos}
                  getPrimaryLabel={(v) => v.patente}
                  getSecondaryLabel={(v) => [v.marca, v.modelo].filter(Boolean).join(" · ") || null}
                  placeholderCerrado="Todos"
                  placeholderBuscar="Buscar patente o marca…"
                  searchAriaLabel="Filtrar vehículos"
                  allowEmptyValue
                  emptyListChoiceLabel="Todos"
                  aria-label="Filtrar por vehículo"
                  inputClassName={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${vehiculoId ? "text-vialto-fire" : "text-vialto-charcoal"}`}
                />
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Plan"
                filterActive={!!categoria}
                filterSignature={categoria}
                onClear={() => setCategoria("")}
              >
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  aria-label="Filtrar por categoría"
                  className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${categoria ? "text-vialto-fire" : ""}`}
                >
                  <option value="">Mecánicos y documentales</option>
                  <option value="mecanico">Mecánicos</option>
                  <option value="documental">Documentales</option>
                </select>
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={listadoTablaThClass}>Faltan</th>
            <th scope="col" className={listadoTablaThClass}>Fecha estimada</th>
            <th scope="col" className={listadoTablaThClass}>Km actual</th>
            <th scope="col" className={listadoTablaThClass}>Último service</th>
            {!soloLectura && <th scope="col" className={`${listadoTablaThClass} text-right`}>Acciones</th>}
          </tr>
        }
        columns={[
          { id: "estado", header: "Estado", cell: (f) => <EstadoVencimientoBadge estado={f.estado} /> },
          { id: "unidad", header: "Vehículo", primary: true, cell: (f) => f.vehiculo.patente },
          {
            id: "plan",
            header: "Plan",
            cell: (f) => (
              <span>
                {f.plan.nombre}
                <span className="block text-xs text-vialto-steel">{CATEGORIA_PLAN_LABELS[f.plan.categoria] ?? f.plan.categoria}</span>
              </span>
            ),
          },
          {
            id: "faltan",
            header: "Faltan",
            cell: (f) => (
              <span className={f.estado === "vencido" ? "font-medium text-red-700" : f.estado === "proximo" ? "font-medium text-amber-800" : ""}>
                {fmtFaltan(f)}
              </span>
            ),
          },
          { id: "fechaEstimada", header: "Fecha estimada", cell: (f) => fmtFecha(f.fechaEstimada) },
          {
            id: "km",
            header: "Km actual",
            cell: (f) => (
              <span>
                {fmtKm(f.odometro?.km)}
                <span className="block text-xs text-vialto-steel">{fmtOrigenKm(f.odometro)}</span>
              </span>
            ),
          },
          { id: "referencia", header: "Último service", cell: (f) => <span className="text-sm">{fmtReferencia(f)}</span> },
        ]}
        rows={error ? [] : filtradas}
        rowKey={(f) => f.vehiculoPlanId}
        emptyMessage={
          error
            ? "No se pudieron cargar los vencimientos."
            : hayFiltros
              ? "No hay vencimientos que coincidan con los filtros aplicados."
              : "Todavía no hay planes asignados a los vehículos."
        }
        loadingMessage="Calculando vencimientos…"
        actionsTdClassName={listadoTablaTdClass}
        renderActions={
          soloLectura
            ? undefined
            : (f) => (
                <AccionesFila
                  options={[{ id: "registrar", label: "Registrar service", icon: Wrench, onClick: () => registrarService(f) }]}
                  destacadas={["registrar"]}
                />
              )
        }
      />
    </div>
  );
}
