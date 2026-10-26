import { useEffect, useState } from "react";
import { CrudFieldLabel, CrudSelect } from "@/components/crud/CrudFields";
import { ErrorPieModal } from "@/components/shared/ErrorPieModal";
import { TareasMantenimientoSelect } from "@/components/mantenimiento/TareasMantenimientoSelect";
import { AsignacionesPlanLista } from "@/components/mantenimiento/AsignacionesPlanLista";
import { InactivoBadge } from "@/components/mantenimiento/MantenimientoBadges";
import { Spinner } from "@/components/ui/Spinner";
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
  viewModalGridClass,
} from "@/components/ui/ViewModalShell";
import { useConfirmarDescarte } from "@/hooks/useConfirmarDescarte";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { mantUrl } from "@/lib/mantenimientoApi";
import { CATEGORIA_PLAN_LABELS, fmtAviso, fmtIntervalo, fmtTareas } from "@/lib/mantenimientoLabels";
import { useToast } from "@/lib/toast";
import { labelTipoVehiculo, VEHICULO_TIPO_LABEL, VEHICULO_TIPO_VALORES } from "@/lib/vehiculoTipos";
import { ordenarAlfabetico } from "@/lib/ordenAlfabetico";
import type { CategoriaPlan, PlanMantenimiento, TareaMantenimiento } from "@/types/mantenimiento";

export type PlanModalEstado = { modo: "crear" } | { modo: "ver"; planId: string };

const INPUT = "h-10 w-full border bg-white px-3 text-sm";
const TIPOS_VEHICULO = ordenarAlfabetico([...VEHICULO_TIPO_VALORES], (t) => VEHICULO_TIPO_LABEL[t]);

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">{label}</p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

const soloDigitos = (s: string) => s.replace(/\D/g, "");
const entero = (s: string): number | null => (s.trim() ? Number(s) : null);

/**
 * Plan de mantenimiento: ver (datos + vehículos asignados) → editar, y alta. Las reglas
 * de validación son las mismas que `assertReglasPlan` del backend.
 */
