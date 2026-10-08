import { useEffect, useId } from "react";
import { AlertTriangle } from "lucide-react";
import {
  CompletarDatosFiscalesInline,
  type CompletarDatosFiscalesInitial,
} from "@/components/shared/CompletarDatosFiscalesInline";
import { useHiddenFiscalFields, formatMissingFiscalField } from "@/hooks/useHiddenFiscalFields";
import { MODAL_Z_STACKED } from "@/lib/modalLayers";
import { condicionIvaLabel } from "@/lib/arcaCbteTipo";
import type { PadronValidacionResultado } from "@/hooks/useValidacionPadronRegistro";
import type { Cliente, Transportista } from "@/types/api";

type Entidad = "cliente" | "transportista";

const ENTIDAD_LABEL: Record<Entidad, string> = {
  cliente: "cliente",
  transportista: "transportista",
};

/**
 * Se abre sobre "Nueva factura" / "Nueva liquidación" cuando el cliente o transportista
 * elegido no tiene los datos fiscales que ARCA exige para emitir, o cuando el padrón de
 * ARCA informa otros datos (`padron`). Permite completarlos/corregirlos ahí mismo; si
 * alguno es un campo oculto para la empresa, solo informa.
 */
export function DatosFiscalesFaltantesModal({
  open,
  entidad,
  id,
  nombre,
  initial,
  missingFields,
  padron,
  accion,
  tenantId,
  getToken,
  onSaved,
  onClose,
}: {
  open: boolean;
  entidad: Entidad;
  id: string;
  nombre: string;
  initial: CompletarDatosFiscalesInitial;
  /** Campos faltantes de esta entidad, con prefijo "Cliente: ..." / "Transportista: ...". */
  missingFields: string[];
  /**
   * Resultado de validar el registro contra el padrón de ARCA, si hay algo para mostrar.
   * Con "diferencias", el caller ya precarga `initial` con lo de ARCA.
   */
  padron?: Extract<PadronValidacionResultado, { resultado: "diferencias" | "rechazado" }> | null;
  /** Qué se quiere hacer: "emitir una factura", "emitir una liquidación"... */
  accion: string;
  tenantId?: string;
  getToken: () => Promise<string | null>;
  onSaved: (updated: Cliente | Transportista) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const missingHiddenFields = useHiddenFiscalFields(missingFields);
  const hayOcultos = missingHiddenFields.length > 0;
  const label = ENTIDAD_LABEL[entidad];

  // Escape cierra solo este modal: se corta en captura para que no llegue al de abajo.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  // Sin portal a propósito: se dibuja en la misma capa (stacking context) que el modal que
  // lo abre, así queda encima de él en cualquier pantalla. Con portal a <body> quedaba
  // DETRÁS en la grilla de Viajes, que mete sus modales en un contenedor con zIndex 9999.
  return (
    <div
      className={`fixed inset-0 ${MODAL_Z_STACKED} flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4`}
      role="presentation"
      // stopPropagation: el click no tiene que llegar al overlay del modal de abajo.
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[95dvh] w-full flex-col overflow-hidden rounded-t-xl border border-black/10 bg-white shadow-lg sm:max-h-[90vh] sm:max-w-3xl sm:rounded"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-black/10 px-5 py-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold text-vialto-charcoal">
              {missingFields.length > 0
                ? `Faltan datos del ${label}`
                : `Revisá los datos del ${label}`}
            </h2>
            {missingFields.length > 0 && (
              <>
                <p className="mt-1 text-xs text-vialto-steel">
                  Para {accion} a ARCA, <strong className="text-vialto-charcoal">{nombre}</strong>{" "}
                  necesita tener cargados:
                </p>
                <ul className="mt-1.5 list-disc pl-4 text-xs text-vialto-charcoal">
                  {missingFields.map((f) => (
                    <li key={f}>{formatMissingFiscalField(f)}</li>
                  ))}
                </ul>
              </>
            )}
            {padron?.resultado === "diferencias" && (
              <div className="mt-2 rounded border border-sky-300/60 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                <p className="font-medium">
                  ARCA informa otros datos para el CUIT {padron.padron.cuit}. Ya los precargamos:
                  revisalos y guardá.
                </p>
                <ul className="mt-1 list-disc pl-4">
                  {padron.diferencias.includes("condicionIva") && (
                    <li>
                      Condición frente al IVA: {condicionIvaLabel(padron.padron.condicionIva)}
                    </li>
                  )}
                  {padron.diferencias.includes("domicilio") && (
                    <li>Domicilio: {padron.padron.domicilio}</li>
                  )}
                </ul>
              </div>
            )}
            {padron?.resultado === "rechazado" && (
              <p
                className="mt-2 rounded border border-red-500/40 bg-red-50 px-3 py-2 text-xs text-red-900"
                role="alert"
              >
                {padron.padron.estado === "inactivo"
                  ? `ARCA informa que el CUIT ${padron.padron.cuit} no está activo.`
                  : `El CUIT ${padron.padron.cuit} no figura en el padrón de ARCA.`}{" "}
                Revisá el CUIT antes de {accion}.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-vialto-steel hover:bg-vialto-mist"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {hayOcultos ? (
            <div className="space-y-3">
              <p
                className="rounded border border-red-500/40 bg-red-50 px-3 py-2 text-xs text-red-900"
                role="alert"
              >
                Hay campos ocultos para tu empresa que no se pueden editar desde acá. Contactá al
                administrador para habilitarlos.
              </p>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-8 px-4 bg-vialto-charcoal text-white text-xs uppercase tracking-wider hover:bg-vialto-charcoal/90"
                >
                  Entendido
                </button>
              </div>
            </div>
          ) : (
            <CompletarDatosFiscalesInline
              entidad={entidad}
              id={id}
              tenantId={tenantId}
              getToken={getToken}
              forceArcaFields
              initial={initial}
              onCancel={onClose}
              cancelLabel="Completar después"
              saveLabel="Guardar"
              onSaved={(updated) => {
                onSaved(updated);
                onClose();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
