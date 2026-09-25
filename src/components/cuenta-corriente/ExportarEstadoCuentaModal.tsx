import { useAuth } from '@clerk/clerk-react';
import { useState, type FormEvent } from 'react';
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
} from '@/components/ui/ViewModalShell';
import { friendlyError } from '@/lib/friendlyError';
import {
  descargarEstadoCuentaPdf,
  fetchExportarMovimientos,
  type TipoContraparte,
} from '@/lib/cuentaCorriente';
import { generarEstadoCuentaExcel } from '@/lib/cuentaCorrienteExcelExport';

const inputClass = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';
const labelClass = 'block text-xs uppercase tracking-wider text-vialto-steel mb-1';

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function hace90DiasISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().slice(0, 10);
}

type Props = {
  tipoContraparte: TipoContraparte;
  contraparteId: string;
  contraparteNombre: string;
  formato: 'pdf' | 'excel';
  onClose: () => void;
};

export function ExportarEstadoCuentaModal({
  tipoContraparte,
  contraparteId,
  contraparteNombre,
  formato,
  onClose,
}: Props) {
  const { getToken } = useAuth();
  const [desde, setDesde] = useState(hace90DiasISO());
  const [hasta, setHasta] = useState(hoyISO());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (desde > hasta) {
      setError('La fecha de inicio no puede ser mayor a la de fin.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const contraparteParams =
        tipoContraparte === 'cliente' ? { clienteId: contraparteId } : { proveedorId: contraparteId };
      if (formato === 'pdf') {
        await descargarEstadoCuentaPdf(() => getToken(), { ...contraparteParams, desde, hasta });
      } else {
        const data = await fetchExportarMovimientos(() => getToken(), { ...contraparteParams, desde, hasta });
        generarEstadoCuentaExcel(data, tipoContraparte, contraparteNombre);
      }
      onClose();
    } catch (err) {
      setError(friendlyError(err, 'cuentaCorriente'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ViewModalShell
      title={`Estado de cuenta — ${contraparteNombre}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={viewModalBtnGhost} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            form="exportar-estado-cuenta-form"
            className={viewModalBtnPrimary}
            disabled={saving}
          >
            {saving ? 'Generando…' : formato === 'pdf' ? 'Descargar PDF' : 'Descargar Excel'}
          </button>
        </>
      }
    >
      <form id="exportar-estado-cuenta-form" onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-vialto-steel">
          Elegí el período a incluir en el {formato === 'pdf' ? 'PDF' : 'Excel'} (detalle de movimientos y saldo).
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="ec-desde">
              Desde
            </label>
            <input
              id="ec-desde"
              type="date"
              className={inputClass}
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="ec-hasta">
              Hasta
            </label>
            <input
              id="ec-hasta"
              type="date"
              className={inputClass}
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              required
            />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </p>
        )}
      </form>
    </ViewModalShell>
  );
}
