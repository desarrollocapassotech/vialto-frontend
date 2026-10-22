import { useAuth } from '@clerk/clerk-react';
import { useState, type FormEvent } from 'react';
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
} from '@/components/ui/ViewModalShell';
import { fechaDiaYmd } from '@/lib/fmtDateUtc';
import { friendlyError } from '@/lib/friendlyError';
import { actualizarComprobanteMovimiento, type MovimientoCc } from '@/lib/cuentaCorriente';
import { ErrorPieModal } from '@/components/shared/ErrorPieModal';
import { ComprobanteAdjuntoField } from '@/components/shared/ComprobanteAdjuntoField';
import { uploadComprobante } from '@/lib/comprobanteUpload';
import { useConfirmarDescarte } from '@/hooks/useConfirmarDescarte';

const inputClass = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';
const labelClass = 'block text-xs uppercase tracking-wider text-vialto-steel mb-1';

type Props = {
  movimiento: MovimientoCc;
  onClose: () => void;
  onDone: () => void;
};

/**
 * Carga o corrige el N° de comprobante y el vencimiento de un movimiento: una factura de
 * cliente (se guarda en la factura; el número solo sin ARCA), la factura del proveedor en
 * una liquidación (el número solo sin CVLP; se guarda en la liquidación) o una
 * venta/compra manual.
 */
export function ComprobanteCcModal({ movimiento, onClose, onDone }: Props) {
  const { getToken } = useAuth();
  const numeroEditable = !!movimiento.comprobanteEditable;
  const vencimientoEditable = !!movimiento.vencimientoEditable;
  const [numero, setNumero] = useState(movimiento.numeroComprobante ?? '');
  const [vencimiento, setVencimiento] = useState(fechaDiaYmd(movimiento.fechaVencimiento) ?? '');
  const [saving, setSaving] = useState(false);
  const descarte = useConfirmarDescarte(onClose);
  const [error, setError] = useState<string | null>(null);
  const esLiquidacion = movimiento.origen === 'liquidacion';
  const esFactura = movimiento.origen === 'factura';
  // Archivo: igual que "Adjuntar comprobante" de Facturas/Liquidaciones (sin ARCA). Se
  // guarda en la factura/liquidación; una venta/compra manual no tiene dónde guardarlo.
  const archivoEditable =
    numeroEditable &&
    ((esFactura && !!movimiento.facturaId) || (esLiquidacion && !!movimiento.liquidacionId));
  const urlGuardada =
    (esFactura
      ? movimiento.facturaComprobantes?.comprobanteUrl
      : movimiento.liquidacionComprobantes?.comprobanteUrl
    )?.trim() || null;
  const [file, setFile] = useState<File | null>(null);
  const [quitarGuardado, setQuitarGuardado] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let comprobanteUrl: string | null | undefined;
      if (archivoEditable && file) {
        comprobanteUrl = await uploadComprobante(
          () => getToken(),
          file,
          esFactura ? 'facturacion' : 'integracion-arca',
        );
      } else if (archivoEditable && quitarGuardado) {
        comprobanteUrl = null;
      }
      await actualizarComprobanteMovimiento(() => getToken(), movimiento.id, {
        ...(numeroEditable ? { numeroComprobante: numero.trim() || null } : {}),
        ...(vencimientoEditable ? { fechaVencimiento: vencimiento || null } : {}),
        ...(comprobanteUrl !== undefined ? { comprobanteUrl } : {}),
      });
      onDone();
      onClose();
    } catch (err) {
      setError(friendlyError(err, 'cuentaCorriente'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ViewModalShell
      title={`Comprobante — ${movimiento.concepto}`}
      onClose={descarte.solicitarCierre}
      descarte={descarte}
      footer={
        <>
          <ErrorPieModal error={error} />
          <button type="button" className={viewModalBtnGhost} onClick={descarte.solicitarCierre}>
            Cancelar
          </button>
          <button
            type="submit"
            form="comprobante-cc-form"
            className={viewModalBtnPrimary}
            disabled={saving}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </>
      }
    >
      <form id="comprobante-cc-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass} htmlFor="cc-numero-comprobante">
            {esLiquidacion
              ? 'N° de factura del proveedor'
              : esFactura
                ? 'N° de factura'
                : 'N° de comprobante'}
          </label>
          {numeroEditable ? (
            <>
              <input
                id="cc-numero-comprobante"
                type="text"
                maxLength={64}
                className={inputClass}
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="Ej. 0001-00001234"
                required={esFactura}
                autoFocus
              />
              {esLiquidacion && (
                <p className="mt-1 text-xs text-vialto-steel">
                  Se guarda en la liquidación: también se ve y se puede editar desde Liquidaciones.
                </p>
              )}
            </>
          ) : (
            <p id="cc-numero-comprobante" className="text-sm text-vialto-charcoal">
              {movimiento.numeroComprobante ?? '—'}
              <span className="block text-xs text-vialto-steel">
                {movimiento.numeroComprobante
                  ? 'Es el número del comprobante emitido con ARCA: no se modifica.'
                  : 'Lo asigna ARCA al emitir el comprobante.'}
              </span>
            </p>
          )}
        </div>

        {archivoEditable && (
          <ComprobanteAdjuntoField
            file={file}
            existingUrl={quitarGuardado ? null : urlGuardada}
            onFileChange={setFile}
            onClearExisting={() => setQuitarGuardado(true)}
            disabled={saving}
            label="Archivo"
          />
        )}

        {vencimientoEditable && (
          <div>
            <label className={labelClass} htmlFor="cc-vencimiento">
              Vencimiento
            </label>
            <input
              id="cc-vencimiento"
              type="date"
              className={inputClass}
              value={vencimiento}
              onChange={(e) => setVencimiento(e.target.value)}
            />
          </div>
        )}

        {esFactura && (
          <p className="text-xs text-vialto-steel">
            Se guarda en la factura: también se ve y se puede editar desde Facturas.
          </p>
        )}

      </form>
    </ViewModalShell>
  );
}
