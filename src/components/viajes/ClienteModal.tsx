import { useState } from 'react';
import { ApiError, apiJson } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { friendlyError } from '@/lib/friendlyError';
import { validateClienteForm } from '@/lib/clienteForm';
import { idFiscalPorPais, validarIdFiscal, condicionTributariaPorPais } from '@/lib/ciudades';
import { PaisUbicacionSelect } from '@/components/forms/PaisUbicacionSelect';
import type { PaisCodigo } from '@/lib/ciudades';
import type { Cliente } from '@/types/api';
import { modalQuickCreateOverlayClass } from '@/lib/modalLayers';

export function ClienteModal({
  getToken,
  onClose,
  onSaved,
  tenantId,
  stacked,
}: {
  getToken: () => Promise<string | null>;
  onClose: () => void;
  onSaved: (cliente: Cliente) => void;
  tenantId?: string;
  /** true cuando se abre sobre ViajeEditModal u otro modal z-[110] */
  stacked?: boolean;
}) {
  const [nombre, setNombre] = useState('');
  const [pais, setPais] = useState<PaisCodigo | ''>('');
  const [idFiscal, setIdFiscal] = useState('');
  const [condicionIva, setCondicionIva] = useState<number | null>(null);
  const [condicionTributaria, setCondicionTributaria] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function handlePaisChange(newPais: PaisCodigo | '') {
    setPais(newPais);
    setCondicionIva(null);
    setCondicionTributaria('');
  }

  const errorFiscal = idFiscal.trim() ? validarIdFiscal(pais, idFiscal.trim()) : null;
  const condInfo = condicionTributariaPorPais(pais);

  async function submit() {
    const validationError = validateClienteForm(nombre, pais, idFiscal);
    if (validationError) { setError(validationError); return; }
    const fiscalErr = validarIdFiscal(pais, idFiscal.trim());
    if (fiscalErr) { setError(fiscalErr); return; }
    setSaving(true);
    setError(null);
    try {
      const path = tenantId
        ? `/api/platform/clientes?tenantId=${encodeURIComponent(tenantId)}`
        : '/api/clientes';
      const result = await apiJson<Cliente>(path, () => getToken(), {
        method: 'POST',
        body: JSON.stringify({
          nombre: nombre.trim(),
          pais,
          idFiscal: idFiscal.trim(),
          condicionIva: pais === 'AR' ? (condicionIva ?? undefined) : undefined,
          condicionTributaria: pais !== 'AR' ? (condicionTributaria.trim() || undefined) : undefined,
          email: email.trim() || undefined,
          telefono: telefono.trim() || undefined,
        }),
      });
      onSaved(result);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 409
          ? 'Ya existe un cliente con ese ID fiscal.'
          : friendlyError(e, 'clientes'),
      );
    } finally {
      setSaving(false);
    }
  }

  const L = 'text-xs uppercase tracking-[0.08em] text-vialto-steel';
  const I = 'h-9 w-full border border-black/15 px-2 text-sm';

  return (
    <div className={modalQuickCreateOverlayClass(stacked)}>
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded border border-black/10 bg-white shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-black/10 px-5 pt-5 pb-4">
          <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide">Nuevo cliente</h2>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center text-vialto-steel hover:bg-vialto-mist text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="grid gap-3">
            <label className="flex flex-col gap-1">
              <span className={L}>Nombre <span className="text-red-500">*</span></span>
              <input
                autoFocus
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Transportes del Norte SA"
                className={I}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={L}>País <span className="text-red-500">*</span></span>
              <PaisUbicacionSelect value={pais} onChange={handlePaisChange} placeholder="Seleccioná un país" />
            </label>
            <label className="flex flex-col gap-1">
              <span className={L}>{idFiscalPorPais(pais).label} <span className="text-red-500">*</span></span>
              <input
                value={idFiscal}
                onChange={(e) => setIdFiscal(e.target.value)}
                placeholder={idFiscalPorPais(pais).placeholder}
                className={`${I}${errorFiscal ? ' border-red-400' : ''}`}
              />
              {errorFiscal && <p className="text-xs text-red-600">{errorFiscal}</p>}
            </label>
            {pais && (
              <label className="flex flex-col gap-1">
                <span className={L}>{condInfo.label}</span>
                {condInfo.type === 'select' ? (
                  <select
                    value={condicionIva ?? ''}
                    onChange={(e) => setCondicionIva(e.target.value ? Number(e.target.value) : null)}
                    className={`${I} bg-white`}
                  >
                    <option value="">Seleccioná una opción</option>
                    {condInfo.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={condicionTributaria}
                    onChange={(e) => setCondicionTributaria(e.target.value)}
                    placeholder={condInfo.placeholder}
                    className={I}
                  />
                )}
              </label>
            )}
            <label className="flex flex-col gap-1">
              <span className={L}>Email</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ej: contacto@empresa.com"
                className={I}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className={L}>Teléfono</span>
              <input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Ej: +54 9 11 1234-5678"
                className={I}
              />
            </label>
          </div>
        </div>
        {error && (
          <p className="mx-5 mb-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-sm text-red-800">
            {error}
          </p>
        )}
        <div className="flex shrink-0 justify-end gap-2 border-t border-black/10 px-5 py-4">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="h-9 px-3 text-xs uppercase tracking-wider border border-black/20 bg-white hover:bg-vialto-mist disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving || !!errorFiscal}
            onClick={() => void submit()}
            className="inline-flex items-center gap-2 h-9 px-3 text-xs uppercase tracking-wider bg-vialto-charcoal text-white hover:bg-vialto-graphite disabled:opacity-50"
          >
            {saving && <Spinner className="h-3.5 w-3.5" />}
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
