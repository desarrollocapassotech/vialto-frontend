import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@clerk/clerk-react";
import { Ban } from "lucide-react";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import {
  computeFacturaTotales,
  defaultFacturaLineas,
  type FacturaLineaDraft,
} from "@/components/facturacion/FacturaLineasEditor";
import { AmbienteTestBadge } from "@/components/liquidaciones/AmbienteTestBadge";
import { ErrorPieModal } from "@/components/shared/ErrorPieModal";
import { BloqueoModal } from "@/components/ui/BloqueoModal";
import { AdjuntoPreviewModal } from "@/components/shared/AdjuntoPreviewModal";
import { Spinner } from "@/components/ui/Spinner";
import { ApiError, apiFetch, apiJson } from "@/lib/api";
import {
  condicionIvaLabel,
  facturaLetraFromCbteTipo,
  facturaLetraFromCondicionIva,
  facturaLetraLabel,
  facturaNcCbteTipoFromFactura,
  facturaNcLabel,
  nroComprobante,
} from "@/lib/arcaCbteTipo";
import {
  Dato,
  DatosCabecera,
  DetalleMontosCard,
  FilaMonto,
} from "@/components/shared/DetalleComprobante";
import { friendlyError } from "@/lib/friendlyError";
import { fmtDateUtc } from "@/lib/fmtDateUtc";
import {
  isAfipInfrastructureError,
  MSG_AFIP_INFRA,
} from "@/lib/arcaFriendlyError";
import { ArcaEmitErrorAlert } from "@/components/ui/ArcaErrorMessage";
import { modalOverlayClass } from "@/lib/modalLayers";
import { useToast } from "@/lib/toast";
import type { ArcaConfig, Cliente, Factura, Viaje } from "@/types/api";

type Step = "revision" | "resultado";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs gap-3">
      <span className="text-vialto-steel shrink-0">{label}</span>
      <span className="tabular-nums text-vialto-charcoal text-right">
        {value}
      </span>
    </div>
  );
}

function fmtMoney(n: number) {
  return `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ARS`;
}

function fmtDate(iso: string | null | undefined) {
  return fmtDateUtc(iso);
}

interface Props {
  factura: Factura;
  viajes: Viaje[];
  tenantId?: string;
  clienteInicial?: Cliente | null;
  onClose: () => void;
  onAnulada: (factura: Factura) => void;
}

/**
 * Pre-impresión + emisión de Nota de Crédito A/B contra ARCA para anular
 * una Factura A/B ya autorizada. El tipo NC (03/08) lo determina el original.
 */
