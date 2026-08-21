import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { Receipt } from "lucide-react";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import {
  computeFacturaTotales,
  defaultFacturaLineas,
  toFacturaLineasPayload,
  validateFacturaLineasDraft,
} from "@/components/facturacion/FacturaLineasEditor";
import { ApiError, apiFetch, apiJson } from "@/lib/api";
import { AmbienteTestBadge } from "@/components/liquidaciones/AmbienteTestBadge";
import {
  condicionIvaLabel,
  facturaLetraFromCondicionIva,
  facturaLetraLabel,
} from "@/lib/arcaCbteTipo";
import {
  collectFacturaEmitMissingFields,
  formatFacturaEmitMissingMessage,
} from "@/lib/facturaEmitValidation";
import { friendlyError } from "@/lib/friendlyError";
import { ArcaEmitErrorAlert } from "@/components/ui/ArcaErrorMessage";
import { modalOverlayClass } from "@/lib/modalLayers";
import {
  MSG_ARCA_NO_FACTURA_USD,
  arcaBloqueaFacturarUsd,
} from "@/lib/arcaUsdRestriction";
import { useToast } from "@/lib/toast";
import { CompletarDatosFiscalesInline } from "@/components/shared/CompletarDatosFiscalesInline";
import type { ArcaConfig, Cliente, Factura, Viaje } from "@/types/api";

interface Props {
  factura: Factura;
  viajes: Viaje[];
  tenantId?: string;
  /** Cliente ya cargado en la página (evita fetch fallido en plataforma). */
  clienteInicial?: Cliente | null;
  onClose: () => void;
  onEmitido: (factura: Factura) => void;
  onDataSaved?: () => void;
}

type Step = "revision" | "autorizada";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-vialto-steel">{label}</span>
      <span className="tabular-nums text-vialto-charcoal">{value}</span>
    </div>
  );
}

