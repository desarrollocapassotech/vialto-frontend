import { useCallback, useEffect, useMemo, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { CrudFieldError } from "@/components/crud/CrudFieldError";
import { CrudFieldLabel, CrudSelect } from "@/components/crud/CrudFields";
import { CrudFormErrorAlert } from "@/components/crud/CrudFormErrorAlert";
import { SearchableEntitySelect } from "@/components/forms/SearchableEntitySelect";
import { filtrarVehiculos } from "@/components/forms/maestroSearchFilters";
import { FechaPicker } from "@/components/mantenimiento/FechaPicker";
import { TareasMantenimientoSelect } from "@/components/mantenimiento/TareasMantenimientoSelect";
import { TallerSelect } from "@/components/mantenimiento/TallerSelect";
import { PlanesCumpleCheckboxes } from "@/components/mantenimiento/PlanesCumpleCheckboxes";
import { AdjuntosOrdenField } from "@/components/mantenimiento/AdjuntosOrdenField";
import { ItemsCostoFieldset } from "@/components/mantenimiento/ItemsCostoFieldset";
import { nuevaLineaCosto, type LineaCosto } from "@/lib/mantenimientoCostos";
import { EstadoOrdenBadge } from "@/components/mantenimiento/MantenimientoBadges";
import { Spinner } from "@/components/ui/Spinner";
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
  viewModalGridClass,
} from "@/components/ui/ViewModalShell";
import { useMaestroData } from "@/hooks/useMaestroData";
import { apiJson } from "@/lib/api";
import { formatCurrencyArFromNumber, parseCurrencyAr } from "@/lib/currencyMask";
import { friendlyError } from "@/lib/friendlyError";
import { mantUrl } from "@/lib/mantenimientoApi";
import {
  fmtFecha,
  fmtKm,
  fmtMoneda,
  fmtTareas,
  fmtTipoOrden,
  TIPO_ORDEN_LABELS,
} from "@/lib/mantenimientoLabels";
import { useToast } from "@/lib/toast";
import type { Vehiculo } from "@/types/api";
import type {
  OrdenTrabajoDetalle,
  OrdenTrabajoGuardada,
  PrecargaOrden,
  Taller,
  TareaMantenimiento,
  TipoOrden,
  VehiculoPlanAsignado,
} from "@/types/mantenimiento";

export type OrdenModalEstado =
  | { modo: "crear"; precarga?: PrecargaOrden }
  | { modo: "ver" | "editar"; ordenId: string };

const INPUT = "h-10 w-full border bg-white px-3 text-sm";

