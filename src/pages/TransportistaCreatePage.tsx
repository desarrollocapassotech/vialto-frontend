import { useAuth } from '@clerk/clerk-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CrudInput, CrudSelect } from '@/components/crud/CrudFields';
import { CrudPageLayout } from '@/components/crud/CrudPageLayout';
import { CrudFormErrorAlert } from '@/components/crud/CrudFormErrorAlert';
import { CrudSubmitButton } from '@/components/crud/CrudSubmitButton';
import { PaisUbicacionSelect } from '@/components/forms/PaisUbicacionSelect';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { useMaestroData } from '@/hooks/useMaestroData';
import { idFiscalPorPais, condicionTributariaPorPais } from '@/lib/ciudades';
import type { PaisCodigo } from '@/lib/ciudades';

export function TransportistaCreatePage() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenantId')?.trim() ?? '';
  const maestro = useMaestroData();
  const [nombre, setNombre] = useState('');
  const [pais, setPais] = useState<PaisCodigo | ''>('');
  const [idFiscal, setIdFiscal] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [domicilio, setDomicilio] = useState('');
  const [condicionIva, setCondicionIva] = useState<number | null>(null);
  const [condicionTributaria, setCondicionTributaria] = useState('');
  const [paut, setPaut] = useState('');
  const [permisoInternacional, setPermisoInternacional] = useState('');
  const [fechaVencimientoPermiso, setFechaVencimientoPermiso] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePaisChange(newPais: PaisCodigo | '') {
    setPais(newPais);
    setCondicionIva(null);
    setCondicionTributaria('');
  }

  async function onSubmit() {
    if (!nombre.trim()) {
      setError('Ingresá el nombre del transportista.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const path = tenantId
        ? `/api/platform/transportistas?tenantId=${encodeURIComponent(tenantId)}`
        : '/api/transportistas';
      await apiJson(path, () => getToken(), {
        method: 'POST',
        body: JSON.stringify({
          nombre: nombre.trim(),
          pais: pais || undefined,
          idFiscal: idFiscal.trim() || undefined,
          email: email.trim() || undefined,
          telefono: telefono.trim() || undefined,
          domicilio: domicilio.trim() || undefined,
          condicionIva: pais === 'AR' ? (condicionIva ?? undefined) : undefined,
          condicionTributaria: pais !== 'AR' ? (condicionTributaria.trim() || undefined) : undefined,
          paut: paut.trim() || undefined,
          permisoInternacional: permisoInternacional.trim() || undefined,
          fechaVencimientoPermiso: fechaVencimientoPermiso || undefined,
        }),
      });
      if (!tenantId) void maestro.refreshTransportistas();
      navigate('/transportistas', { replace: true });
    } catch (e) {
      setError(friendlyError(e, 'transportistas'));
    } finally {
      setLoading(false);
    }
  }

  const labelClass = 'font-[family-name:var(--font-ui)] text-sm uppercase tracking-[0.08em] text-vialto-steel';
  const sectionClass = 'mt-2 border-t border-black/10 pt-4';
  const condInfo = condicionTributariaPorPais(pais);

  return (
    <CrudPageLayout
      title="Crear transportista"
      backTo="/transportistas"
      backLabel="← Volver a transportistas"
    >
      <form
        className="mt-6 grid gap-4"
        onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      >
        <label className="grid gap-1.5">
          <span className={labelClass}>Nombre *</span>
          <CrudInput placeholder="Ej: Transportes del Norte SA" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label className="grid gap-1.5">
          <span className={labelClass}>País</span>
          <PaisUbicacionSelect value={pais} onChange={handlePaisChange} placeholder="Seleccioná un país" />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="grid gap-1.5">
            <span className={labelClass}>{idFiscalPorPais(pais).label}</span>
            <CrudInput placeholder={idFiscalPorPais(pais).placeholder} value={idFiscal} onChange={(e) => setIdFiscal(e.target.value)} />
          </label>
          <label className="grid gap-1.5">
            <span className={labelClass}>{condInfo.label}</span>
            {condInfo.type === 'select' ? (
              <CrudSelect
                value={condicionIva ?? ''}
                onChange={(e) => setCondicionIva(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Seleccioná una opción</option>
                {condInfo.options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </CrudSelect>
            ) : (
              <CrudInput
                placeholder={condInfo.placeholder}
                value={condicionTributaria}
                onChange={(e) => setCondicionTributaria(e.target.value)}
              />
            )}
          </label>
        </div>
        <label className="grid gap-1.5">
          <span className={labelClass}>Domicilio</span>
          <CrudInput placeholder="Ej: Av. Libertador 1234, Buenos Aires" value={domicilio} onChange={(e) => setDomicilio(e.target.value)} />
        </label>
        <label className="grid gap-1.5">
          <span className={labelClass}>Email</span>
          <CrudInput placeholder="Ej: contacto@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="grid gap-1.5">
          <span className={labelClass}>Teléfono</span>
          <CrudInput placeholder="Ej: +54 9 11 1234-5678" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        </label>

        <div className={sectionClass}>
          <p className={`${labelClass} mb-3`}>Datos para PAUT</p>
          <div className="grid gap-4">
            <label className="grid gap-1.5">
              <span className={labelClass}>N° PAUT</span>
              <CrudInput placeholder="Ej: 17597" value={paut} onChange={(e) => setPaut(e.target.value)} />
            </label>
            <label className="grid gap-1.5">
              <span className={labelClass}>Permiso Internacional</span>
              <CrudInput placeholder="Ej: 20113C19113" value={permisoInternacional} onChange={(e) => setPermisoInternacional(e.target.value)} />
            </label>
            <label className="grid gap-1.5">
              <span className={labelClass}>Vencimiento Permiso Internacional</span>
              <CrudInput type="date" value={fechaVencimientoPermiso} onChange={(e) => setFechaVencimientoPermiso(e.target.value)} />
            </label>
          </div>
        </div>

        <CrudFormErrorAlert message={error} />
        <CrudSubmitButton loading={loading} label="Crear transportista" />
      </form>
    </CrudPageLayout>
  );
}