export function PlanModal({
  estado,
  soloLectura,
  getToken,
  tenantId,
  onClose,
  onGuardado,
  onAsignar,
}: {
  estado: PlanModalEstado;
  soloLectura: boolean;
  getToken: () => Promise<string | null>;
  tenantId?: string;
  onClose: () => void;
  /** Se creó o editó el plan (`creado` = alta). */
  onGuardado: (plan: PlanMantenimiento, creado: boolean) => void;
  /** Botón "Asignar vehículos" de la vista (sin él no se muestra). */
  onAsignar?: (plan: PlanMantenimiento) => void;
}) {
  const { showToast } = useToast();
  const [modo, setModo] = useState<"crear" | "ver" | "editar">(estado.modo);
  const [plan, setPlan] = useState<PlanMantenimiento | null>(null);
  const [cargando, setCargando] = useState(estado.modo !== "crear");
  const [asignacionesKey, setAsignacionesKey] = useState(0);

  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState<CategoriaPlan>("mecanico");
  const [tipoVehiculo, setTipoVehiculo] = useState("");
  const [intervaloKm, setIntervaloKm] = useState("");
  const [intervaloDias, setIntervaloDias] = useState("");
  const [avisoKm, setAvisoKm] = useState("");
  const [avisoDias, setAvisoDias] = useState("");
  const [tareas, setTareas] = useState<TareaMantenimiento[]>([]);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  // En "ver" no hay nada que perder; al pasar a editar arranca sin cambios.
  const descarte = useConfirmarDescarte(onClose, modo !== "ver");

  function cargarFormDesde(p: PlanMantenimiento) {
    setNombre(p.nombre);
    setCategoria(p.categoria);
    setTipoVehiculo(p.tipoVehiculo ?? "");
    setIntervaloKm(p.intervaloKm != null ? String(p.intervaloKm) : "");
    setIntervaloDias(p.intervaloDias != null ? String(p.intervaloDias) : "");
    setAvisoKm(p.avisoKm != null ? String(p.avisoKm) : "");
    setAvisoDias(p.avisoDias != null ? String(p.avisoDias) : "");
    setTareas(p.tareas);
  }

  useEffect(() => {
    if (estado.modo !== "ver") return;
    let cancelado = false;
    setCargando(true);
    apiJson<PlanMantenimiento>(mantUrl(`planes/${encodeURIComponent(estado.planId)}`, tenantId), () => getToken())
      .then((p) => {
        if (cancelado) return;
        setPlan(p);
        cargarFormDesde(p);
      })
      .catch((e) => !cancelado && setError(friendlyError(e, "mantenimiento")))
      .finally(() => !cancelado && setCargando(false));
    return () => {
      cancelado = true;
    };
  }, [estado, tenantId, getToken]);

  function validar(): boolean {
    const errs: Record<string, string> = {};
    if (!nombre.trim()) errs.nombre = "Ingresá el nombre del plan.";
    const iKm = entero(intervaloKm);
    const iDias = entero(intervaloDias);
    const aKm = entero(avisoKm);
    const aDias = entero(avisoDias);
    for (const [k, v] of [["intervaloKm", iKm], ["intervaloDias", iDias], ["avisoKm", aKm], ["avisoDias", aDias]] as const) {
      if (v !== null && v < 1) errs[k] = "Tiene que ser un número mayor a 0.";
    }
    if (iKm === null && iDias === null) errs.intervaloKm = "Ingresá cada cuántos km, cada cuántos días o ambos.";
    if (aKm !== null && !errs.avisoKm) {
      if (iKm === null) errs.avisoKm = "El aviso en km necesita un intervalo en km.";
      else if (aKm >= iKm) errs.avisoKm = "El aviso en km tiene que ser menor que el intervalo.";
    }
    if (aDias !== null && !errs.avisoDias) {
      if (iDias === null) errs.avisoDias = "El aviso en días necesita un intervalo en días.";
      else if (aDias >= iDias) errs.avisoDias = "El aviso en días tiene que ser menor que el intervalo.";
    }
    if (categoria === "mecanico" && tareas.length === 0) errs.tareas = "Un plan mecánico necesita al menos una tarea.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function guardar() {
    if (!validar()) return;
    setGuardando(true);
    setError(null);
    const body = {
      nombre: nombre.trim(),
      categoria,
      tipoVehiculo: tipoVehiculo || null,
      intervaloKm: entero(intervaloKm),
      intervaloDias: entero(intervaloDias),
      avisoKm: entero(avisoKm),
      avisoDias: entero(avisoDias),
      tareas,
    };
    try {
      const creado = modo === "crear";
      const guardado = await apiJson<PlanMantenimiento>(
        mantUrl(creado ? "planes" : `planes/${encodeURIComponent(plan!.id)}`, tenantId),
        () => getToken(),
        { method: creado ? "POST" : "PATCH", body: JSON.stringify(body) },
      );
      showToast(creado ? `Plan "${guardado.nombre}" creado` : "Plan guardado correctamente", "success");
      onGuardado(guardado, creado);
      if (creado) {
        onClose();
      } else {
        setPlan(guardado);
        cargarFormDesde(guardado);
        setModo("ver");
      }
    } catch (e) {
      setError(friendlyError(e, "mantenimiento"));
    } finally {
      setGuardando(false);
    }
  }

  const titulo =
    modo === "crear" ? (
      "Nuevo plan de mantenimiento"
    ) : plan ? (
      <span className="flex items-center gap-2">
        {plan.nombre}
        {!plan.activo && <InactivoBadge />}
      </span>
    ) : (
      "Plan de mantenimiento"
    );

  const footer =
    modo === "ver" ? (
      <>
        <ErrorPieModal error={error} />
        <button key="cerrar" type="button" onClick={descarte.solicitarCierre} className={viewModalBtnGhost}>
          Cerrar
        </button>
        {!soloLectura && plan && plan.activo && onAsignar && (
          <button key="asignar" type="button" onClick={() => onAsignar(plan)} className={viewModalBtnGhost}>
            Asignar vehículos
          </button>
        )}
        {!soloLectura && plan && (
          <button
            key="editar"
            type="button"
            onClick={() => {
              setError(null);
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
        <ErrorPieModal error={error} fieldErrors={fieldErrors} />
        <button key="cancelar" type="button" disabled={guardando} onClick={descarte.solicitarCierre} className={viewModalBtnGhost}>
          Cancelar
        </button>
        <button key="guardar" type="button" disabled={guardando || cargando} onClick={() => void guardar()} className={viewModalBtnPrimary}>
          {guardando && <Spinner className="mr-2 h-3.5 w-3.5" />}
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </>
    );

  const borde = (k: string) => (fieldErrors[k] ? "border-red-400" : "border-black/15");
  const numInput = (k: string, value: string, set: (v: string) => void, placeholder: string) => (
    <input
      type="text"
      inputMode="numeric"
      value={value}
      onChange={(e) => set(soloDigitos(e.target.value))}
      placeholder={placeholder}
      className={`${INPUT} ${borde(k)}`}
    />
  );

  return (
    <ViewModalShell title={titulo} onClose={descarte.solicitarCierre} descarte={descarte} footer={footer} maxWidthClass="sm:max-w-3xl" scrollBody>
      {cargando ? (
        <p className="text-sm text-vialto-steel">Cargando…</p>
      ) : modo === "ver" && plan ? (
        <div className="grid gap-5">
          <div className={viewModalGridClass}>
            <Campo label="Categoría">{CATEGORIA_PLAN_LABELS[plan.categoria] ?? plan.categoria}</Campo>
            <Campo label="Tipo de vehículo">{plan.tipoVehiculo ? labelTipoVehiculo(plan.tipoVehiculo) : "Cualquiera"}</Campo>
            <Campo label="Intervalo">{fmtIntervalo(plan)}</Campo>
            <Campo label="Aviso anticipado">{fmtAviso(plan)}</Campo>
          </div>
          <Campo label="Tareas">{fmtTareas(plan.tareas)}</Campo>
          <div>
            <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">Vehículos asignados</p>
            <div className="mt-2">
              <AsignacionesPlanLista
                planId={plan.id}
                soloLectura={soloLectura}
                getToken={getToken}
                tenantId={tenantId}
                reloadKey={asignacionesKey}
                onCambio={() => {
                  setAsignacionesKey((k) => k + 1);
                  onGuardado(plan, false);
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 sm:col-span-2">
              <CrudFieldLabel required>Nombre</CrudFieldLabel>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                maxLength={120}
                placeholder="Ej. Service motor (aceite + filtros)"
                className={`${INPUT} ${borde("nombre")}`}
              />
            </label>
            <label className="grid gap-1.5">
              <CrudFieldLabel required>Categoría</CrudFieldLabel>
              <CrudSelect value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaPlan)} className="w-full">
                <option value="documental">Documental</option>
                <option value="mecanico">Mecánico</option>
              </CrudSelect>
            </label>
            <label className="grid gap-1.5">
              <CrudFieldLabel>Tipo de vehículo</CrudFieldLabel>
              <CrudSelect value={tipoVehiculo} onChange={(e) => setTipoVehiculo(e.target.value)} className="w-full">
                <option value="">Cualquiera</option>
                {TIPOS_VEHICULO.map((t) => (
                  <option key={t} value={t}>
                    {VEHICULO_TIPO_LABEL[t]}
                  </option>
                ))}
              </CrudSelect>
            </label>
            <label className="grid gap-1.5">
              <CrudFieldLabel>Cada cuántos km</CrudFieldLabel>
              {numInput("intervaloKm", intervaloKm, setIntervaloKm, "Ej. 20000")}
            </label>
            <label className="grid gap-1.5">
              <CrudFieldLabel>Cada cuántos días</CrudFieldLabel>
              {numInput("intervaloDias", intervaloDias, setIntervaloDias, "Ej. 180")}
            </label>
            <label className="grid gap-1.5">
              <CrudFieldLabel>Avisar cuántos km antes</CrudFieldLabel>
              {numInput("avisoKm", avisoKm, setAvisoKm, "Ej. 2000")}
            </label>
            <label className="grid gap-1.5">
              <CrudFieldLabel>Avisar cuántos días antes</CrudFieldLabel>
              {numInput("avisoDias", avisoDias, setAvisoDias, "Ej. 15")}
            </label>
          </div>
          <p className="text-xs text-vialto-steel">
            Vence con lo que llegue primero (km o días). Sin aviso, pasa directo de "Al día" a "Vencido".
          </p>
          <div className="grid gap-1.5">
            <CrudFieldLabel required={categoria === "mecanico"}>Tareas</CrudFieldLabel>
            <TareasMantenimientoSelect value={tareas} onChange={setTareas} error={fieldErrors.tareas} />
          </div>
        </div>
      )}
    </ViewModalShell>
  );
}
