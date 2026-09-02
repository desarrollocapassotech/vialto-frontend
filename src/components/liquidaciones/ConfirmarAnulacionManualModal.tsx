import { useEffect, useId, useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { CrudFieldError } from "@/components/crud/CrudFieldError";
import { ComprobanteAdjuntoField } from "@/components/shared/ComprobanteAdjuntoField";
import { modalOverlayClass } from "@/lib/modalLayers";
import { uploadComprobante } from "@/lib/comprobanteUpload";

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
  onConfirm: (args: { motivo: string; comprobanteUrl: string }) => void | Promise<void>;
  onCancel: () => void;
};

/**
 * Paso 2 de la anulación manual del CVLP (060): comprobante pre-impreso adjunto (PDF o
 * foto) + motivo. No emite nada a ARCA — solo registra el respaldo del usuario.
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
  const [fieldErrors, setFieldErrors] = useState<{ motivo?: string; file?: string }>({});
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMotivo("");
    setFile(null);
    setFieldErrors({});
    setUploadError(null);
  }, [open]);

  const isBusy = busy || uploading;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !isBusy) {
        e.preventDefault();
        onCancel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isBusy, onCancel]);

  if (!open) return null;

  async function handleConfirm() {
    const trimmed = motivo.trim();
    const errs: { motivo?: string; file?: string } = {};
    if (!trimmed) errs.motivo = "Ingresá el motivo de anulación.";
    if (!file) errs.file = "Adjuntá el comprobante pre-impreso (PDF o foto).";
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
      void onConfirm({ motivo: trimmed, comprobanteUrl });
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
      onClick={() => {
        if (!isBusy) onCancel();
      }}
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
          sistema. No se emite nada a ARCA — el CVLP original se conserva.
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
          <CrudFieldError message={fieldErrors.motivo} />
        </label>

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
            error={fieldErrors.file}
          />
        </div>

        {(uploadError || error) && (
          <p role="alert" className="mt-3 text-sm font-medium text-red-600">
            {uploadError ?? error}
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" disabled={isBusy} onClick={onCancel} className={btnGhost}>
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
    </div>
  );
}