export function EmitirFacturaModal({
  factura,
  viajes,
  tenantId,
  clienteInicial = null,
  onClose,
  onEmitido,
  onDataSaved,
}: Props) {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const platform = Boolean(tenantId?.trim());
  const bloqueadoUsd = arcaBloqueaFacturarUsd(true, factura.moneda);
  const yaAutorizada =
    factura.arcaEstado === "autorizado" ||
    factura.arcaEstado === "anulado" ||
    Boolean(factura.cae);

  const [step, setStep] = useState<Step>("revision");

  // Las líneas se derivan únicamente del viaje de forma fija
  const lineas = useMemo(
    () => defaultFacturaLineas(factura, viajes),
    [factura, viajes],
  );

  const [busyArca, setBusyArca] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [arcaConfigMissing, setArcaConfigMissing] = useState(false);
  const [facturaEmitida, setFacturaEmitida] = useState<Factura>(factura);
  const [downloading, setDownloading] = useState(false);
  const [arcaConfig, setArcaConfig] = useState<ArcaConfig | null>(null);
  const [clienteDetalle, setClienteDetalle] = useState<Cliente | null>(null);
  const [datosReady, setDatosReady] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);

  useLockBodyScroll(true);

  const configUrl = platform
    ? `/api/platform/arca/config?tenantId=${encodeURIComponent(tenantId!)}`
    : "/api/integracion-arca/config";
  const emitUrl = platform
    ? `/api/platform/arca/facturas/${encodeURIComponent(factura.id)}/emitir?tenantId=${encodeURIComponent(tenantId!)}`
    : `/api/integracion-arca/facturas/${encodeURIComponent(factura.id)}/emitir`;
  const pdfUrl = platform
    ? `/api/platform/arca/facturas/${encodeURIComponent(factura.id)}/pdf?tenantId=${encodeURIComponent(tenantId!)}`
    : `/api/integracion-arca/facturas/${encodeURIComponent(factura.id)}/pdf`;

  useEffect(() => {
    let cancelled = false;
    setDatosReady(false);
    if (clienteInicial) setClienteDetalle(clienteInicial);
    void (async () => {
      try {
        const cfg = await apiJson<ArcaConfig | null>(configUrl, () =>
          getToken(),
        );
        if (!cancelled) setArcaConfig(cfg);
      } catch {
        if (!cancelled) setArcaConfig(null);
      }
      // Siempre refrescar cliente desde API (el listado puede estar desactualizado).
      if (factura.clienteId) {
        try {
          const url = platform
            ? `/api/platform/clientes/${encodeURIComponent(factura.clienteId)}?tenantId=${encodeURIComponent(tenantId!)}`
            : `/api/clientes/${encodeURIComponent(factura.clienteId)}`;
          const c = await apiJson<Cliente>(url, () => getToken());
          if (!cancelled) setClienteDetalle(c);
        } catch {
          // se valida con lo disponible (p. ej. clienteInicial)
        }
      }
      if (!cancelled) setDatosReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    clienteInicial,
    configUrl,
    factura.clienteId,
    getToken,
    platform,
    tenantId,
  ]);

  const condicionIva = clienteDetalle?.condicionIva ?? null;
  const letra = facturaLetraFromCondicionIva(condicionIva);
  const ivaPctDefault = factura.ivaPct ?? arcaConfig?.ivaGastosAdmin ?? 21;

  const missingEmitFields = useMemo(
    () =>
      collectFacturaEmitMissingFields({
        emisor: arcaConfig,
        cliente: clienteDetalle ?? {
          nombre: null,
          direccion: null,
          idFiscal: null,
          condicionIva: null,
        },
      }),
    [arcaConfig, clienteDetalle],
  );
  const missingEmitMessage = formatFacturaEmitMissingMessage(missingEmitFields);
  const datosEmitIncompletos = datosReady && missingEmitFields.length > 0;
  const missingEmisorFields = missingEmitFields.filter((f) =>
    f.startsWith("Emisor:"),
  );
  const missingClienteFields = missingEmitFields.filter((f) =>
    f.startsWith("Cliente:"),
  );
  const sinConfigArca = datosReady && !arcaConfig;
  const tipoInvalido = factura.tipo !== "cliente";

  const emitBloqueadoRazon = tipoInvalido
    ? "Solo se pueden emitir facturas de tipo cliente."
    : bloqueadoUsd
      ? MSG_ARCA_NO_FACTURA_USD
      : null;

  function notifyEmitBlock(message: string) {
    setError(message);
    showToast(message, "error");
    requestAnimationFrame(() => {
      feedbackRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
  }

  const totales = useMemo(
    () => computeFacturaTotales(lineas, ivaPctDefault),
    [lineas, ivaPctDefault],
  );

  function fmtMoney(n: number) {
    return `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ARS`;
  }

  function fmtDate(iso: string) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  async function handleEmitirArca() {
    if (busyArca) return;
    if (emitBloqueadoRazon) {
      notifyEmitBlock(emitBloqueadoRazon);
      return;
    }
    if (!datosReady) {
      notifyEmitBlock(
        "Cargando datos de emisión. Intentá de nuevo en un momento.",
      );
      return;
    }
    if (yaAutorizada) {
      notifyEmitBlock("La factura ya tiene CAE autorizado.");
      return;
    }
    if (sinConfigArca) {
      setArcaConfigMissing(true);
      notifyEmitBlock(
        platform
          ? "Este tenant no tiene configuración ARCA. Configurala en Superadmin → ARCA / AFIP."
          : "No hay configuración ARCA para este tenant. Completala en Configuración ARCA.",
      );
      return;
    }
    if (datosEmitIncompletos) {
      notifyEmitBlock(missingEmitMessage ?? "Faltan datos para emitir.");
      return;
    }
    const lineasCheck = validateFacturaLineasDraft(lineas);
    if (!lineasCheck.ok) {
      notifyEmitBlock(
        lineasCheck.message ||
          "El detalle de la factura contiene datos inválidos.",
      );
      return;
    }
    setError(null);
    setBusyArca(true);
    try {
      const payload = { lineas: toFacturaLineasPayload(lineas) };
      const updated = await apiJson<Factura>(emitUrl, () => getToken(), {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setFacturaEmitida(updated);
      setStep("autorizada");
      onEmitido(updated);
    } catch (err) {
      const msg =
        err instanceof ApiError &&
        err.status === 404 &&
        err.message?.toLowerCase().includes("arca")
          ? err.message
          : friendlyError(err, "arca");
      if (
        err instanceof ApiError &&
        err.status === 404 &&
        err.message?.toLowerCase().includes("arca")
      ) {
        setArcaConfigMissing(true);
      } else {
        setArcaConfigMissing(false);
      }
      notifyEmitBlock(msg);
    } finally {
      setBusyArca(false);
    }
  }

  async function descargarPdf() {
    setDownloading(true);
    try {
      const res = await apiFetch(pdfUrl, () => getToken());
      if (!res.ok) throw new Error("Error al generar el PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `factura-${facturaEmitida.numero}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(friendlyError(err, "arca"));
    } finally {
      setDownloading(false);
    }
  }

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  function renderPortal(content: ReactNode) {
    if (typeof document === "undefined") return content;
    return createPortal(content, document.body);
  }

  if (yaAutorizada && step === "revision") {
    return (
      <>
        {renderPortal(
          <div
            ref={overlayRef}
            onClick={handleOverlayClick}
            className={modalOverlayClass}
          >
            <div
              className="w-full max-w-md bg-white shadow-xl border border-black/20 p-6 space-y-4 sm:rounded"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-sm text-vialto-charcoal">
                Esta factura ya tiene CAE autorizado
                {factura.cae ? `: ${factura.cae}` : "."}
              </p>
              <div className="flex justify-end gap-3">
                {factura.comprobanteUrl && (
                  <a
                    href={factura.comprobanteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-9 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist inline-flex items-center"
                  >
                    Ver comprobante
                  </a>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 px-5 bg-vialto-charcoal text-white text-xs uppercase tracking-wider"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>,
        )}
      </>
    );
  }

  return (
    <>
      {renderPortal(
        <div
          ref={overlayRef}
          onClick={handleOverlayClick}
          className={modalOverlayClass}
        >
          <div
            className="w-full max-w-lg bg-white shadow-xl border border-black/20 flex flex-col max-h-[90dvh] sm:rounded"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-4 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide text-vialto-charcoal">
                    Emitir factura a ARCA
                  </h2>
                  <AmbienteTestBadge ambiente={arcaConfig?.ambiente} />
                </div>
                <p className="text-xs text-vialto-steel mt-0.5">
                  Factura {factura.numero}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-vialto-steel hover:text-vialto-charcoal text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-5 overflow-y-auto flex-1">
              {step === "revision" && (
                <div className="space-y-5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs uppercase tracking-wider text-vialto-steel">
                      Tipo:
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-vialto-charcoal">
                      {facturaLetraLabel(letra)}
                    </span>
                    <span className="text-xs text-vialto-steel">
                      ({condicionIvaLabel(condicionIva)})
                    </span>
                  </div>

                  <section className="space-y-1">
                    <p className="text-xs uppercase tracking-wider text-vialto-steel border-b border-black/10 pb-1">
                      Emisor
                    </p>
                    <p className="text-sm text-vialto-charcoal font-medium">
                      {arcaConfig?.razonSocial ?? "—"}
                    </p>
                    <p className="text-xs text-vialto-steel">
                      CUIT {arcaConfig?.cuitEmisor ?? "—"}
                      {arcaConfig?.domicilioEmisor
                        ? ` · ${arcaConfig.domicilioEmisor}`
                        : ""}
                    </p>
                    {arcaConfig && (
                      <p className="text-xs text-vialto-steel">
                        Ing. Brutos: {arcaConfig.ingBrutos?.trim() || "—"}
                        {" · "}
                        Inic. act.: {arcaConfig.inicActEmisor?.trim() || "—"}
                      </p>
                    )}
                  </section>

                  <section className="space-y-1">
                    <p className="text-xs uppercase tracking-wider text-vialto-steel border-b border-black/10 pb-1">
                      Receptor (cliente)
                    </p>
                    <p className="text-sm text-vialto-charcoal font-medium">
                      {clienteDetalle?.nombre ?? "—"}
                    </p>
                    <p className="text-xs text-vialto-steel">
                      {condicionIvaLabel(condicionIva)}
                      {clienteDetalle?.idFiscal
                        ? ` · CUIT ${clienteDetalle.idFiscal}`
                        : ""}
                    </p>
                    {clienteDetalle?.direccion && (
                      <p className="text-xs text-vialto-steel">
                        {clienteDetalle.direccion}
                      </p>
                    )}
                    {clienteDetalle?.pais && (
                      <p className="text-xs text-vialto-steel">
                        País: {clienteDetalle.pais}
                      </p>
                    )}
                    {missingClienteFields.length > 0 && (
                      <div className="mt-2 rounded border border-amber-400/40 bg-amber-50 px-3 py-2 text-xs text-amber-900" role="alert">
                        <p className="font-medium">
                          Faltan datos del cliente: {missingClienteFields.map((f) => f.replace("Cliente: ", "")).join(", ")}.
                          <br />
                          <strong className="font-bold">Desplazate hacia abajo para completarlos.</strong>
                        </p>
                      </div>
                    )}
                  </section>

                  <section className="space-y-1">
                    <p className="text-xs uppercase tracking-wider text-vialto-steel border-b border-black/10 pb-1">
                      Comprobante
                    </p>
                    <Row label="Número local" value={factura.numero ?? "—"} />
                    <Row
                      label="Fecha de emisión"
                      value={fmtDate(factura.fechaEmision)}
                    />
                  </section>

                  {bloqueadoUsd && (
                    <p
                      className="text-xs text-amber-900 border border-amber-400/40 bg-amber-50 px-3 py-2"
                      role="alert"
                    >
                      {MSG_ARCA_NO_FACTURA_USD}
                    </p>
                  )}

                  <section className="space-y-1.5 pt-2">
                    <p className="text-xs uppercase tracking-wider text-vialto-steel border-b border-black/10 pb-1">
                      Detalles del viaje
                    </p>
                    <div className="space-y-3 pt-1">
                      {lineas.map((linea, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-start text-sm"
                        >
                          <div className="text-vialto-charcoal pr-4 whitespace-pre-wrap">
                            {linea.descripcion || "Sin descripción"}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="tabular-nums font-medium text-vialto-charcoal">
                              {fmtMoney(linea.importe || 0)}
                            </div>
                            <div className="text-xs text-vialto-steel tabular-nums mt-0.5">
                              IVA: {linea.ivaPct ?? ivaPctDefault}%
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <div className="flex justify-between text-xs font-semibold text-vialto-charcoal border-t border-black/10 pt-2">
                    <span>Total a facturar</span>
                    <span className="tabular-nums">
                      {fmtMoney(totales.total)}
                    </span>
                  </div>

                  {sinConfigArca && (
                    <div
                      className="border border-amber-400/40 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                      role="alert"
                    >
                      <p className="font-medium">
                        Falta configuración ARCA del tenant
                      </p>
                      <p className="mt-1">
                        {platform
                          ? "Completala en Superadmin → ARCA / AFIP antes de emitir."
                          : "Completala en Configuración ARCA antes de emitir."}
                      </p>
                    </div>
                  )}

                  {missingEmisorFields.length > 0 && !sinConfigArca && (
                    <div
                      className="border border-amber-400/40 bg-amber-50 px-3 py-2 text-xs text-amber-900"
                      role="alert"
                    >
                      <p className="font-medium">
                        Completá estos datos antes de emitir
                      </p>
                      <ul className="mt-1 list-disc pl-4 space-y-0.5">
                        {missingEmisorFields.map((f) => (
                          <li key={f}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {missingClienteFields.length > 0 &&
                    !sinConfigArca &&
                    factura.clienteId && (
                      <CompletarDatosFiscalesInline
                        entidad="cliente"
                        id={factura.clienteId}
                        tenantId={tenantId}
                        getToken={getToken}
                        initial={{
                          nombre: clienteDetalle?.nombre ?? "",
                          pais: clienteDetalle?.pais ?? null,
                          idFiscal: clienteDetalle?.idFiscal ?? null,
                          condicionIva: clienteDetalle?.condicionIva ?? null,
                          condicionTributaria:
                            clienteDetalle?.condicionTributaria ?? null,
                          direccion: clienteDetalle?.direccion ?? null,
                        }}
                        onSaved={(updated) => {
                          setClienteDetalle(updated as Cliente);
                          onDataSaved?.();
                        }}
                      />
                    )}

                  <div ref={feedbackRef} className="space-y-2">
                    {error && <ArcaEmitErrorAlert error={error} />}
                    {arcaConfigMissing && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          navigate(
                            platform
                              ? "/superadmin/arca"
                              : "/configuracion/arca",
                          );
                        }}
                        className="w-full h-9 border border-black/20 text-xs uppercase tracking-wider text-vialto-steel hover:bg-vialto-mist"
                      >
                        {platform
                          ? "Ir a ARCA / AFIP (superadmin)"
                          : "Ir a configuración de ARCA"}
                      </button>
                    )}

                    {emitBloqueadoRazon && (
                      <p
                        className="text-xs text-amber-900 border border-amber-400/40 bg-amber-50 px-3 py-2"
                        role="alert"
                      >
                        {emitBloqueadoRazon}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {step === "autorizada" && (
                <div className="space-y-5">
                  <div className="border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <p className="text-sm font-medium text-emerald-800">
                      Comprobante autorizado por ARCA
                    </p>
                    {facturaEmitida.cae && (
                      <p className="text-xs text-emerald-700 mt-0.5">
                        CAE: {facturaEmitida.cae}
                      </p>
                    )}
                    {facturaEmitida.caeFechaVto && (
                      <p className="text-xs text-emerald-700">
                        Vto. CAE: {fmtDate(facturaEmitida.caeFechaVto)}
                      </p>
                    )}
                  </div>

                  <section className="space-y-1.5">
                    <p className="text-xs uppercase tracking-wider text-vialto-steel border-b border-black/10 pb-1">
                      Resumen
                    </p>
                    <Row label="Tipo" value={facturaLetraLabel(letra)} />
                    <Row
                      label="Cliente"
                      value={clienteDetalle?.nombre ?? "—"}
                    />
                    <Row label="Neto" value={fmtMoney(totales.neto)} />
                    <Row label="IVA" value={fmtMoney(totales.iva)} />
                    <div className="flex justify-between text-xs font-semibold text-vialto-charcoal border-t border-black/10 pt-1.5 mt-0.5">
                      <span>Total</span>
                      <span className="tabular-nums">
                        {fmtMoney(totales.total)}
                      </span>
                    </div>
                  </section>

                  {error && <ArcaEmitErrorAlert error={error} />}

                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      disabled={downloading}
                      onClick={() => void descargarPdf()}
                      className="h-9 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist disabled:opacity-50"
                    >
                      {downloading ? "Generando…" : "Descargar PDF"}
                    </button>
                    {facturaEmitida.comprobanteUrl && (
                      <a
                        href={facturaEmitida.comprobanteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-9 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist inline-flex items-center"
                      >
                        Ver comprobante
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={onClose}
                      className="h-9 px-5 bg-vialto-charcoal text-white text-xs uppercase tracking-wider hover:bg-vialto-charcoal/90"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {step === "revision" && (
              <div className="flex shrink-0 justify-end gap-3 border-t border-black/10 px-6 py-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={busyArca}
                  className="h-9 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-steel hover:bg-vialto-mist disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={busyArca}
                  onClick={() => void handleEmitirArca()}
                  className="inline-flex items-center gap-2 h-9 px-5 bg-vialto-charcoal text-white text-xs uppercase tracking-wider hover:bg-vialto-charcoal/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {!busyArca && (
                    <Receipt
                      className="h-4 w-4 shrink-0"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  )}
                  {busyArca
                    ? "Enviando a ARCA…"
                    : !datosReady
                      ? "Cargando datos…"
                      : "Confirmar y emitir"}
                </button>
              </div>
            )}
          </div>
        </div>,
      )}
    </>
  );
}
