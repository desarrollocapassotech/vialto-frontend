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
import { AmbienteHomologacionWarning } from "@/components/liquidaciones/AmbienteHomologacionWarning";
import { CrudFieldError } from "@/components/crud/CrudFieldError";
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
} from "@/lib/arcaCbteTipo";
import { friendlyError } from "@/lib/friendlyError";
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
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
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
  const [motivoError, setMotivoError] = useState<string | null>(null);
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
      setMotivoError("Ingresá el motivo de anulación.");
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
    setMotivoError(null);
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

  async function descargarPdfNc() {
    setDownloading(true);
    try {
      const res = await apiFetch(pdfAnulacionUrl, () => getToken());
      if (!res.ok) throw new Error("Error al generar el PDF de la NC");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nc-${factura.numero}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
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
                    onClick={() => {
                      if (factura.notaCreditoUrl) {
                        setPreviewUrl(factura.notaCreditoUrl);
                      } else {
                        void descargarPdfNc();
                      }
                    }}
                    className="h-9 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
                  >
                    Ver NC
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
            className="w-full max-w-lg bg-white shadow-xl border border-black/20 flex flex-col max-h-[90dvh] sm:rounded"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-4 shrink-0">
              <div>
                <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide text-vialto-charcoal">
                  Anular factura
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
                  <div className="rounded border border-amber-300/70 bg-amber-50 px-3 py-2.5 text-xs text-amber-950">
                    Se emitirá una Nota de Crédito asociada a la{" "}
                    {facturaLetraLabel(letraFactura)} original (pto. vta.{" "}
                    {factura.ptoVenta ?? "—"} / nro. {factura.cbteNro ?? "—"}).
                    Revisá los datos antes de confirmar: son los que figurarán
                    en el PDF.
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs uppercase tracking-wider text-vialto-steel">
                      Tipo NC:
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-vialto-charcoal">
                      {facturaNcLabel(ncTipo)}
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
                    {arcaConfig?.condicionIvaEmisor && (
                      <p className="text-xs text-vialto-steel">
                        {arcaConfig.condicionIvaEmisor}
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
                  </section>

                  <section className="space-y-1.5">
                    <p className="text-xs uppercase tracking-wider text-vialto-steel border-b border-black/10 pb-1">
                      Comprobante original
                    </p>
                    <Row
                      label="Tipo"
                      value={facturaLetraLabel(letraFactura)}
                    />
                    <Row label="Número local" value={factura.numero ?? "—"} />
                    <Row
                      label="Pto. venta / Nro."
                      value={`${factura.ptoVenta ?? "—"} / ${factura.cbteNro ?? "—"}`}
                    />
                    <Row label="CAE" value={factura.cae ?? "—"} />
                    <Row
                      label="Fecha emisión"
                      value={fmtDate(factura.fechaEmision)}
                    />
                  </section>

                  <section className="space-y-2">
                    <p className="text-xs uppercase tracking-wider text-vialto-steel border-b border-black/10 pb-1">
                      Líneas a revertir
                    </p>
                    <div className="space-y-1.5">
                      {lineas.map((l, i) => (
                        <div
                          key={`${l.descripcion}-${i}`}
                          className="flex justify-between gap-3 text-xs"
                        >
                          <span className="text-vialto-charcoal min-w-0">
                            {l.descripcion || "—"}
                            {l.ivaPct != null ? (
                              <span className="text-vialto-steel">
                                {" "}
                                (IVA {l.ivaPct}%)
                              </span>
                            ) : null}
                          </span>
                          <span className="tabular-nums text-vialto-charcoal shrink-0">
                            {fmtMoney(l.importe)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-black/10 pt-2 space-y-1">
                      <Row label="Neto" value={fmtMoney(totales.neto)} />
                      <Row label="IVA" value={fmtMoney(totales.iva)} />
                      <div className="flex justify-between text-xs font-semibold text-vialto-charcoal pt-0.5">
                        <span>Total a acreditar</span>
                        <span className="tabular-nums">
                          {fmtMoney(totales.total)}
                        </span>
                      </div>
                    </div>
                  </section>

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
                        if (motivoError) setMotivoError(null);
                      }}
                      className={`w-full rounded border bg-white px-3 py-2 text-sm text-vialto-charcoal focus:outline-none focus:ring-2 focus:ring-vialto-fire/35 disabled:opacity-50 ${
                        motivoError ? "border-red-400" : "border-black/15"
                      }`}
                    />
                    <CrudFieldError message={motivoError ?? undefined} />
                  </label>

                  {error && (
                    <p
                      className="text-xs text-red-700 border border-red-200 bg-red-50 px-3 py-2"
                      role="alert"
                    >
                      {error}
                    </p>
                  )}

                  <AmbienteHomologacionWarning
                    ambiente={arcaConfig?.ambiente}
                  />
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
                        No hubo respuesta completa de ARCA. Podés reintentar
                        más tarde.
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

                  {error && (
                    <p className="text-xs text-red-700 border border-red-200 bg-red-50 px-3 py-2">
                      {error}
                    </p>
                  )}

                  <div className="flex flex-wrap justify-end gap-3">
                    {facturaResultado.anulacionCae && (
                      <>
                        <button
                          type="button"
                          disabled={downloading}
                          onClick={() => void descargarPdfNc()}
                          className="h-9 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist disabled:opacity-50"
                        >
                          {downloading ? "Generando…" : "Descargar PDF NC"}
                        </button>
                        {facturaResultado.notaCreditoUrl && (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewUrl(facturaResultado.notaCreditoUrl!)
                            }
                            className="h-9 px-4 border border-black/20 text-xs uppercase tracking-wider text-vialto-charcoal hover:bg-vialto-mist"
                          >
                            Ver NC
                          </button>
                        )}
                      </>
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
