import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { History, Gauge, ListOrdered, Trash2, Truck } from "lucide-react";
import { ListadoDatos, type ListadoColumn } from "@/components/listado/ListadoDatos";
import { ViajesListadoHeaderFiltro } from "@/components/viajes/ViajesListadoHeaderFiltro";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { AccionesMenuTrigger } from "@/components/ui/AccionesMenuTrigger";
import { AccionesOpcionesSheet, type AccionOpcion } from "@/components/ui/AccionesOpcionesSheet";
import { listadoTablaHeadRowClass, listadoTablaThClass } from "@/lib/listadoTabla";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { useToast } from "@/lib/toast";
import { fmtTipoVehiculo } from "@/lib/combustibleLabels";
import { AsignarVehiculoModal } from "@/components/combustible/AsignarVehiculoModal";
import { HistorialAsignacionModal } from "@/components/combustible/HistorialAsignacionModal";
import { EditarKmVehiculoModal } from "@/components/combustible/EditarKmVehiculoModal";
import { HistorialKmVehiculoModal } from "@/components/combustible/HistorialKmVehiculoModal";
import type { AsignacionVehiculo, Chofer, ConEmpresa, Vehiculo } from "@/types/api";

type FilaChofer = ConEmpresa<Chofer> & { asignacionActual: AsignacionVehiculo | null };

function fmtVehiculoLabel(v: {
  patente: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
}): string {
  const tipo = fmtTipoVehiculo(v.tipo);
  const marcaModelo = [v.marca, v.modelo].filter(Boolean).join(" ");
  const detalle = [tipo, marcaModelo].filter(Boolean).join(" · ");
  return detalle ? `${v.patente} — ${detalle}` : v.patente;
}

function FilaAccionesMenu({
  fila,
  isReadOnly,
  onHistorial,
  onAsignar,
  onEditarKm,
  onHistorialKm,
  onQuitar,
}: {
  fila: FilaChofer;
  isReadOnly: boolean;
  onHistorial: () => void;
  onAsignar: () => void;
  onEditarKm: () => void;
  onHistorialKm: () => void;
  onQuitar: () => void;
}) {
  const [open, setOpen] = useState(false);

  const options: AccionOpcion[] = [
    { id: "historial", label: "Historial", icon: History, onClick: onHistorial },
  ];
  if (fila.asignacionActual) {
    options.push({ id: "historial-km", label: "Historial de km", icon: ListOrdered, onClick: onHistorialKm });
  }
  if (!isReadOnly) {
    options.push({
      id: "asignar",
      label: fila.asignacionActual ? "Reasignar" : "Asignar",
      icon: Truck,
      onClick: onAsignar,
    });
    if (fila.asignacionActual) {
      options.push({ id: "editar-km", label: "Editar km", icon: Gauge, onClick: onEditarKm });
      options.push({
        id: "quitar",
        label: "Quitar asignación",
        icon: Trash2,
        onClick: onQuitar,
        danger: true,
      });
    }
  }

  return (
    <>
      <AccionesMenuTrigger open={open} onClick={() => setOpen(true)} />
      <AccionesOpcionesSheet
        open={open}
        onClose={() => setOpen(false)}
        subtitle={fila.nombre}
        options={options}
      />
    </>
  );
}

