import { useRef, useState } from "react";
import {
  numeroActualComprobanteManual,
  useAutocompletarNumeroComprobante,
} from "@/hooks/useAutocompletarNumeroComprobante";
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
} from "@/components/ui/ViewModalShell";
import { CrudFieldLabel, CrudInput } from "@/components/crud/CrudFields";
import { ComprobanteAdjuntoField } from "@/components/shared/ComprobanteAdjuntoField";
import { ErrorPieModal } from "@/components/shared/ErrorPieModal";
import { useConfirmarDescarte } from "@/hooks/useConfirmarDescarte";
import { ComprobanteManualFields } from "@/components/shared/ComprobanteManualFields";
import {
  numeroDesdeComprobanteManual,
  validarComprobanteManual,
  type ComprobanteManualDraft,
} from "@/lib/comprobanteManual";

/**
 * "Adjuntar comprobante" de una factura o liquidación sin ARCA que todavía no tiene
 * archivo: número de comprobante + archivo, en un solo paso. El host sube el archivo y
 * guarda (`onGuardar`); este modal solo junta los datos y muestra el error en el pie.
 * Con `comprobanteManual` (factura/liquidación manual de una empresa con ARCA) el número
 * se carga como tipo + punto de venta + número (+ fecha), obligatorios.
 */
export function AdjuntarComprobanteModal({
  titulo,
  numeroLabel = "Número de comprobante",
  numeroInicial,
  comprobanteManual,
  onClose,
  onGuardar,
}: {
  /** Ej. "Factura 0001-00000123" o el transportista de la liquidación. */
  titulo: string;
  numeroLabel?: string;
  numeroInicial?: string | null;
  comprobanteManual?: { inicial: ComprobanteManualDraft; conFecha?: boolean };
  onClose: () => void;
  onGuardar: (datos: {
    numero: string;
    file: File;
    comprobante?: ComprobanteManualDraft;
  }) => Promise<void>;
}) {
  const [numero, setNumero] = useState(numeroInicial ?? "");
  const [comprobante, setComprobante] = useState(comprobanteManual?.inicial);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const descarte = useConfirmarDescarte(onClose);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Factura de ARCA adjunta: completa el número leyéndolo del archivo (estado vigente en un
  // ref porque la lectura es async).
  const autocompletarNumero = useAutocompletarNumeroComprobante();
  const estadoRef = useRef({ numero, comprobante, file });
  estadoRef.current = { numero, comprobante, file };

  function autocompletarDesde(f: File) {
    void autocompletarNumero(f, {
      vigente: () => estadoRef.current.file === f,
      numeroActual: () => {
        const c = estadoRef.current.comprobante;
        return c
          ? numeroActualComprobanteManual(c, numeroDesdeComprobanteManual(c))
          : estadoRef.current.numero;
      },
      aplicar: (leido, nuevo) => {
        const c = estadoRef.current.comprobante;
        if (c) {
          setComprobante({
            ...c,
            cbteTipo: String(leido.cbteTipo),
            ptoVenta: String(leido.ptoVenta),
            cbteNro: String(leido.cbteNro),
            fecha: c.fecha || (comprobanteManual?.conFecha ? leido.fecha ?? "" : ""),
          });
        } else {
          setNumero(nuevo);
        }
        setFieldErrors({});
      },
    });
  }

  async function guardar() {
    const errs: Record<string, string> = comprobante
      ? { ...validarComprobanteManual(comprobante, Boolean(comprobanteManual?.conFecha)) }
      : {};
    if (!file) errs.file = "Adjuntá el archivo del comprobante.";
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setError(null);
    setSaving(true);
    try {
      await onGuardar(
        comprobante
          ? { numero: numeroDesdeComprobanteManual(comprobante), file: file!, comprobante }
          : { numero: numero.trim(), file: file! },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo adjuntar el comprobante.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ViewModalShell
      title="Adjuntar comprobante"
      // Con fecha son 4 campos en una fila: en el ancho por defecto los títulos se parten.
      // Archivo + número en una fila: más ancho; con los campos por separado (y fecha), más todavía.
      maxWidthClass={comprobanteManual ? "sm:max-w-4xl" : "sm:max-w-2xl"}
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
        {/* Archivo a la izquierda del número, como en Nueva factura. */}
        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
        <div className="min-w-0 sm:max-w-[14rem]">
          <ComprobanteAdjuntoField
            file={file}
            onFileChange={(f) => {
              setFile(f);
              if (f) {
                setFieldErrors({});
                autocompletarDesde(f);
              }
            }}
            disabled={saving}
            label={
              <>
                Archivo <span className="text-red-500">*</span>
              </>
            }
          />
        </div>
        {comprobante ? (
          <ComprobanteManualFields
            value={comprobante}
            onChange={setComprobante}
            errores={fieldErrors}
            conFecha={comprobanteManual?.conFecha}
            disabled={saving}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
          />
        ) : (
          <label className="grid gap-1.5">
            <CrudFieldLabel>{numeroLabel}</CrudFieldLabel>
            <CrudInput
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              disabled={saving}
              placeholder="Ej. 0001-00000123"
            />
          </label>
        )}
        </div>
      </div>
    </ViewModalShell>
  );
}