function hoyIso(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">{label}</p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

/**
 * Orden de trabajo: ver (read-only) → editar, y alta (vacía o precargada desde
 * "Registrar service" de un vencimiento). Si el backend devuelve `warning` (km que no cierra
 * con el odómetro), la orden queda guardada y se muestra en modo ver con el aviso.
 */
export function OrdenTrabajoModal({
  estado,
  soloLectura,
  getToken,
  tenantId,
  onClose,
  onGuardada,
}: {
  estado: OrdenModalEstado;
  /** Usuario sin permiso de escritura (member): sin "Editar". */
  soloLectura: boolean;
  getToken: () => Promise<string | null>;
  tenantId?: string;
  onClose: () => void;
  /** Se guardó, anuló o cambió algo: el padre recarga sus listas. */
  onGuardada: () => void;
}) {
  const { showToast } = useToast();
  const maestro = useMaestroData();

  const [modo, setModo] = useState<"crear" | "ver" | "editar">(estado.modo);
  const [orden, setOrden] = useState<OrdenTrabajoDetalle | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [cargando, setCargando] = useState(estado.modo !== "crear");
  const [talleres, setTalleres] = useState<Taller[]>([]);

  // ── Formulario ──
  const precarga = estado.modo === "crear" ? estado.precarga : undefined;
  const [vehiculoId, setVehiculoId] = useState(precarga?.vehiculoId ?? "");
  const [tipo, setTipo] = useState<TipoOrden>("preventivo");
  const [fecha, setFecha] = useState(hoyIso());
  const [km, setKm] = useState(precarga?.km != null ? String(precarga.km) : "");
  const [kmTocado, setKmTocado] = useState(precarga?.km != null);
  const [tallerId, setTallerId] = useState("");
  const [tareas, setTareas] = useState<TareaMantenimiento[]>(precarga?.tareas ?? []);
  const [vehiculoPlanIds, setVehiculoPlanIds] = useState<string[]>(precarga?.vehiculoPlanIds ?? []);
  const [planesUnidad, setPlanesUnidad] = useState<VehiculoPlanAsignado[]>([]);
  const [lineas, setLineas] = useState<LineaCosto[]>([]);
  const [adjuntos, setAdjuntos] = useState<string[]>([]);
  const [descripcion, setDescripcion] = useState("");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [lineaErrors, setLineaErrors] = useState<Record<string, { descripcion?: string; importe?: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargarFormDesde = useCallback((o: OrdenTrabajoDetalle) => {
    setVehiculoId(o.vehiculoId);
    setTipo(o.tipo);
    setFecha(o.fecha.slice(0, 10));
    setKm(o.km != null ? String(o.km) : "");
    setKmTocado(true);
    setTallerId(o.tallerId ?? "");
    setTareas(o.tareas);
    setVehiculoPlanIds(o.planes.map((p) => p.vehiculoPlanId));
    setLineas(o.items.map((i) => nuevaLineaCosto(i.descripcion, formatCurrencyArFromNumber(i.subtotal))));
    setAdjuntos(o.adjuntos);
    setDescripcion(o.descripcion ?? "");
  }, []);

  // Detalle de la OT (ver/editar).
  useEffect(() => {
    if (estado.modo === "crear") return;
    let cancelado = false;
    setCargando(true);
    apiJson<OrdenTrabajoDetalle>(mantUrl(`ordenes/${encodeURIComponent(estado.ordenId)}`, tenantId), () => getToken())
      .then((o) => {
        if (cancelado) return;
        setOrden(o);
        cargarFormDesde(o);
      })
      .catch((e) => !cancelado && setError(friendlyError(e, "mantenimiento")))
      .finally(() => !cancelado && setCargando(false));
    return () => {
      cancelado = true;
    };
  }, [estado, tenantId, getToken, cargarFormDesde]);

  // Talleres para el selector (solo hace falta al editar/crear).
  useEffect(() => {
    if (modo === "ver") return;
    apiJson<Taller[]>(mantUrl("talleres", tenantId), () => getToken())
      .then(setTalleres)
      .catch(() => setTalleres([]));
  }, [modo, tenantId, getToken]);

  // En el alta, el km sugerido es el de la unidad (hasta que el usuario lo toca).
  useEffect(() => {
    if (modo !== "crear" || kmTocado) return;
    const v = maestro.vehiculos.find((x) => x.id === vehiculoId);
    setKm(v && v.kmActual > 0 ? String(v.kmActual) : "");
  }, [modo, kmTocado, vehiculoId, maestro.vehiculos]);

  const vehiculo = useMemo(
    () => maestro.vehiculos.find((v) => v.id === (orden?.vehiculoId ?? vehiculoId)),
    [maestro.vehiculos, orden?.vehiculoId, vehiculoId],
  );

  function cambiarVehiculo(id: string) {
    if (id === vehiculoId) return;
    setVehiculoId(id);
    setVehiculoPlanIds([]); // los planes son de cada unidad
  }

  /** Al tildar un plan se suman sus tareas (sin quitar las que ya estaban). */
  function cambiarPlanes(next: string[]) {
    const agregados = next.filter((id) => !vehiculoPlanIds.includes(id));
    if (agregados.length) {
      const nuevas = planesUnidad
        .filter((p) => agregados.includes(p.id))
        .flatMap((p) => p.plan.tareas)
        .filter((t) => !tareas.includes(t));
      if (nuevas.length) setTareas([...tareas, ...Array.from(new Set(nuevas))]);
    }
    setVehiculoPlanIds(next);
  }

  function validar(): boolean {
    const errs: Record<string, string> = {};
    if (!vehiculoId) errs.vehiculoId = "Elegí el vehículo.";
    if (!fecha) errs.fecha = "Ingresá la fecha del trabajo.";
    if (km.trim() && (!/^\d+$/.test(km.trim()) || Number(km) < 0)) errs.km = "El km tiene que ser un número entero.";
    const errsLineas: Record<string, { descripcion?: string; importe?: string }> = {};
    for (const l of lineas) {
      const e: { descripcion?: string; importe?: string } = {};
      if (!l.descripcion.trim()) e.descripcion = "Ingresá qué es.";
      const n = parseCurrencyAr(l.importe);
      if (n === undefined || n < 0) e.importe = "Ingresá el importe.";
      if (e.descripcion || e.importe) errsLineas[l.key] = e;
    }
    setFieldErrors(errs);
    setLineaErrors(errsLineas);
    return Object.keys(errs).length === 0 && Object.keys(errsLineas).length === 0;
  }

  async function guardar() {
    if (!validar()) return;
    setGuardando(true);
    setError(null);
    const body = {
      vehiculoId,
      tipo,
      fecha,
      km: km.trim() ? Number(km) : null,
      tallerId: tallerId || null,
      tareas,
      descripcion: descripcion.trim() || null,
      adjuntos,
      items: lineas.map((l) => ({ descripcion: l.descripcion.trim(), costoUnitario: parseCurrencyAr(l.importe) ?? 0 })),
      vehiculoPlanIds,
    };
    try {
      const guardada =
        modo === "crear"
          ? await apiJson<OrdenTrabajoGuardada>(mantUrl("ordenes", tenantId), () => getToken(), {
              method: "POST",
              body: JSON.stringify(body),
            })
          : await apiJson<OrdenTrabajoGuardada>(
              mantUrl(`ordenes/${encodeURIComponent(orden!.id)}`, tenantId),
              () => getToken(),
              { method: "PATCH", body: JSON.stringify(body) },
            );
      onGuardada();
      if (guardada.warning) {
        // Quedó guardada, pero el km no cierra con el odómetro: se muestra para que lo revisen.
        const { warning: w, ...detalle } = guardada;
        setOrden(detalle);
        cargarFormDesde(detalle);
        setWarning(w);
        setModo("ver");
        showToast(`Orden N° ${guardada.numero} guardada. Revisá el km.`, "success");
      } else {
        showToast(`Orden N° ${guardada.numero} guardada correctamente`, "success");
        onClose();
      }
    } catch (e) {
      setError(friendlyError(e, "mantenimiento"));
    } finally {
      setGuardando(false);
    }
  }

  const titulo =
    modo === "crear"
      ? "Nueva orden de trabajo"
      : orden
        ? (
            <span className="flex items-center gap-2">
              OT N° {orden.numero} · {orden.vehiculo.patente}
              <EstadoOrdenBadge estado={orden.estado} />
            </span>
          )
        : "Orden de trabajo";

  const footer =
    modo === "ver" ? (
      <>
        <button type="button" onClick={onClose} className={viewModalBtnGhost}>
          Cerrar
        </button>
        {!soloLectura && orden && orden.estado !== "anulada" && (
          <button
            type="button"
            onClick={() => {
              setWarning(null);
              setModo("editar");
            }}
            className={viewModalBtnPrimary}
          >
            Editar
          </button>
        )}
      </>
    ) : (
      <>
        <button
          type="button"
          disabled={guardando}
          onClick={() => {
            if (modo === "editar" && orden) {
              // Volver a la vista descartando lo editado.
              cargarFormDesde(orden);
              setModo("ver");
            } else {
              onClose();
            }
          }}
          className={viewModalBtnGhost}
        >
          Cancelar
        </button>
        <button type="button" disabled={guardando || cargando} onClick={() => void guardar()} className={viewModalBtnPrimary}>
          {guardando && <Spinner className="mr-2 h-3.5 w-3.5" />}
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </>
    );

  return (
    <ViewModalShell title={titulo} onClose={onClose} footer={footer} maxWidthClass="sm:max-w-3xl" scrollBody onOverlayClick={() => {}}>
      {cargando ? (
        <p className="text-sm text-vialto-steel">Cargando…</p>
      ) : modo === "ver" && orden ? (
        <VistaOrden orden={orden} warning={warning} getToken={getToken} tenantId={tenantId} />
      ) : (
        <div className="grid gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <CrudFieldLabel required>Vehículo</CrudFieldLabel>
              <SearchableEntitySelect<Vehiculo>
                items={maestro.vehiculos.filter((v) => v.activo || v.id === vehiculoId)}
                value={vehiculoId}
                onChange={cambiarVehiculo}
                filterItems={filtrarVehiculos}
                getPrimaryLabel={(v) => v.patente}
                getSecondaryLabel={(v) => [v.marca, v.modelo].filter(Boolean).join(" · ") || null}
                placeholderCerrado="Elegí el vehículo…"
                placeholderBuscar="Buscar patente o marca…"
                searchAriaLabel="Filtrar vehículos"
                aria-label="Vehículo"
                inputClassName={`${INPUT} ${fieldErrors.vehiculoId ? "border-red-400" : "border-black/15"}`}
              />
              <CrudFieldError message={fieldErrors.vehiculoId} />
            </label>
            <label className="grid gap-1.5">
              <CrudFieldLabel required>Tipo</CrudFieldLabel>
              <CrudSelect value={tipo} onChange={(e) => setTipo(e.target.value as TipoOrden)} className="w-full">
                {(Object.keys(TIPO_ORDEN_LABELS) as TipoOrden[]).map((t) => (
                  <option key={t} value={t}>
                    {TIPO_ORDEN_LABELS[t]}
                  </option>
                ))}
              </CrudSelect>
            </label>
            <label className="grid gap-1.5">
              <CrudFieldLabel required>Fecha del trabajo</CrudFieldLabel>
              <FechaPicker value={fecha} onChange={setFecha} error={fieldErrors.fecha} aria-label="Fecha del trabajo" />
              <CrudFieldError message={fieldErrors.fecha} />
            </label>
            <label className="grid gap-1.5">
              <CrudFieldLabel>Km del vehículo</CrudFieldLabel>
              <input
                type="text"
                inputMode="numeric"
                value={km}
                onChange={(e) => {
                  setKm(e.target.value.replace(/\D/g, ""));
                  setKmTocado(true);
                }}
                placeholder="Ej. 512340"
                className={`${INPUT} ${fieldErrors.km ? "border-red-400" : "border-black/15"}`}
              />
              <CrudFieldError message={fieldErrors.km} />
            </label>
            <div className="grid gap-1.5 sm:col-span-2">
              <CrudFieldLabel>Taller</CrudFieldLabel>
              <TallerSelect
                talleres={talleres}
                value={tallerId}
                onChange={setTallerId}
                onCreado={(t) => setTalleres((prev) => [...prev, t])}
                getToken={getToken}
                tenantId={tenantId}
                inputClassName={`${INPUT} border-black/15`}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <CrudFieldLabel>Planes que cumple</CrudFieldLabel>
            <PlanesCumpleCheckboxes
              vehiculoId={vehiculoId}
              value={vehiculoPlanIds}
              onChange={cambiarPlanes}
              onPlanesCargados={setPlanesUnidad}
              getToken={getToken}
              tenantId={tenantId}
            />
          </div>

          <div className="grid gap-1.5">
            <CrudFieldLabel>Tareas realizadas</CrudFieldLabel>
            <TareasMantenimientoSelect value={tareas} onChange={setTareas} />
          </div>

          <div className="grid gap-1.5">
            <CrudFieldLabel>Costos</CrudFieldLabel>
            <ItemsCostoFieldset lineas={lineas} onChange={setLineas} errores={lineaErrors} />
          </div>

          <div className="grid gap-1.5">
            <CrudFieldLabel>Adjuntos</CrudFieldLabel>
            <AdjuntosOrdenField value={adjuntos} onChange={setAdjuntos} getToken={getToken} tenantId={tenantId} />
          </div>

          <label className="grid gap-1.5">
            <CrudFieldLabel>Descripción</CrudFieldLabel>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={3}
              maxLength={2000}
              className="border border-black/15 px-3 py-2 text-sm"
            />
          </label>

          {vehiculo && modo === "crear" && !kmTocado && vehiculo.kmActual > 0 && (
            <p className="text-xs text-vialto-steel">El km sugerido es el último cargado en el vehículo.</p>
          )}
          <CrudFormErrorAlert message={error} />
        </div>
      )}
      {!cargando && modo === "ver" && error && <CrudFormErrorAlert message={error} />}
    </ViewModalShell>
  );
}

function VistaOrden({
  orden,
  warning,
  getToken,
  tenantId,
}: {
  orden: OrdenTrabajoDetalle;
  warning: string | null;
  getToken: () => Promise<string | null>;
  tenantId?: string;
}) {
  return (
    <div className="grid gap-5">
      {warning && (
        <div className="flex gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
          <p>
            <span className="font-semibold">Revisá el km. </span>
            {warning}
          </p>
        </div>
      )}
      <div className={viewModalGridClass}>
        <Campo label="Vehículo">{orden.vehiculo.patente}</Campo>
        <Campo label="Fecha del trabajo">{fmtFecha(orden.fecha)}</Campo>
        <Campo label="Tipo">{fmtTipoOrden(orden.tipo)}</Campo>
        <Campo label="Km del vehículo">{fmtKm(orden.km)}</Campo>
        <Campo label="Taller">{orden.taller?.nombre ?? "—"}</Campo>
        <Campo label="Planes que cumple">
          {orden.planes.length ? orden.planes.map((p) => p.vehiculoPlan.plan.nombre).join(", ") : "—"}
        </Campo>
      </div>
      <Campo label="Tareas realizadas">{fmtTareas(orden.tareas)}</Campo>
      <div>
        <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">Costos</p>
        {orden.items.length === 0 ? (
          <p className="mt-1 text-sm">Sin costos cargados.</p>
        ) : (
          <table className="mt-1 w-full text-sm">
            <tbody>
              {orden.items.map((i) => (
                <tr key={i.id} className="border-b border-black/5">
                  <td className="py-1.5 pr-3">
                    {i.descripcion}
                    {i.cantidad !== 1 && <span className="text-vialto-steel"> × {i.cantidad}</span>}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{fmtMoneda(i.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-2 text-right text-sm">
          <span className="text-vialto-steel">Total: </span>
          <span className="font-semibold tabular-nums">{fmtMoneda(orden.costoTotal)}</span>
        </p>
      </div>
      {orden.descripcion?.trim() && <Campo label="Descripción">{orden.descripcion}</Campo>}
      <div>
        <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">Adjuntos</p>
        <div className="mt-1">
          <AdjuntosOrdenField value={orden.adjuntos} getToken={getToken} tenantId={tenantId} readOnly />
        </div>
      </div>
    </div>
  );
}
