import {
  ChoferSearchSelect,
  DireccionEntregaSearchSelect,
} from '@/components/forms/MaestroSearchSelects';
import { ViajeFechaHoraFields } from '@/components/viajes/ViajeFechaHoraFields';
import { CrudFieldError } from '@/components/crud/CrudFieldError';
import { CrudFormErrorAlert } from '@/components/crud/CrudFormErrorAlert';
import { Spinner } from '@/components/ui/Spinner';
import type { StockDocumentoExternoModo } from '@/lib/stockDocumentoExterno';
import type { Chofer, DireccionEntrega } from '@/types/api';

const INPUT = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';
const LABEL = 'text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel';

type FechaHoraPatch = {
  fechaCarga?: string;
  horaCarga?: string;
  fechaDescarga?: string;
  horaDescarga?: string;
};

export function EgresoWizardStep2({
  fechaMov,
  horaMov,
  fechaMovError,
  onFechaHoraPatch,
  choferes,
  choferesLoading,
  choferId,
  onChoferIdChange,
  onNuevoChofer,
  destinatario,
  onDestinatarioChange,
  direccionesEntrega,
  direccionesEntregaLoading,
  direccionEntregaId,
  onDireccionEntregaChange,
  onNuevaDireccionEntrega,
  documentoExternoModo,
  onDocumentoExternoModoChange,
  documentoExternoNumero,
  onDocumentoExternoNumeroChange,
  documentoExternoError,
  observaciones,
  onObservacionesChange,
  clienteNombre,
  depositoNombre,
  formError,
  continuarLabel = 'Continuar →',
  continuarLoading = false,
  onVolver,
  onContinuar,
}: {
  fechaMov: string;
  horaMov: string;
  fechaMovError: string | null;
  onFechaHoraPatch: (patch: FechaHoraPatch) => void;
  choferes: Chofer[];
  choferesLoading?: boolean;
  choferId: string;
  onChoferIdChange: (id: string) => void;
  onNuevoChofer?: () => void;
  destinatario: string;
  onDestinatarioChange: (v: string) => void;
  direccionesEntrega: DireccionEntrega[];
  direccionesEntregaLoading?: boolean;
  direccionEntregaId: string;
  onDireccionEntregaChange: (id: string) => void;
  onNuevaDireccionEntrega?: () => void;
  documentoExternoModo: StockDocumentoExternoModo | '';
  onDocumentoExternoModoChange: (modo: StockDocumentoExternoModo) => void;
  documentoExternoNumero: string;
  onDocumentoExternoNumeroChange: (v: string) => void;
  documentoExternoError?: string | null;
  observaciones: string;
  onObservacionesChange: (v: string) => void;
  clienteNombre: string;
  depositoNombre: string;
  formError?: string | null;
  continuarLabel?: string;
  continuarLoading?: boolean;
  onVolver: () => void;
  onContinuar: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="bg-vialto-mist/40 border border-black/10 rounded-lg px-4 py-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span>
          <span className="text-vialto-steel text-xs uppercase tracking-[0.08em] mr-1.5">Cliente</span>
          <span className="font-medium text-vialto-charcoal">{clienteNombre || '—'}</span>
        </span>
        <span>
          <span className="text-vialto-steel text-xs uppercase tracking-[0.08em] mr-1.5">Depósito</span>
          <span className="font-medium text-vialto-charcoal">{depositoNombre || '—'}</span>
        </span>
      </div>

      <div className="bg-white rounded-lg border border-black/10 p-6 space-y-5">
        <p className="text-sm text-vialto-steel">
          Completá la fecha y los datos de entrega.
        </p>

        <ViajeFechaHoraFields
          mode="cargaOnly"
          fechaCarga={fechaMov}
          horaCarga={horaMov}
          fechaDescarga=""
          horaDescarga=""
          onPatch={onFechaHoraPatch}
          labelClassName={LABEL}
          inputClassName={INPUT}
          errorFechaCarga={fechaMovError}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="space-y-1">
            <label className={LABEL}>Conductor</label>
            <ChoferSearchSelect
              choferes={choferes}
              value={choferId}
              onChange={onChoferIdChange}
              loading={choferesLoading}
              allowEmptyValue
              emptyListChoiceLabel="Sin conductor"
              placeholderCerrado="Sin conductor"
              inputClassName={INPUT}
              aria-label="Conductor del egreso"
              onNuevo={onNuevoChofer}
            />
          </div>

          <div className="space-y-1">
            <label className={LABEL}>Destinatario</label>
            <input
              type="text"
              value={destinatario}
              onChange={(e) => onDestinatarioChange(e.target.value)}
              className={INPUT}
              placeholder="Ej: Luvi SRL, Myca SRL…"
              maxLength={200}
            />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <p className={LABEL}>
              Nº documento externo <span className="text-red-500">*</span>
            </p>
            <p className="text-xs text-vialto-steel">
              Pedido del cliente, nota de despacho u otro comprobante que acompaña la entrega.
            </p>
            <div className="flex flex-wrap gap-4 pt-1">
              <label className="inline-flex items-center gap-2 text-sm text-vialto-charcoal cursor-pointer">
                <input
                  type="radio"
                  name="documentoExternoModo"
                  checked={documentoExternoModo === 'numero'}
                  onChange={() => onDocumentoExternoModoChange('numero')}
                  className="accent-vialto-charcoal"
                />
                Ingresar número
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-vialto-charcoal cursor-pointer">
                <input
                  type="radio"
                  name="documentoExternoModo"
                  checked={documentoExternoModo === 'no_tiene'}
                  onChange={() => onDocumentoExternoModoChange('no_tiene')}
                  className="accent-vialto-charcoal"
                />
                No tiene
              </label>
            </div>
            {documentoExternoModo === 'numero' && (
              <input
                type="text"
                value={documentoExternoNumero}
                onChange={(e) => onDocumentoExternoNumeroChange(e.target.value)}
                className={`${INPUT} ${documentoExternoError ? 'border-red-400' : ''}`}
                placeholder="Ej: PD-10452, ND 8831…"
                maxLength={100}
                autoFocus
              />
            )}
            <CrudFieldError message={documentoExternoError} />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <label className={LABEL}>Dirección / Ruta de entrega</label>
            <DireccionEntregaSearchSelect
              direcciones={direccionesEntrega}
              value={direccionEntregaId}
              onChange={onDireccionEntregaChange}
              loading={direccionesEntregaLoading}
              inputClassName={INPUT}
              allowEmptyValue
              emptyListChoiceLabel="Sin dirección"
              onNuevo={onNuevaDireccionEntrega}
            />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <label className={LABEL}>Observaciones</label>
            <textarea
              value={observaciones}
              onChange={(e) => onObservacionesChange(e.target.value)}
              rows={2}
              className="w-full border border-black/15 bg-white px-2 py-1.5 text-sm resize-none"
              placeholder="Notas internas…"
            />
          </div>
        </div>
      </div>

      <CrudFormErrorAlert message={formError} />

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onVolver}
          disabled={continuarLoading}
          className="inline-flex items-center gap-2 px-4 py-2 border border-black/20 bg-white text-sm font-medium text-vialto-charcoal rounded hover:bg-vialto-mist/60 transition-colors disabled:opacity-50"
        >
          ← Volver
        </button>
        <button
          type="button"
          onClick={onContinuar}
          disabled={continuarLoading}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-vialto-fire text-white text-sm font-semibold rounded hover:bg-vialto-fire/90 transition-colors disabled:opacity-50"
        >
          {continuarLoading && <Spinner className="h-4 w-4" />}
          {continuarLabel}
        </button>
      </div>
    </div>
  );
}
