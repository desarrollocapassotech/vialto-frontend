import { useEffect, useState } from 'react';
import { ApiError, apiJson } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorPieModal } from '@/components/shared/ErrorPieModal';
import { friendlyError } from '@/lib/friendlyError';
import { idFiscalPorPais, validarIdFiscal, condicionTributariaPorPais } from '@/lib/ciudades';
import { PaisUbicacionSelect } from '@/components/forms/PaisUbicacionSelect';
import { useTenantPaisFijo } from '@/hooks/useTenantPaisFijo';
import type { PaisCodigo } from '@/lib/ciudades';
import type { Cliente } from '@/types/api';
import { modalQuickCreateOverlayClass } from '@/lib/modalLayers';
import { useArcaPadron } from '@/hooks/useArcaPadron';
import { useConfirmarDescarte } from '@/hooks/useConfirmarDescarte';
import { useFieldConfig } from '@/hooks/useFieldConfig';
import { ArcaPadronStatus } from '@/components/shared/ArcaPadronStatus';
import { AvisoSinDatosFiscales } from '@/components/transportistas/AvisoSinDatosFiscales';

/**
 * Alta rápida de un cliente (Viajes, Stock, Cuenta corriente). Mismas reglas que "Crear
 * cliente" de Base de datos (`ClienteCreatePage`): campos visibles según "Campos por
 * empresa", país e ID fiscal recomendados (si faltan, hay que confirmar "Entiendo, guardar
 * igual"), validación del ID fiscal y del padrón de ARCA, y dirección.
 */
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
  const [direccion, setDireccion] = useState('');
  const [confirmarSinDatosFiscales, setConfirmarSinDatosFiscales] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const { solicitarCierre, dialogo } = useConfirmarDescarte(onClose);

  const { isVisible } = useFieldConfig('clientes');
  const { paisFijo, loading: paisFijoLoading, tenant: tenantEfectivo } = useTenantPaisFijo(tenantId);
  const paisVisible = isVisible('alta_cliente', 'pais') && !paisFijo;
  const idFiscalVisible = isVisible('alta_cliente', 'idFiscal');
  const condicionVisible = isVisible('alta_cliente', 'condicionIvaTributaria');
  const direccionVisible = isVisible('alta_cliente', 'direccion');
  const emailVisible = isVisible('alta_cliente', 'email');
  const telefonoVisible = isVisible('alta_cliente', 'telefono');

  const faltanPais = paisVisible && !pais;
  const faltanIdFiscal = idFiscalVisible && !idFiscal.trim();
  const faltanDatosFiscales = faltanPais || faltanIdFiscal;

  const arca = useArcaPadron({
    getToken,
    habilitado: tenantEfectivo?.validacionCuitArcaHabilitada === true,
    pais,
    idFiscal: idFiscalVisible ? idFiscal : '',
    nombre: { value: nombre, set: setNombre },
    domicilio: direccionVisible ? { value: direccion, set: setDireccion } : undefined,
    condicionIva: condicionVisible ? { value: condicionIva, set: setCondicionIva } : undefined,
  });

  function handlePaisChange(newPais: PaisCodigo | '') {
    setPais(newPais);
    setCondicionIva(null);
    setCondicionTributaria('');
  }

  // País oculto por config de superadmin: se completa solo con el país fijo del
  // tenant, sin mostrar el selector (ver useTenantPaisFijo).
  useEffect(() => {
    if (paisFijo && pais !== paisFijo) setPais(paisFijo);
  }, [paisFijo, pais]);

  const errorFiscal =
    idFiscalVisible && idFiscal.trim() ? validarIdFiscal(pais, idFiscal.trim()) : null;
  const condInfo = condicionTributariaPorPais(pais);
  const idFiscalError = fieldErrors.idFiscal ?? errorFiscal;
  const faltante =
    faltanPais && faltanIdFiscal
      ? `país y/o ${idFiscalPorPais(pais).label.toLowerCase()}`
      : faltanPais
        ? 'país'
        : idFiscalPorPais(pais).label.toLowerCase();

  async function submit() {
    const errs: Record<string, string> = {};
    if (!nombre.trim()) errs.nombre = 'Ingresá el nombre del cliente.';
    if (errorFiscal) errs.idFiscal = errorFiscal;
    if (faltanDatosFiscales && !confirmarSinDatosFiscales) {
      errs.confirmarSinDatosFiscales = `Para guardar sin ${faltante}, tildá "Entiendo, guardar igual".`;
    }
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
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
          pais: pais || undefined,
          idFiscal: idFiscal.trim() || undefined,
          condicionIva: pais === 'AR' ? (condicionIva ?? undefined) : undefined,
          condicionTributaria: pais !== 'AR' ? (condicionTributaria.trim() || undefined) : undefined,
          email: email.trim() || undefined,
          telefono: telefono.trim() || undefined,
          direccion: direccion.trim() || undefined,
          confirmarSinDatosFiscales: faltanDatosFiscales ? confirmarSinDatosFiscales : undefined,
        }),
      });
      onSaved(result);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 409
          ? `Ya existe un cliente con ese ${idFiscalPorPais(pais).label}.`
          : friendlyError(e, 'clientes'),
      );
    } finally {
      setSaving(false);
    }
  }

  if (paisFijoLoading) {
    return (
      <div className={modalQuickCreateOverlayClass(stacked)}>
        <div className="flex w-full max-w-2xl flex-col rounded border border-black/10 bg-white p-5 shadow-xl">
          <div className="h-40 animate-pulse rounded bg-vialto-mist/60" />
        </div>
      </div>
    );
  }

  const L = 'text-xs uppercase tracking-[0.08em] text-vialto-steel';
  const I = 'h-9 w-full border px-2 text-sm';

  return (
    <div className={modalQuickCreateOverlayClass(stacked)}>
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded border border-black/10 bg-white shadow-xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-black/10 px-5 pt-5 pb-4">
          <h2 className="font-[family-name:var(--font-display)] text-xl tracking-wide">Nuevo cliente</h2>
          <button
            type="button"
            onClick={solicitarCierre}
            className="h-8 w-8 flex items-center justify-center text-vialto-steel hover:bg-vialto-mist text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className={L}>Nombre <span className="text-red-500">*</span></span>
              <input
                autoFocus
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Transportes del Norte SA"
                className={`${I} ${fieldErrors.nombre ? 'border-red-400' : 'border-black/15'}`}
              />
            </label>
            {paisVisible && (
              <label className="flex flex-col gap-1">
                <span className={L}>País (recomendado)</span>
                <PaisUbicacionSelect value={pais} onChange={handlePaisChange} placeholder="Seleccioná un país" />
              </label>
            )}
            {idFiscalVisible && (
              <label className="flex flex-col gap-1">
                <span className={L}>{idFiscalPorPais(pais).label} (recomendado)</span>
                <input
                  value={idFiscal}
                  onChange={(e) => setIdFiscal(e.target.value)}
                  onBlur={arca.onIdFiscalBlur}
                  placeholder={idFiscalPorPais(pais).placeholder}
                  className={`${I} ${idFiscalError ? 'border-red-400' : 'border-black/15'}`}
                />
              </label>
            )}
            <div className="sm:col-span-2 empty:hidden">
              <ArcaPadronStatus {...arca} />
            </div>
            {condicionVisible && pais && (
              <label className="flex flex-col gap-1">
                <span className={L}>{condInfo.label}</span>
                {condInfo.type === 'select' ? (
                  <select
                    value={condicionIva ?? ''}
                    onChange={(e) => setCondicionIva(e.target.value ? Number(e.target.value) : null)}
                    className={`${I} border-black/15 bg-white`}
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
                    className={`${I} border-black/15`}
                  />
                )}
              </label>
            )}
            {direccionVisible && (
              <label className="flex flex-col gap-1">
                <span className={L}>Dirección</span>
                <input
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="Ej: Av. Corrientes 1234"
                  className={`${I} border-black/15`}
                />
              </label>
            )}
            {emailVisible && (
              <label className="flex flex-col gap-1">
                <span className={L}>Email</span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ej: contacto@empresa.com"
                  className={`${I} border-black/15`}
                />
              </label>
            )}
            {telefonoVisible && (
              <label className="flex flex-col gap-1">
                <span className={L}>Teléfono</span>
                <input
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="Ej: +54 9 11 1234-5678"
                  className={`${I} border-black/15`}
                />
              </label>
            )}
            {faltanDatosFiscales && (
              <div className="sm:col-span-2">
                <AvisoSinDatosFiscales
                  entidad="cliente"
                  faltante={faltante}
                  confirmado={confirmarSinDatosFiscales}
                  onConfirmadoChange={(v) => {
                    setConfirmarSinDatosFiscales(v);
                    if (v) {
                      setFieldErrors((prev) => {
                        const resto = { ...prev };
                        delete resto.confirmarSinDatosFiscales;
                        return resto;
                      });
                    }
                  }}
                  error={!!fieldErrors.confirmarSinDatosFiscales}
                />
              </div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-black/10 px-5 py-4">
          <ErrorPieModal error={error} fieldErrors={fieldErrors} />
          <button
            type="button"
            disabled={saving}
            onClick={solicitarCierre}
            className="h-9 px-3 text-xs uppercase tracking-wider border border-black/20 bg-white hover:bg-vialto-mist disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            className="inline-flex items-center gap-2 h-9 px-3 text-xs uppercase tracking-wider bg-vialto-charcoal text-white hover:bg-vialto-graphite disabled:opacity-50"
          >
            {saving && <Spinner className="h-3.5 w-3.5" />}
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
      {dialogo}
    </div>
  );
}