function fmtFecha(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function AsignacionVehiculoSection({
  tenantId,
  choferes,
  vehiculos,
  isReadOnly,
}: {
  tenantId: string;
  choferes: ConEmpresa<Chofer>[];
  vehiculos: ConEmpresa<Vehiculo>[];
  isReadOnly: boolean;
}) {
  const { getToken } = useAuth();
  const { showToast } = useToast();
  const [asignaciones, setAsignaciones] = useState<AsignacionVehiculo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [asignarTarget, setAsignarTarget] = useState<ConEmpresa<Chofer> | null | "nuevo">(
    null,
  );
  const [historialTarget, setHistorialTarget] = useState<FilaChofer | null>(null);
  const [editarKmTarget, setEditarKmTarget] = useState<FilaChofer | null>(null);
  const [historialKmTarget, setHistorialKmTarget] = useState<FilaChofer | null>(null);
  const [quitarTarget, setQuitarTarget] = useState<FilaChofer | null>(null);
  const [quitando, setQuitando] = useState(false);
  const [quitarError, setQuitarError] = useState<string | null>(null);

  const [choferFiltroId, setChoferFiltroId] = useState("");
  const [vehiculoFiltroId, setVehiculoFiltroId] = useState("");

  useEffect(() => {
    if (!tenantId) return;
    let cancelled = false;
    setAsignaciones(null);
    void (async () => {
      try {
        const data = await apiJson<AsignacionVehiculo[]>(
          `/api/platform/combustible/asignaciones?tenantId=${encodeURIComponent(tenantId)}`,
          () => getToken(),
        );
        if (!cancelled) {
          setAsignaciones(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setAsignaciones([]);
          setError(friendlyError(err, "combustible"));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // getToken se omite a propósito: Clerk lo recrea en cada render y no debe disparar un refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, reloadKey]);

  const filas = useMemo<FilaChofer[]>(() => {
    const porChofer = new Map((asignaciones ?? []).map((a) => [a.choferId, a]));
    return choferes.map((ch) => ({ ...ch, asignacionActual: porChofer.get(ch.id) ?? null }));
  }, [choferes, asignaciones]);

  const filasFiltradas = useMemo(
    () =>
      filas.filter(
        (r) =>
          (!choferFiltroId || r.id === choferFiltroId) &&
          (!vehiculoFiltroId || r.asignacionActual?.vehiculo.id === vehiculoFiltroId),
      ),
    [filas, choferFiltroId, vehiculoFiltroId],
  );

  const choferOptions = useMemo(
    () => choferes.map((ch) => ({ value: ch.id, label: ch.nombre })),
    [choferes],
  );
  const vehiculoOptions = useMemo(
    () => vehiculos.map((v) => ({ value: v.id, label: fmtVehiculoLabel(v) })),
    [vehiculos],
  );

  async function handleQuitar() {
    if (!quitarTarget) return;
    setQuitando(true);
    setQuitarError(null);
    try {
      await apiJson(
        `/api/platform/combustible/asignaciones/${quitarTarget.id}?tenantId=${encodeURIComponent(
          tenantId,
        )}`,
        () => getToken(),
        { method: "DELETE" },
      );
      showToast("Asignación finalizada", "success");
      setQuitarTarget(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setQuitarError(friendlyError(err, "combustible"));
      showToast("No se pudo quitar la asignación", "error");
    } finally {
      setQuitando(false);
    }
  }

  const columns = useMemo<ListadoColumn<FilaChofer>[]>(
    () => [
      {
        id: "chofer",
        header: "Chofer",
        primary: true,
        cell: (r) => r.nombre,
      },
      {
        id: "vehiculo",
        header: "Vehículo asignado",
        cell: (r) =>
          r.asignacionActual ? (
            <span>
              {r.asignacionActual.vehiculo.patente}{" "}
              <span className="text-xs text-vialto-steel">
                ({fmtTipoVehiculo(r.asignacionActual.vehiculo.tipo)})
              </span>
            </span>
          ) : (
            <span className="text-vialto-steel">Sin asignar</span>
          ),
      },
      {
        id: "km",
        header: "Km actual",
        cell: (r) =>
          r.asignacionActual
            ? `${r.asignacionActual.vehiculo.kmActual.toLocaleString("es-AR")} km`
            : "—",
      },
      {
        id: "desde",
        header: "Desde",
        cell: (r) => (r.asignacionActual ? fmtFecha(r.asignacionActual.fechaDesde) : "—"),
      },
      {
        id: "acciones",
        header: "Acciones",
        cell: (r) => (
          <div className="flex justify-end">
            <FilaAccionesMenu
              fila={r}
              isReadOnly={isReadOnly}
              onHistorial={() => setHistorialTarget(r)}
              onAsignar={() => setAsignarTarget(r)}
              onEditarKm={() => setEditarKmTarget(r)}
              onHistorialKm={() => setHistorialKmTarget(r)}
              onQuitar={() => {
                setQuitarError(null);
                setQuitarTarget(r);
              }}
            />
          </div>
        ),
      },
    ],
    [isReadOnly],
  );

  return (
    <div className="w-full">
      <div className="mt-4 flex justify-end">
        {!isReadOnly && (
          <button
            type="button"
            onClick={() => setAsignarTarget("nuevo")}
            disabled={!tenantId}
            className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite transition-colors disabled:opacity-50"
          >
            Asignar vehículo
          </button>
        )}
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <ListadoDatos<FilaChofer>
        className="mt-4"
        columns={columns}
        rows={asignaciones === null ? null : filasFiltradas}
        rowKey={(r) => r.id}
        emptyMessage="No hay choferes cargados para esta empresa."
        loadingMessage="Cargando…"
        tableColSpan={5}
        tableHead={
          <tr className={listadoTablaHeadRowClass}>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Chofer"
                filterActive={!!choferFiltroId}
                filterSignature={choferFiltroId}
              >
                <SearchableSelect
                  value={choferFiltroId}
                  onChange={setChoferFiltroId}
                  options={choferOptions}
                  placeholder="Todos"
                  searchPlaceholder="Buscar chofer…"
                  triggerClassName={choferFiltroId ? "text-vialto-fire" : ""}
                  ariaLabel="Filtrar por chofer"
                />
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={`${listadoTablaThClass} align-top`}>
              <ViajesListadoHeaderFiltro
                title="Vehículo asignado"
                filterActive={!!vehiculoFiltroId}
                filterSignature={vehiculoFiltroId}
              >
                <SearchableSelect
                  value={vehiculoFiltroId}
                  onChange={setVehiculoFiltroId}
                  options={vehiculoOptions}
                  placeholder="Todos"
                  searchPlaceholder="Buscar vehículo…"
                  triggerClassName={vehiculoFiltroId ? "text-vialto-fire" : ""}
                  ariaLabel="Filtrar por vehículo"
                />
              </ViajesListadoHeaderFiltro>
            </th>
            <th scope="col" className={listadoTablaThClass}>
              Km actual
            </th>
            <th scope="col" className={listadoTablaThClass}>
              Desde
            </th>
            <th scope="col" className={`${listadoTablaThClass} text-right`}>
              Acciones
            </th>
          </tr>
        }
      />

      {asignarTarget && tenantId && (
        <AsignarVehiculoModal
          tenantId={tenantId}
          chofer={asignarTarget === "nuevo" ? undefined : asignarTarget}
          choferes={choferes}
          vehiculos={vehiculos}
          onClose={() => setAsignarTarget(null)}
          onSuccess={() => {
            setAsignarTarget(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}

      {historialTarget && tenantId && (
        <HistorialAsignacionModal
          tenantId={tenantId}
          choferId={historialTarget.id}
          choferNombre={historialTarget.nombre}
          onClose={() => setHistorialTarget(null)}
        />
      )}

      {editarKmTarget?.asignacionActual && tenantId && (
        <EditarKmVehiculoModal
          tenantId={tenantId}
          vehiculoId={editarKmTarget.asignacionActual.vehiculo.id}
          patente={editarKmTarget.asignacionActual.vehiculo.patente}
          kmActual={editarKmTarget.asignacionActual.vehiculo.kmActual}
          onClose={() => setEditarKmTarget(null)}
          onSuccess={() => {
            setEditarKmTarget(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}

      {historialKmTarget?.asignacionActual && tenantId && (
        <HistorialKmVehiculoModal
          tenantId={tenantId}
          vehiculoId={historialKmTarget.asignacionActual.vehiculo.id}
          patente={historialKmTarget.asignacionActual.vehiculo.patente}
          onClose={() => setHistorialKmTarget(null)}
        />
      )}

      {quitarTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quitar-asignacion-titulo"
          onClick={() => !quitando && setQuitarTarget(null)}
        >
          <div
            className="w-full max-w-md border border-black/15 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="quitar-asignacion-titulo"
              className="text-lg font-semibold text-vialto-charcoal"
            >
              Quitar asignación
            </h2>
            <p className="mt-2 text-sm text-vialto-steel">
              ¿Seguro que querés dejar a{" "}
              <span className="font-medium text-vialto-charcoal">
                {quitarTarget.nombre}
              </span>{" "}
              sin vehículo asignado? Va a poder seguir cargando combustible eligiendo
              la patente manualmente.
            </p>
            {quitarError && (
              <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {quitarError}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setQuitarTarget(null)}
                disabled={quitando}
                className="inline-flex h-10 items-center px-4 border border-black/15 bg-white text-sm uppercase tracking-wider text-vialto-steel hover:bg-vialto-mist/80 hover:text-vialto-charcoal transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleQuitar}
                disabled={quitando}
                className="inline-flex h-10 items-center px-4 border border-red-600 bg-red-600 text-sm uppercase tracking-wider text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {quitando ? "Quitando…" : "Quitar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
