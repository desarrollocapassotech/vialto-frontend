import { useEffect, useState } from "react";
import {
  ConceptosLiquidacionLineasEditor,
  toConceptosLineasPayload,
  type ConceptoLineaDraft,
} from "@/components/liquidaciones/ConceptosLiquidacionLineasEditor";
import { ComprobanteAdjuntoField } from "@/components/shared/ComprobanteAdjuntoField";
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
} from "@/components/ui/ViewModalShell";
import { Spinner } from "@/components/ui/Spinner";
import { apiJson } from "@/lib/api";
import { uploadComprobante } from "@/lib/comprobanteUpload";
import { friendlyError } from "@/lib/friendlyError";
import { useToast } from "@/lib/toast";
import type { LiquidacionConTransportista } from "@/components/liquidaciones/LiquidacionViewModal";

const INPUT =
  "h-9 w-full border border-black/15 bg-white px-2 text-sm text-vialto-charcoal focus:outline-none focus:border-vialto-fire";
const LABEL =
  "block text-xs font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel mb-1";

function toDateInput(iso: string | null | undefined) {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function fmtMoney(n: number) {
  return `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function LiquidacionEditModal({
  liq,
  hasArca,
  getToken,
  onClose,
  onSaved,
}: {
  liq: LiquidacionConTransportista;
  hasArca: boolean;
  getToken: () => Promise<string | null>;
  onClose: () => void;
  onSaved: (updated: LiquidacionConTransportista) => void;
}) {
  const { showToast } = useToast();
  const canEditDatos =
    liq.estado === "borrador" ||
    liq.estado === "error" ||
    liq.estado === "pendiente_cae";
  const showComprobante = !hasArca;

  const [periodoDesde, setPeriodoDesde] = useState(toDateInput(liq.periodoDesde));
  const [periodoHasta, setPeriodoHasta] = useState(toDateInput(liq.periodoHasta));
  const [comisionPct, setComisionPct] = useState(String(liq.comisionPct ?? ""));
  const [conceptosLineas, setConceptosLineas] = useState<ConceptoLineaDraft[]>(() =>
    (liq.conceptosLineas ?? [])
      .filter((l) => l.conceptoLiquidacionId)
      .map((l) => ({
        conceptoLiquidacionId: l.conceptoLiquidacionId as string,
        monto: l.monto,
        nombre: l.nombreSnapshot,
        signo: l.signo,
        ivaPct: l.ivaPct,
      })),
  );
  const [lineasLoading, setLineasLoading] = useState(canEditDatos);
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const [comprobanteUrl, setComprobanteUrl] = useState<string | null>(
    liq.comprobanteUrl ?? null,
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!canEditDatos) {
      setLineasLoading(false);
      return;
    }
    let cancelled = false;
    setLineasLoading(true);
    void (async () => {
      try {
        const full = await apiJson<LiquidacionConTransportista>(
          `/api/integracion-arca/liquidaciones/${encodeURIComponent(liq.id)}`,
          () => getToken(),
        );
        if (cancelled) return;
        setConceptosLineas(
          (full.conceptosLineas ?? [])
            .filter((l) => l.conceptoLiquidacionId)
            .map((l) => ({
              conceptoLiquidacionId: l.conceptoLiquidacionId as string,
              monto: l.monto,
              nombre: l.nombreSnapshot,
              signo: l.signo,
              ivaPct: l.ivaPct,
            })),
        );
      } catch {
        // se edita con lo que haya en el listado si falla la carga
      } finally {
        if (!cancelled) setLineasLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canEditDatos, getToken, liq.id]);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, saving]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (canEditDatos) {
      if (!periodoDesde) errs.periodoDesde = "Ingresá la fecha desde.";
      if (!periodoHasta) errs.periodoHasta = "Ingresá la fecha hasta.";
      if (periodoDesde && periodoHasta && periodoHasta < periodoDesde) {
        errs.periodoHasta = "La fecha hasta debe ser posterior o igual a desde.";
      }
      const pct = Number(comisionPct);
      if (comisionPct.trim() !== "" && (isNaN(pct) || pct < 0 || pct > 100)) {
        errs.comisionPct = "La comisión debe ser un número entre 0 y 100.";
      }
    }
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    if (canEditDatos && lineasLoading) {
      setError("Esperá a que terminen de cargar los conceptos.");
      return;
    }
    setSaving(true);
    setError(null);

    try {
      let nextComprobanteUrl: string | null | undefined = comprobanteUrl;
      if (showComprobante) {
        if (comprobanteFile) {
          nextComprobanteUrl = await uploadComprobante(
            () => getToken(),
            comprobanteFile,
            "facturacion",
          );
        }
      }

      const body: Record<string, unknown> = {};
      if (canEditDatos) {
        body.periodoDesde = periodoDesde;
        body.periodoHasta = periodoHasta;
        if (comisionPct.trim() !== "") {
          body.comisionPct = Number(comisionPct);
        }
        body.conceptosLineas = toConceptosLineasPayload(conceptosLineas);
      }
      if (showComprobante) {
        body.comprobanteUrl = nextComprobanteUrl ?? null;
      }

      const updated = await apiJson<LiquidacionConTransportista>(
        `/api/integracion-arca/liquidaciones/${encodeURIComponent(liq.id)}`,
        () => getToken(),
        { method: "PATCH", body: JSON.stringify(body) },
      );

      showToast("Liquidación actualizada", "success");
      onSaved({
        ...updated,
        transportista: updated.transportista ?? liq.transportista,
      });
    } catch (err) {
      setError(friendlyError(err, "liquidaciones"));
      showToast("No se pudo actualizar la liquidación", "error");
    } finally {
      setSaving(false);
    }
  }

  const transportistaNombre =
    liq.transportista?.nombre ?? liq.transportistaId;

  return (
    <ViewModalShell
      title="Editar liquidación"
      onClose={saving ? () => {} : onClose}
      scrollBody
      maxWidthClass="sm:max-w-xl"
      footer={
        <>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className={viewModalBtnGhost}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="liquidacion-edit-form"
            disabled={saving || lineasLoading}
            className={viewModalBtnPrimary}
          >
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <Spinner className="h-3.5 w-3.5" />
                Guardando…
              </span>
            ) : lineasLoading ? (
              "Cargando…"
            ) : (
              "Guardar cambios"
            )}
          </button>
        </>
      }
    >
      <form
        id="liquidacion-edit-form"
        onSubmit={(e) => void handleSubmit(e)}
        className="space-y-5"
      >
        <div className="rounded border border-black/10 bg-vialto-mist px-4 py-3">
          <p className="text-xs uppercase tracking-[0.08em] text-vialto-steel">
            Transportista
          </p>
          <p className="mt-1 text-sm font-medium text-vialto-charcoal">
            {transportistaNombre}
          </p>
          <p className="mt-2 text-xs text-vialto-steel">
            Bruto {fmtMoney(liq.bruto)} · Líquido {fmtMoney(liq.liquido)} ·{" "}
            {liq.cantViajes} viaje{liq.cantViajes !== 1 ? "s" : ""}
          </p>
        </div>

        {canEditDatos ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="liq-periodo-desde" className={LABEL}>
                  Desde <span className="text-red-500">*</span>
                </label>
                <input
                  id="liq-periodo-desde"
                  type="date"
                  value={periodoDesde}
                  onChange={(e) => setPeriodoDesde(e.target.value)}
                  disabled={saving}
                  className={`${INPUT} ${fieldErrors.periodoDesde ? "border-red-400" : ""}`}
                />
                {fieldErrors.periodoDesde && (
                  <p className="mt-1 text-xs font-medium text-red-600">
                    {fieldErrors.periodoDesde}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="liq-periodo-hasta" className={LABEL}>
                  Hasta <span className="text-red-500">*</span>
                </label>
                <input
                  id="liq-periodo-hasta"
                  type="date"
                  value={periodoHasta}
                  min={periodoDesde || undefined}
                  onChange={(e) => setPeriodoHasta(e.target.value)}
                  disabled={saving}
                  className={`${INPUT} ${fieldErrors.periodoHasta ? "border-red-400" : ""}`}
                />
                {fieldErrors.periodoHasta && (
                  <p className="mt-1 text-xs font-medium text-red-600">
                    {fieldErrors.periodoHasta}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="liq-comision" className={LABEL}>
                Comisión (%)
              </label>
              <input
                id="liq-comision"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={comisionPct}
                onChange={(e) => setComisionPct(e.target.value)}
                disabled={saving}
                className={`${INPUT} ${fieldErrors.comisionPct ? "border-red-400" : ""}`}
              />
              {fieldErrors.comisionPct && (
                <p className="mt-1 text-xs font-medium text-red-600">
                  {fieldErrors.comisionPct}
                </p>
              )}
            </div>

            <ConceptosLiquidacionLineasEditor
              getToken={getToken}
              lineas={conceptosLineas}
              onChange={setConceptosLineas}
              disabled={saving || lineasLoading}
            />
          </>
        ) : (
          <p className="text-sm text-vialto-steel">
            Los montos y el período de una liquidación emitida no se pueden
            modificar. Podés actualizar el comprobante adjunto.
          </p>
        )}

        {showComprobante && (
          <ComprobanteAdjuntoField
            file={comprobanteFile}
            existingUrl={comprobanteUrl}
            onFileChange={(file) => {
              setComprobanteFile(file);
              if (file) setComprobanteUrl(null);
            }}
            onClearExisting={() => {
              setComprobanteUrl(null);
              setComprobanteFile(null);
            }}
            disabled={saving}
            label="Comprobante"
          />
        )}

        {error && (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}
      </form>
    </ViewModalShell>
  );
}