export function AnularFacturaModal({
  factura,
  viajes,
  tenantId,
  clienteInicial = null,
  onClose,
  onAnulada,
}: Props) {
  const { getToken } = useAuth();
  const { showToast } = useToast();
  const platform = Boolean(tenantId?.trim());

  const [step, setStep] = useState<Step>("revision");
  const [motivo, setMotivo] = useState("");
  const [motivoErrors, setMotivoErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facturaResultado, setFacturaResultado] = useState<Factura>(factura);
  const [downloading, setDownloading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [arcaConfig, setArcaConfig] = useState<ArcaConfig | null>(null);
  const [clienteDetalle, setClienteDetalle] = useState<Cliente | null>(
    clienteInicial,
  );
  const [datosReady, setDatosReady] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useLockBodyScroll(true);

  const configUrl = platform
    ? `/api/platform/arca/config?tenantId=${encodeURIComponent(tenantId!)}`
    : "/api/integracion-arca/config";
  const anularUrl = platform
    ? `/api/platform/arca/facturas/${encodeURIComponent(factura.id)}/anular?tenantId=${encodeURIComponent(tenantId!)}`
    : `/api/integracion-arca/facturas/${encodeURIComponent(factura.id)}/anular`;
  const pdfAnulacionUrl = platform
    ? `/api/platform/arca/facturas/${encodeURIComponent(factura.id)}/pdf-anulacion?tenantId=${encodeURIComponent(tenantId!)}`
    : `/api/integracion-arca/facturas/${encodeURIComponent(factura.id)}/pdf-anulacion`;

  const yaAnulada = factura.arcaEstado === "anulado";
  // Reintento si un intento previo quedó pendiente_cae / error (sigue el CAE original).
  const puedeAnular =
    factura.tipo === "cliente" &&
    Boolean(factura.cae) &&
    !yaAnulada &&
    !factura.anulacionCae &&
    (factura.arcaEstado === "autorizado" ||
      factura.arcaEstado === "pendiente_cae" ||
      factura.arcaEstado === "error");

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
      if (factura.clienteId) {
        try {
          const url = platform
            ? `/api/platform/clientes/${encodeURIComponent(factura.clienteId)}?tenantId=${encodeURIComponent(tenantId!)}`
            : `/api/clientes/${encodeURIComponent(factura.clienteId)}`;
          const c = await apiJson<Cliente>(url, () => getToken());
          if (!cancelled) setClienteDetalle(c);
        } catch {
          /* se usa clienteInicial */
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
  const letraFactura =
    facturaLetraFromCbteTipo(factura.cbteTipo) ??
    facturaLetraFromCondicionIva(condicionIva);
  const ncTipo = facturaNcCbteTipoFromFactura(factura.cbteTipo, condicionIva);

  const lineas: FacturaLineaDraft[] = useMemo(
    () => defaultFacturaLineas(factura, viajes),
    [factura, viajes],
  );
  const ivaPctDefault = factura.ivaPct ?? arcaConfig?.ivaGastosAdmin ?? 21;
  const totales = useMemo(
    () => computeFacturaTotales(lineas, ivaPctDefault),
    [lineas, ivaPctDefault],
  );

  async function handleConfirmarAnular() {
    if (busy) return;
    const trimmed = motivo.trim();
    if (!trimmed) {
      setMotivoErrors({ motivo: "Ingresá el motivo de anulación." });
      return;
    }
    if (!puedeAnular) {
      setError(
        yaAnulada
          ? "Esta factura ya está anulada."
          : "Solo se pueden anular facturas con CAE autorizado.",
      );
      return;
    }
    setMotivoErrors({});
    setError(null);
    setBusy(true);
    try {
      const updated = await apiJson<Factura>(anularUrl, () => getToken(), {
        method: "POST",
        body: JSON.stringify({ motivo: trimmed }),
      });
      setFacturaResultado(updated);
      setStep("resultado");
      onAnulada(updated);
      if (updated.arcaEstado === "anulado" && updated.anulacionCae) {
        showToast(
          `Nota de Crédito autorizada. CAE: ${updated.anulacionCae}`,
        );
      } else if (updated.arcaEstado === "pendiente_cae") {
        showToast(
          "La anulación quedó pendiente de CAE. Podés reintentar más tarde.",
          "error",
        );
      } else if (updated.arcaEstado === "error") {
        showToast(
          updated.arcaError ?? "ARCA rechazó la Nota de Crédito.",
          "error",
        );
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? friendlyError(err, "arca")
          : friendlyError(err, "arca");
      setError(msg);
      showToast(msg, "error");
    } finally {
      setBusy(false);
    }
  }

  /**
   * "Ver comprobante" de la NC, en pestaña nueva (regla del sistema): el PDF subido si
   * existe; si no, el que genera el backend con los datos de la NC.
   */
  async function verComprobanteNc(notaCreditoUrl?: string | null) {
    if (notaCreditoUrl) {
      setPreviewUrl(notaCreditoUrl);
      return;
    }
    // La pestaña se abre en el click (si no, el navegador la bloquea como popup).
    const ventana = window.open("", "_blank");
    setDownloading(true);
    try {
      const res = await apiFetch(pdfAnulacionUrl, () => getToken());
      if (!res.ok) throw new Error("Error al generar el PDF de la NC");
      const url = URL.createObjectURL(await res.blob());
      if (ventana) ventana.location.href = url;
      else window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      ventana?.close();
      setError(friendlyError(err, "arca"));
    } finally {
      setDownloading(false);
    }
  }

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === overlayRef.current && !busy) onClose();
  }

  function renderPortal(content: ReactNode) {
    if (typeof document === "undefined") return content;
    return createPortal(content, document.body);
  }

  if (yaAnulada && step === "revision") {
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
                Esta factura ya está anulada
                {factura.anulacionCae
                  ? ` (CAE NC: ${factura.anulacionCae}).`
                  : "."}
              </p>
              <div className="flex justify-end gap-3">
                {(factura.notaCreditoUrl || factura.anulacionCae) && (
                  <button
                    type="button"
                    disabled={downloading}
                    onClick={() => void verComprobanteNc(factura.notaCreditoUrl)}
                    className="h-9 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist disabled:opacity-50"
                  >
                    {downloading ? "Generando…" : "Ver comprobante"}
                  </button>
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
        {previewUrl && (
          <AdjuntoPreviewModal
            url={previewUrl}
            title="Nota de Crédito"
            onClose={() => setPreviewUrl(null)}
          />
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
            className="relative w-full max-w-4xl bg-white shadow-xl border border-black/20 flex flex-col max-h-[90dvh] sm:rounded"
            onClick={(e) => e.stopPropagation()}
          >
            {busy && (
              // Emitiendo la NC contra ARCA: se bloquea todo el modal, no solo el botón.
              <BloqueoModal mensaje="Emitiendo la nota de crédito en ARCA… No cierres esta ventana." />
            )}
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-4 shrink-0">
              <div>
                <h2 className="inline-flex flex-wrap items-center gap-3 font-[family-name:var(--font-display)] text-xl tracking-wide text-vialto-charcoal">
                  Anular factura
                  {/* Ambiente de pruebas: badge junto al título, como en los demás modales. */}
                  <AmbienteTestBadge ambiente={arcaConfig?.ambiente} />
                </h2>
                <p className="text-xs text-vialto-steel mt-0.5">
                  Factura {factura.numero} · se emite{" "}
                  {facturaNcLabel(ncTipo)}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="text-vialto-steel hover:text-vialto-charcoal text-xl leading-none disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-5 overflow-y-auto flex-1">
              {step === "revision" && (
                <div className="space-y-5">

                  {/* Cabecera compacta, mismo criterio que los detalles de Factura y Liquidación. */}
                  <DatosCabecera>
                    <Dato
                      label="Se emite"
                      value={facturaNcLabel(ncTipo).replace(/ \(cód\. \d+\)$/, "")}
                      sub={facturaNcLabel(ncTipo).match(/\(cód\. \d+\)$/)?.[0]}
                    />
                    <Dato
                      label="Factura original"
                      value={facturaLetraLabel(letraFactura)}
                      sub={
                        factura.cbteNro != null
                          ? `N° ${nroComprobante(factura.ptoVenta, factura.cbteNro)}`
                          : factura.numero
                            ? `N° ${factura.numero}`
                            : undefined
                      }
                      sub2={
                        factura.cae
                          ? `CAE ${factura.cae} · ${fmtDate(factura.fechaEmision)}`
                          : fmtDate(factura.fechaEmision)
                      }
                    />
                    <Dato
                      label="Cliente"
                      value={clienteDetalle?.nombre ?? "—"}
                      sub={[
                        clienteDetalle?.idFiscal ? `CUIT ${clienteDetalle.idFiscal}` : null,
                        condicionIva != null ? condicionIvaLabel(condicionIva) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      sub2={clienteDetalle?.direccion ?? undefined}
                      className="col-span-2 sm:col-span-1"
                    />
                    <Dato
                      label="Emisor"
                      value={arcaConfig?.razonSocial ?? "—"}
                      sub={[
                        arcaConfig?.cuitEmisor ? `CUIT ${arcaConfig.cuitEmisor}` : null,
                        arcaConfig?.condicionIvaEmisor
                          ? condicionIvaLabel(Number(arcaConfig.condicionIvaEmisor))
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      sub2={arcaConfig?.domicilioEmisor ?? undefined}
                      className="col-span-2 sm:col-span-1"
                    />
                  </DatosCabecera>

                  <DetalleMontosCard titulo="Líneas a revertir">
                    {lineas.map((l, i) => (
                      <FilaMonto
                        key={`${l.descripcion}-${i}`}
                        label={
                          <>
                            {l.descripcion || "—"}
                            {l.ivaPct != null && (
                              <span className="text-vialto-steel"> (IVA {l.ivaPct}%)</span>
                            )}
                          </>
                        }
                        value={fmtMoney(l.importe)}
                      />
                    ))}
                    <FilaMonto label="Neto" value={fmtMoney(totales.neto)} separator />
                    <FilaMonto label="IVA" value={`+ ${fmtMoney(totales.iva)}`} muted />
                    <FilaMonto
                      label="Total a acreditar"
                      value={fmtMoney(totales.total)}
                      bold
                      separator
                    />
                  </DetalleMontosCard>

                  <label className="grid gap-1.5">
                    <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.18em] text-vialto-steel">
                      Motivo de anulación{" "}
                      <span className="text-red-500">*</span>
                    </span>
                    <textarea
                      value={motivo}
                      disabled={busy}
                      rows={3}
                      maxLength={2000}
                      placeholder="Indicá el motivo…"
                      onChange={(e) => {
                        setMotivo(e.target.value);
                        if (motivoErrors.motivo) setMotivoErrors({});
                      }}
                      className={`w-full rounded border bg-white px-3 py-2 text-sm text-vialto-charcoal focus:outline-none focus:ring-2 focus:ring-vialto-fire/35 disabled:opacity-50 ${
                        motivoErrors.motivo ? "border-red-400" : "border-black/15"
                      }`}
                    />
                  </label>
                </div>
              )}

              {step === "resultado" && (
                <div className="space-y-5">
                  {facturaResultado.arcaEstado === "anulado" &&
                  facturaResultado.anulacionCae ? (
                    <div className="border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <p className="text-sm font-medium text-emerald-800">
                        Nota de Crédito autorizada por ARCA
                      </p>
                      <p className="text-xs text-emerald-700 mt-0.5">
                        CAE: {facturaResultado.anulacionCae}
                      </p>
                      {facturaResultado.anulacionCaeFechaVto && (
                        <p className="text-xs text-emerald-700">
                          Vto. CAE:{" "}
                          {fmtDate(facturaResultado.anulacionCaeFechaVto)}
                        </p>
                      )}
                    </div>
                  ) : facturaResultado.arcaEstado === "pendiente_cae" ? (
                    <div className="border border-amber-200 bg-amber-50 px-4 py-3">
                      <p className="text-sm font-medium text-amber-900">
                        Anulación pendiente de CAE
                      </p>
                      <p className="text-xs text-amber-800 mt-0.5">
                        {isAfipInfrastructureError(facturaResultado.arcaError)
                          ? MSG_AFIP_INFRA
                          : "No hubo respuesta completa de ARCA. Podés reintentar más tarde."}
                      </p>
                    </div>
                  ) : (
                    <div className="border border-red-200 bg-red-50 px-4 py-3">
                      <p className="text-sm font-medium text-red-800">
                        Error al anular
                      </p>
                      <p className="text-xs text-red-700 mt-0.5">
                        {facturaResultado.arcaError ??
                          "ARCA rechazó la Nota de Crédito."}
                      </p>
                    </div>
                  )}

                  <section className="space-y-1.5">
                    <p className="text-xs uppercase tracking-wider text-vialto-steel border-b border-black/10 pb-1">
                      Resumen
                    </p>
                    <Row label="NC" value={facturaNcLabel(ncTipo)} />
                    <Row
                      label="Cliente"
                      value={clienteDetalle?.nombre ?? "—"}
                    />
                    <Row
                      label="Total acreditado"
                      value={fmtMoney(totales.total)}
                    />
                    {facturaResultado.anulacionCbteNro != null && (
                      <Row
                        label="Pto. venta / Nro. NC"
                        value={`${facturaResultado.anulacionPtoVenta ?? "—"} / ${facturaResultado.anulacionCbteNro}`}
                      />
                    )}
                  </section>

                  {error && <ArcaEmitErrorAlert error={error} />}

                  <div className="flex flex-wrap justify-end gap-3">
                    {(facturaResultado.anulacionCae || facturaResultado.notaCreditoUrl) && (
                      <button
                        type="button"
                        disabled={downloading}
                        onClick={() => void verComprobanteNc(facturaResultado.notaCreditoUrl)}
                        className="h-9 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist disabled:opacity-50"
                      >
                        {downloading ? "Generando…" : "Ver comprobante"}
                      </button>
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
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-black/10 px-6 py-4">
                <ErrorPieModal error={error} fieldErrors={motivoErrors} />
                <button
                  type="button"
                  onClick={onClose}
                  disabled={busy}
                  className="h-9 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-steel hover:bg-vialto-mist disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={busy || !datosReady || !puedeAnular}
                  onClick={() => void handleConfirmarAnular()}
                  className="inline-flex items-center gap-2 h-9 px-5 bg-vialto-charcoal text-white text-xs uppercase tracking-wider hover:bg-vialto-charcoal/90 disabled:opacity-50"
                >
                  {busy ? (
                    <Spinner className="h-3.5 w-3.5" />
                  ) : (
                    <Ban
                      className="h-3.5 w-3.5 shrink-0"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                  )}
                  {busy
                    ? "Emitiendo NC…"
                    : !datosReady
                      ? "Cargando datos…"
                      : "Confirmar y anular"}
                </button>
              </div>
            )}
          </div>
        </div>,
      )}
      {previewUrl && (
        <AdjuntoPreviewModal
          url={previewUrl}
          title="Nota de Crédito"
          onClose={() => setPreviewUrl(null)}
        />
      )}
    </>
  );
}
