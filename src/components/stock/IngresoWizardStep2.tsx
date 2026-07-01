import { CrudFieldError } from '@/components/crud/CrudFieldError';
import { ViajeFechaHoraFields } from '@/components/viajes/ViajeFechaHoraFields';
import { FotosIngresoField } from './FotosIngresoField';

const INPUT = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';
const LABEL = 'text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel';

type FechaHoraPatch = {
  fechaCarga?: string;
  horaCarga?: string;
  fechaDescarga?: string;
  horaDescarga?: string;
};

export function IngresoWizardStep2({
  fechaMov,
  horaMov,
  fechaMovError,
  onFechaHoraPatch,
  observaciones,
  onObservacionesChange,
  numeroRemitoProveedor,
  onNumeroRemitoProveedorChange,
  fotoFiles,
  onFotosChange,
  onFotoPreview,
  fieldErrors,
  saving,
  clienteNombre,
  depositoNombre,
  onVolver,
  onContinuar,
}: {
  fechaMov: string;
  horaMov: string;
  fechaMovError: string | null;
  onFechaHoraPatch: (patch: FechaHoraPatch) => void;
  observaciones: string;
  onObservacionesChange: (v: string) => void;
  numeroRemitoProveedor: string;
  onNumeroRemitoProveedorChange: (v: string) => void;
  fotoFiles: File[];
  onFotosChange: (files: File[]) => void;
  onFotoPreview: (file: File) => void;
  fieldErrors: Record<string, string>;
  saving: boolean;
  clienteNombre: string;
  depositoNombre: string;
  onVolver: () => void;
  onContinuar: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Resumen paso 1 */}
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

      <div className="bg-white rounded-lg border border-black/10 p-6 space-y-6">
        <div>
          <p className="text-sm text-vialto-steel">
            Completá la fecha del ingreso y, si querés, agregá fotos y observaciones.
          </p>
        </div>

        <div className="space-y-1">
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
          <CrudFieldError message={fieldErrors.fechaMov} />
        </div>

        <div className="space-y-1">
          <label className={LABEL}>N° de remito del proveedor</label>
          <input
            type="text"
            value={numeroRemitoProveedor}
            onChange={(e) => onNumeroRemitoProveedorChange(e.target.value)}
            className={INPUT}
            placeholder="Opcional"
          />
        </div>

        <div className="space-y-1">
          <label className={LABEL}>Observaciones</label>
          <textarea
            value={observaciones}
            onChange={(e) => onObservacionesChange(e.target.value)}
            rows={3}
            className="w-full border border-black/15 bg-white px-2 py-1.5 text-sm resize-none"
            placeholder="Notas internas sobre este ingreso…"
          />
        </div>

        <FotosIngresoField
          files={fotoFiles}
          onChange={onFotosChange}
          onPreview={onFotoPreview}
          disabled={saving}
          error={fieldErrors.fotosUrls}
        />
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onVolver}
          className="inline-flex items-center gap-2 px-4 py-2 border border-black/20 bg-white text-sm font-medium text-vialto-charcoal rounded hover:bg-vialto-mist/60 transition-colors"
        >
          ← Volver
        </button>
        <button
          type="button"
          onClick={onContinuar}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-vialto-charcoal text-white text-sm font-semibold rounded hover:bg-vialto-charcoal/90 transition-colors"
        >
          Continuar →
        </button>
      </div>
    </div>
  );
}
