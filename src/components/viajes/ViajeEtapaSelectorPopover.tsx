import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Ban,
  CalendarClock,
  Check,
  CircleHelp,
  Flag,
  Loader2,
  Truck,
  X,
} from "lucide-react";
import { EstadoIcono } from "@/components/viajes/EstadoIcono";
import {
  VIAJE_ETAPAS_TODAS,
  etapaViajeBadgeClass,
  etapaViajeBadgeClassDefault,
  etapaViajeLabel,
  facturacionEstadoAgregado,
  tooltipEtapaViaje,
} from "@/lib/viajesIndicadores";
import { evaluarValorizacionViaje } from "@/lib/viajesValorizacion";
import { numeroVisibleViaje } from "@/lib/viajesFlota";
import type { Viaje } from "@/types/api";

const ICONO_ETAPA: Record<string, LucideIcon> = {
  pendiente: CalendarClock,
  en_curso: Truck,
  finalizado: Flag,
  cancelado: Ban,
};

const DROPDOWN_WIDTH_PX = 280;

type Props = {
  viaje: Viaje;
  esAdmin: boolean;
  onCambiarEtapa: (nuevaEtapa: string) => Promise<void>;
  variante?: "icono" | "badge";
};

export function ViajeEtapaSelectorPopover({
  viaje,
  esAdmin,
  onCambiarEtapa,
  variante = "icono",
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [etapaSeleccionada, setEtapaSeleccionada] = useState<string>(viaje.etapa);
  const [guardando, setGuardando] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const botonRef = useRef<HTMLButtonElement | HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const valorizacion = evaluarValorizacionViaje(viaje);

  // Un miembro no puede cambiar la etapa de un viaje que ya está finalizado.
  const bloqueadoPorRol = !esAdmin && viaje.etapa === "finalizado";

  // Al abrir el popover, preseleccionar la etapa actual
  useEffect(() => {
    if (abierto) {
      setEtapaSeleccionada(viaje.etapa);
    }
  }, [abierto, viaje.etapa]);

  useLayoutEffect(() => {
    if (!abierto) return;
    function ubicar() {
      const r = botonRef.current?.getBoundingClientRect();
      if (!r) return;
      const left = Math.max(
        8,
        Math.min(r.left, window.innerWidth - DROPDOWN_WIDTH_PX - 8),
      );
      const altoMenu = menuRef.current?.offsetHeight ?? 0;
      const top =
        altoMenu && r.bottom + 4 + altoMenu > window.innerHeight - 8
          ? Math.max(8, r.top - 4 - altoMenu)
          : r.bottom + 4;
      setPos({ top, left });
    }
    ubicar();
    const raf = requestAnimationFrame(ubicar);
    window.addEventListener("resize", ubicar);
    window.addEventListener("scroll", ubicar, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", ubicar);
      window.removeEventListener("scroll", ubicar, true);
    };
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (botonRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setAbierto(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [abierto]);

  async function handleConfirmar() {
    if (etapaSeleccionada === viaje.etapa || guardando) return;
    setGuardando(true);
    try {
      await onCambiarEtapa(etapaSeleccionada);
      setAbierto(false);
    } catch {
      // El error ya es notificado en el handler principal
    } finally {
      setGuardando(false);
    }
  }

  const labelActual = etapaViajeLabel[viaje.etapa] ?? viaje.etapa;
  const ayudaActual = tooltipEtapaViaje(viaje.etapa);
  const titleTrigger = bloqueadoPorRol
    ? "Viaje finalizado: solo modificable por administradores"
    : ayudaActual
      ? `${labelActual}\n${ayudaActual}\nClic para cambiar etapa`
      : `Etapa: ${labelActual} — Clic para cambiar`;

  const triggerIcono = (
    <EstadoIcono
      icon={ICONO_ETAPA[viaje.etapa] ?? CircleHelp}
      colorClass={
        etapaViajeBadgeClass[viaje.etapa] ?? etapaViajeBadgeClassDefault
      }
      title={titleTrigger}
      onClick={bloqueadoPorRol ? undefined : () => setAbierto((v) => !v)}
    />
  );

  const triggerBadge = bloqueadoPorRol ? (
    <span
      ref={botonRef as React.RefObject<HTMLSpanElement>}
      title={titleTrigger}
      className={`inline-block self-start whitespace-nowrap rounded-sm border font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-wider px-2 py-0.5 cursor-not-allowed opacity-90 ${
        etapaViajeBadgeClass[viaje.etapa] ?? etapaViajeBadgeClassDefault
      }`}
    >
      {labelActual}
    </span>
  ) : (
    <button
      ref={botonRef as React.RefObject<HTMLButtonElement>}
      type="button"
      title={titleTrigger}
      onClick={(e) => {
        e.stopPropagation();
        setAbierto((v) => !v);
      }}
      className={`inline-flex items-center gap-1 self-start whitespace-nowrap rounded-sm border font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-wider px-2 py-0.5 transition-opacity hover:opacity-85 ${
        etapaViajeBadgeClass[viaje.etapa] ?? etapaViajeBadgeClassDefault
      }`}
    >
      {labelActual}
    </button>
  );

  return (
    <>
      <span
        ref={botonRef as React.RefObject<HTMLSpanElement>}
        className="inline-flex items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {variante === "badge" ? triggerBadge : triggerIcono}
      </span>

      {abierto &&
        createPortal(
          <div
            ref={menuRef}
            role="dialog"
            aria-label="Cambiar etapa del viaje"
            className="fixed z-50 rounded-lg border border-black/20 bg-white p-3 text-left shadow-2xl ring-1 ring-black/10"
            style={{
              top: pos?.top ?? -9999,
              left: pos?.left ?? -9999,
              width: DROPDOWN_WIDTH_PX,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera */}
            <div className="flex items-center justify-between border-b border-black/10 pb-2">
              <div>
                <span className="text-xs font-semibold text-vialto-charcoal uppercase tracking-wider">
                  Cambiar etapa
                </span>
                <span className="ml-1 text-[11px] text-vialto-steel">
                  Viaje #{numeroVisibleViaje(viaje)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="text-vialto-steel hover:text-vialto-charcoal"
                aria-label="Cerrar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Opciones de etapa */}
            <div className="mt-2.5 flex flex-col gap-1.5">
              {VIAJE_ETAPAS_TODAS.map((etapa) => {
                const Icon = ICONO_ETAPA[etapa] ?? CircleHelp;
                const label = etapaViajeLabel[etapa] ?? etapa;
                const esActual = viaje.etapa === etapa;
                const esSeleccionada = etapaSeleccionada === etapa;

                // Validación preventiva: 'finalizado' requiere estar valorizado para poder transicionar
                const deshabilitadoPorValorizacion =
                  !esActual &&
                  etapa === "finalizado" &&
                  !valorizacion.valorizado;

                // Validación preventiva: 'cancelado' requiere no tener factura ni liquidación vigente
                const estadoFact = facturacionEstadoAgregado(viaje);
                const tieneFacturaVigente = !["sin_facturar", "anulado"].includes(
                  String(estadoFact ?? "sin_facturar"),
                );
                const tieneLiquidacionVigente =
                  viaje.liquidacionEstado != null &&
                  !["sin_liquidar", "anulado"].includes(viaje.liquidacionEstado);

                const deshabilitadoPorComprobante =
                  !esActual &&
                  etapa === "cancelado" &&
                  (tieneFacturaVigente || tieneLiquidacionVigente);

                const disabled =
                  esActual ||
                  deshabilitadoPorValorizacion ||
                  deshabilitadoPorComprobante;

                let motivoDisabled: ReactNode = null;
                if (deshabilitadoPorValorizacion) {
                  motivoDisabled =
                    valorizacion.mensajePendiente ?? "No valorizado";
                } else if (deshabilitadoPorComprobante) {
                  if (tieneFacturaVigente && tieneLiquidacionVigente) {
                    motivoDisabled =
                      "Factura y liquidación vigentes: anulalas antes de cancelar";
                  } else if (tieneFacturaVigente) {
                    motivoDisabled =
                      "Factura vigente: anulala antes de cancelar";
                  } else {
                    motivoDisabled =
                      "Liquidación vigente: anulala antes de cancelar";
                  }
                }

                return (
                  <button
                    key={etapa}
                    type="button"
                    disabled={disabled}
                    onClick={() => setEtapaSeleccionada(etapa)}
                    className={`flex w-full flex-col rounded-md border p-2 text-left transition-all ${
                      esSeleccionada && !esActual
                        ? "border-vialto-fire bg-amber-50/40 shadow-xs"
                        : esActual
                          ? "border-blue-200 bg-blue-50/60 ring-1 ring-blue-100/80 cursor-default"
                          : disabled
                            ? "border-black/5 bg-gray-50 opacity-60 cursor-not-allowed"
                            : "border-black/10 hover:border-black/20 hover:bg-vialto-mist/20 cursor-pointer"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded border ${
                            etapaViajeBadgeClass[etapa] ??
                            etapaViajeBadgeClassDefault
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span
                          className={`text-xs ${
                            esActual
                              ? "font-semibold text-blue-950"
                              : "font-medium text-vialto-charcoal"
                          }`}
                        >
                          {label}
                        </span>
                      </div>
                      {esActual ? (
                        <span className="inline-flex items-center gap-1 rounded-none border border-blue-200 bg-blue-100/80 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                          Actual
                        </span>
                      ) : esSeleccionada ? (
                        <span className="flex h-4 w-4 items-center justify-center rounded-none bg-vialto-fire text-white">
                          <Check className="h-2.5 w-2.5" strokeWidth={3} />
                        </span>
                      ) : null}
                    </div>

                    {motivoDisabled && (
                      <div className="mt-1 flex items-start gap-1 text-[10px] text-amber-700">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        <span>{motivoDisabled}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer con confirmación (Variante 1B) */}
            <div className="mt-3 border-t border-black/10 pt-2.5">
              {etapaSeleccionada !== viaje.etapa ? (() => {
                const ahora = new Date();
                const fechaCargaDate = viaje.fechaCarga
                  ? new Date(viaje.fechaCarga)
                  : null;
                const fechaDescargaDate = viaje.fechaDescarga
                  ? new Date(viaje.fechaDescarga)
                  : null;
                const ajustaraAEnCursoPorFecha =
                  etapaSeleccionada === "pendiente" &&
                  ((fechaCargaDate != null && fechaCargaDate <= ahora) ||
                    (fechaDescargaDate != null && fechaDescargaDate <= ahora));

                return (
                  <div className="flex flex-col gap-2">
                    <div className="text-[11px] text-vialto-steel">
                      El viaje pasará a:{" "}
                      <strong className="text-vialto-charcoal">
                        {ajustaraAEnCursoPorFecha
                          ? etapaViajeLabel.en_curso ?? "En curso"
                          : etapaViajeLabel[etapaSeleccionada] ??
                            etapaSeleccionada}
                      </strong>
                    </div>

                    {ajustaraAEnCursoPorFecha && (
                      <div className="rounded border border-amber-300 bg-amber-50 p-1.5 text-[10px] text-amber-800 leading-tight">
                        Por fecha de carga alcanzada, el sistema guardará el viaje como{" "}
                        <strong>En curso</strong>.
                      </div>
                    )}

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={guardando}
                        onClick={() => setAbierto(false)}
                        className="rounded border border-black/15 px-2.5 py-1 text-xs font-medium text-vialto-steel hover:bg-vialto-mist hover:text-vialto-charcoal"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={guardando}
                        onClick={handleConfirmar}
                        className="inline-flex items-center gap-1.5 rounded bg-vialto-charcoal px-3 py-1 text-xs font-medium text-white hover:bg-vialto-graphite disabled:opacity-50"
                      >
                        {guardando ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Aplicando…</span>
                          </>
                        ) : (
                          <span>Aplicar cambio</span>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })() : (
                <div className="text-center text-[11px] text-vialto-steel/70">
                  Seleccioná una nueva etapa para aplicar el cambio
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
