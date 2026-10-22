import { useState } from "react";
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
} from "@/components/ui/ViewModalShell";
import { CrudFieldLabel, CrudInput } from "@/components/crud/CrudFields";
import { ComprobanteAdjuntoField } from "@/components/shared/ComprobanteAdjuntoField";
import { ErrorPieModal } from "@/components/shared/ErrorPieModal";
import { useConfirmarDescarte } from "@/hooks/useConfirmarDescarte";

/**
 * "Adjuntar comprobante" de una factura o liquidación sin ARCA que todavía no tiene
 * archivo: número de comprobante + archivo, en un solo paso. El host sube el archivo y
 * guarda (`onGuardar`); este modal solo junta los datos y muestra el error en el pie.
 */
export function AdjuntarComprobanteModal({
  titulo,
  numeroLabel = "Número de comprobante",
  numeroInicial,
  onClose,
  onGuardar,
}: {
  /** Ej. "Factura 0001-00000123" o el transportista de la liquidación. */
  titulo: string;
  numeroLabel?: string;
  numeroInicial?: string | null;
  onClose: () => void;
  onGuardar: (datos: { numero: string; file: File }) => Promise<void>;
}) {
  const [numero, setNumero] = useState(numeroInicial ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const descarte = useConfirmarDescarte(onClose);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function guardar() {
    const errs: Record<string, string> = {};
    if (!file) errs.file = "Adjuntá el archivo del comprobante.";
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setError(null);
    setSaving(true);
    try {
      await onGuardar({ numero: numero.trim(), file: file! });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo adjuntar el comprobante.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ViewModalShell
      title="Adjuntar comprobante"
      onClose={saving ? () => {} : descarte.solicitarCierre}
      descarte={descarte}
      footer={
        <>
          <ErrorPieModal error={error} fieldErrors={fieldErrors} />
          <button
            type="button"
            onClick={descarte.solicitarCierre}
            disabled={saving}
            className={`${viewModalBtnGhost} disabled:opacity-50`}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void guardar()}
            disabled={saving}
            className={viewModalBtnPrimary}
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        <p className="text-sm text-vialto-steel">{titulo}</p>
        <label className="grid gap-1.5">
          <CrudFieldLabel>{numeroLabel}</CrudFieldLabel>
          <CrudInput
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            disabled={saving}
            placeholder="Ej. 0001-00000123"
          />
        </label>
        <ComprobanteAdjuntoField
          file={file}
          onFileChange={(f) => {
            setFile(f);
            if (f) setFieldErrors({});
          }}
          disabled={saving}
          label={
            <>
              Archivo <span className="text-red-500">*</span>
            </>
          }
        />
      </div>
    </ViewModalShell>
  );
}
