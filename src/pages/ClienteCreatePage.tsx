import { useAuth } from '@clerk/clerk-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CrudFieldLabel, CrudInput, CrudSelect } from '@/components/crud/CrudFields';
import { CrudPageLayout } from '@/components/crud/CrudPageLayout';
import { CrudFormErrorAlert } from '@/components/crud/CrudFormErrorAlert';
import { CrudSubmitButton } from '@/components/crud/CrudSubmitButton';
import { PaisUbicacionSelect } from '@/components/forms/PaisUbicacionSelect';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { useMaestroData } from '@/hooks/useMaestroData';
import { validateClienteForm } from '@/lib/clienteForm';
import { idFiscalPorPais, validarIdFiscal, condicionTributariaPorPais } from '@/lib/ciudades';
import type { PaisCodigo } from '@/lib/ciudades';

export function ClienteCreatePage() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenantId')?.trim() ?? '';
  const maestro = useMaestroData();
  const [nombre, setNombre] = useState('');
  const [pais, setPais] = useState<PaisCodigo | ''>('');
  const [idFiscal, setIdFiscal] = useState('');
  const [condicionIva, setCondicionIva] = useState<number | null>(null);
  const [condicionTributaria, setCondicionTributaria] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handlePaisChange(newPais: PaisCodigo | '') {
    setPais(newPais);
    setCondicionIva(null);
    setCondicionTributaria('');
  }

  async function onSubmit() {
    const validationError = validateClienteForm(nombre, pais, idFiscal);
    if (validationError) {
      setError(validationError);
      return;
    }
    const errorFiscal = validarIdFiscal(pais, idFiscal.trim());
    if (errorFiscal) {
      setError(errorFiscal);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const path = tenantId
        ? `/api/platform/clientes?tenantId=${encodeURIComponent(tenantId)}`
        : '/api/clientes';
      await apiJson(path, () => getToken(), {
        method: 'POST',
        body: JSON.stringify({
          nombre: nombre.trim(),
          pais,
          idFiscal: idFiscal.trim(),
          condicionIva: pais === 'AR' ? (condicionIva ?? undefined) : undefined,
          condicionTributaria: pais !== 'AR' ? (condicionTributaria.trim() || undefined) : undefined,
          email: email.trim() || undefined,
          telefono: telefono.trim() || undefined,
          direccion: direccion.trim() || undefined,
        }),
      });
      if (!tenantId) void maestro.refreshClientes();
      navigate(`/base-de-datos?tab=clientes${tenantId ? `&tenantId=${encodeURIComponent(tenantId)}` : ''}`, { replace: true });
    } catch (e) {
      setError(friendlyError(e, 'clientes'));
    } finally {
      setLoading(false);
    }
  }

  const labelClass = 'font-[family-name:var(--font-ui)] text-sm uppercase tracking-[0.08em] text-vialto-steel';
  const condInfo = condicionTributariaPorPais(pais);
  const errorFiscal = idFiscal.trim() ? validarIdFiscal(pais, idFiscal.trim()) : null;

  return (
    <CrudPageLayout
      title="Crear cliente"
      backTo={`/base-de-datos?tab=clientes${tenantId ? `&tenantId=${encodeURIComponent(tenantId)}` : ''}`}
      backLabel="← Volver a clientes"
    >
      <form
        className="mt-6 grid gap-4"
        onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      >
        <label className="grid gap-1.5">
          <CrudFieldLabel required>Nombre</CrudFieldLabel>
          <CrudInput
            placeholder="Ej: Transportes del Norte SA"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </label>
        <label className="grid gap-1.5">
          <CrudFieldLabel required>País</CrudFieldLabel>
          <PaisUbicacionSelect
            value={pais}
            onChange={handlePaisChange}
            placeholder="Seleccioná un país"
          />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <CrudFieldLabel required>{idFiscalPorPais(pais).label}</CrudFieldLabel>
            <CrudInput
              placeholder={idFiscalPorPais(pais).placeholder}
              value={idFiscal}
              onChange={(e) => setIdFiscal(e.target.value)}
              className={errorFiscal ? 'border-red-400' : undefined}
            />
            {errorFiscal && <p className="text-xs text-red-600">{errorFiscal}</p>}
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
          <span className={labelClass}>Dirección</span>
          <CrudInput
            placeholder="Ej: Av. Corrientes 1234"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
          />
        </label>
        <label className="grid gap-1.5">
          <span className={labelClass}>Email</span>
          <CrudInput
            placeholder="Ej: contacto@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="grid gap-1.5">
          <span className={labelClass}>Teléfono</span>
          <CrudInput
            placeholder="Ej: +54 9 11 1234-5678"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
          />
        </label>
        <CrudFormErrorAlert message={error} />
        <CrudSubmitButton loading={loading} label="Crear cliente" disabled={!!errorFiscal} />
      </form>
    </CrudPageLayout>
  );
}
