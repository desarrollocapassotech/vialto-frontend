import { useAuth } from '@clerk/clerk-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CrudInput } from '@/components/crud/CrudFields';
import { CrudPageLayout } from '@/components/crud/CrudPageLayout';
import { CrudSubmitButton } from '@/components/crud/CrudSubmitButton';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';

export function ChoferCreatePage() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenantId')?.trim() ?? '';
  const [nombre, setNombre] = useState('');
  const [dni, setDni] = useState('');
  const [licencia, setLicencia] = useState('');
  const [licenciaVence, setLicenciaVence] = useState('');
  const [telefono, setTelefono] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (!nombre.trim()) {
      setError('Ingresá el nombre del chofer.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const path = tenantId
        ? `/api/platform/choferes?tenantId=${encodeURIComponent(tenantId)}`
        : '/api/choferes';
      await apiJson(path, () => getToken(), {
        method: 'POST',
        body: JSON.stringify({
          nombre: nombre.trim(),
          dni: dni.trim() || undefined,
          licencia: licencia.trim() || undefined,
          licenciaVence: licenciaVence || undefined,
          telefono: telefono.trim() || undefined,
        }),
      });
      navigate('/choferes', { replace: true });
    } catch (e) {
      setError(friendlyError(e, 'choferes'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <CrudPageLayout
      title="Crear chofer"
      backTo="/choferes"
      backLabel="← Volver a choferes"
      error={error}
    >
      <form className="mt-6 grid gap-4" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
        <label className="grid gap-1.5">
          <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
            Nombre *
          </span>
          <CrudInput placeholder="Ej: Juan Perez" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label className="grid gap-1.5">
          <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
            DNI
          </span>
          <CrudInput placeholder="Ej: 30123456" value={dni} onChange={(e) => setDni(e.target.value)} />
        </label>
        <label className="grid gap-1.5">
          <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
            Licencia
          </span>
          <CrudInput placeholder="Ej: C3" value={licencia} onChange={(e) => setLicencia(e.target.value)} />
        </label>
        <label className="grid gap-1.5">
          <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
            Vencimiento licencia
          </span>
          <CrudInput type="date" value={licenciaVence} onChange={(e) => setLicenciaVence(e.target.value)} />
        </label>
        <label className="grid gap-1.5">
          <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
            Teléfono
          </span>
          <CrudInput placeholder="Ej: +54 9 11 1234-5678" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        </label>
        <CrudSubmitButton loading={loading} label="Crear chofer" />
      </form>
    </CrudPageLayout>
  );
}
