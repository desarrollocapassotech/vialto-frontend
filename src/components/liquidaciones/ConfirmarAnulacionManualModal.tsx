import { useEffect, useId, useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { ErrorPieModal } from "@/components/shared/ErrorPieModal";
import { ComprobanteAdjuntoField } from "@/components/shared/ComprobanteAdjuntoField";
import { modalOverlayClass } from "@/lib/modalLayers";
import { useConfirmarDescarte } from "@/hooks/useConfirmarDescarte";
import { uploadComprobante } from "@/lib/comprobanteUpload";
import { hoyArgentinaIso } from "@/lib/facturaFechaEmision";

const btnGhost =
  "inline-flex min-h-11 items-center text-xs uppercase tracking-wider px-3 py-2 border border-black/20 hover:bg-vialto-mist disabled:opacity-50 disabled:pointer-events-none md:min-h-0 md:py-1.5";

type Props = {
  open: boolean;
  busy?: boolean;
  /** Error de API al confirmar (se muestra en el modal). */
  error?: string | null;
  getToken: () => Promise<string | null>;
  /** Solo en vistas superadmin (embedded), para pegarle a /api/platform/integracion-arca/upload-comprobante. */
  tenantId?: string;
  onConfirm: (args: {
    motivo: string;
    comprobanteUrl: string;
    ptoVenta: number;
    cbteNro: number;
    fecha: string;
  }) => void | Promise<void>;
  onCancel: () => void;
};

type FieldErrors = {
  motivo?: string;
  file?: string;
  ptoVenta?: string;
  cbteNro?: string;
  fecha?: string;
};

const inputClass = (conError: boolean) =>
  `h-10 w-full rounded border bg-white px-3 text-sm text-vialto-charcoal focus:outline-none focus:ring-2 focus:ring-vialto-fire/35 disabled:opacity-50 ${
    conError ? "border-red-400" : "border-black/15"
  }`;

const labelClass =
  "text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.18em] text-vialto-steel";

/**
 * Paso 2 de la anulación manual del CVLP (060): comprobante pre-impreso adjunto (PDF o
 * foto) + motivo + punto de venta, número y fecha del pre-impreso (el 060 en negativo, que
 * va al Libro IVA Compras). No emite nada a ARCA — solo registra el respaldo del usuario.
 */
export function ConfirmarAnulacionManualModal({
  open,
  busy = false,
  error = null,
  getToken,
  tenantId,
  onConfirm,
  onCancel,
}: Props) {
  const titleId = useId();
  const descId = useId();
  const [motivo, setMotivo] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [ptoVenta, setPtoVenta] = useState("");
  const [cbteNro, setCbteNro] = useState("");
  const [fecha, setFecha] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMotivo("");
    setFile(null);
    setPtoVenta("");
    setCbteNro("");
    setFecha(hoyArgentinaIso());
    setFieldErrors({});
    setUploadError(null);
  }, [open]);

  const isBusy = busy || uploading;
  const { solicitarCierre, dialogo } = useConfirmarDescarte(onCancel, open);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !isBusy) {
        e.preventDefault();
        solicitarCierre();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isBusy, solicitarCierre]);

  if (!open) return null;

  async function handleConfirm() {
    const trimmed = motivo.trim();
    const errs: FieldErrors = {};
    if (!trimmed) errs.motivo = "Ingresá el motivo de anulación.";
    if (!file) errs.file = "Adjuntá el comprobante pre-impreso (PDF o foto).";
    if (!(Number(ptoVenta) > 0)) errs.ptoVenta = "Ingresá el punto de venta del pre-impreso.";
    if (!(Number(cbteNro) > 0)) errs.cbteNro = "Ingresá el número del pre-impreso.";
    if (!fecha) errs.fecha = "Ingresá la fecha del pre-impreso.";
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setUploadError(null);
    setUploading(true);
    try {
      const comprobanteUrl = await uploadComprobante(
        getToken,
        file as File,
        "integracion-arca",
        tenantId,
      );
      setUploading(false);
      void onConfirm({
        motivo: trimmed,
        comprobanteUrl,
        ptoVenta: Number(ptoVenta),
        cbteNro: Number(cbteNro),
        fecha,
      });
    } catch (e) {
      setUploading(false);
      setUploadError(
        e instanceof Error ? e.message : "No se pudo subir el comprobante.",
      );
    }
  }

  return (
    <div
      className={modalOverlayClass.replace("z-50", "z-[120]")}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full max-w-md rounded-t-xl border border-black/15 bg-white p-5 shadow-lg sm:rounded"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-sm font-semibold text-vialto-charcoal">
          Confirmar anulación
        </h2>
        <p id={descId} className="mt-2 text-sm text-vialto-steel">
          Adjuntá el comprobante pre-impreso con el que se anuló este CVLP fuera del
          sistema e indicá su punto de venta, número y fecha (va al Libro IVA Compras con
          los importes en negativo). No se emite nada a ARCA — el CVLP original se conserva.
        </p>

        <label className="mt-4 grid gap-1.5">
          <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.18em] text-vialto-steel">
            Motivo de anulación <span className="text-red-500">*</span>
          </span>
          <textarea
            value={motivo}
            disabled={isBusy}
            rows={3}
            maxLength={2000}
            placeholder="Indicá el motivo…"
            onChange={(e) => {
              setMotivo(e.target.value);
              if (fieldErrors.motivo) {
                setFieldErrors((p) => ({ ...p, motivo: undefined }));
              }
            }}
            className={`w-full rounded border bg-white px-3 py-2 text-sm text-vialto-charcoal focus:outline-none focus:ring-2 focus:ring-vialto-fire/35 disabled:opacity-50 ${
              fieldErrors.motivo ? "border-red-400" : "border-black/15"
            }`}
          />
        </label>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="grid gap-1.5">
            <span className={labelClass}>
              Punto de venta <span className="text-red-500">*</span>
            </span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              value={ptoVenta}
              disabled={isBusy}
              placeholder="0001"
              onChange={(e) => {
                setPtoVenta(e.target.value.replace(/\D/g, ""));
                if (fieldErrors.ptoVenta) setFieldErrors((p) => ({ ...p, ptoVenta: undefined }));
              }}
              className={inputClass(!!fieldErrors.ptoVenta)}
            />
          </label>
          <label className="grid gap-1.5">
            <span className={labelClass}>
              Número <span className="text-red-500">*</span>
            </span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={8}
              value={cbteNro}
              disabled={isBusy}
              placeholder="00000123"
              onChange={(e) => {
                setCbteNro(e.target.value.replace(/\D/g, ""));
                if (fieldErrors.cbteNro) setFieldErrors((p) => ({ ...p, cbteNro: undefined }));
              }}
              className={inputClass(!!fieldErrors.cbteNro)}
            />
          </label>
          <label className="grid gap-1.5">
            <span className={labelClass}>
              Fecha <span className="text-red-500">*</span>
            </span>
            <input
              type="date"
              value={fecha}
              disabled={isBusy}
              onChange={(e) => {
                setFecha(e.target.value);
                if (fieldErrors.fecha) setFieldErrors((p) => ({ ...p, fecha: undefined }));
              }}
              className={inputClass(!!fieldErrors.fecha)}
            />
          </label>
        </div>

        <div className="mt-4">
          <ComprobanteAdjuntoField
            file={file}
            onFileChange={(f) => {
              setFile(f);
              if (fieldErrors.file) {
                setFieldErrors((p) => ({ ...p, file: undefined }));
              }
            }}
            disabled={isBusy}
            label="Comprobante pre-impreso"
          />
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <ErrorPieModal error={uploadError ?? error} fieldErrors={fieldErrors} />
          <button type="button" disabled={isBusy} onClick={solicitarCierre} className={btnGhost}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={handleConfirm}
            className={`inline-flex items-center gap-2 ${btnGhost} border-red-300 bg-white text-red-800 hover:bg-red-50`}
          >
            {isBusy && <Spinner className="h-3.5 w-3.5" />}
            {isBusy ? "Procesando…" : "Confirmar anulación"}
          </button>
        </div>
      </div>
      {dialogo}
    </div>
  );
}
