import { useAuth } from '@clerk/clerk-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CrudInput } from '@/components/crud/CrudFields';
import { CrudPageLayout } from '@/components/crud/CrudPageLayout';
import { CrudFormErrorAlert } from '@/components/crud/CrudFormErrorAlert';
import { CrudSubmitButton } from '@/components/crud/CrudSubmitButton';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { useMaestroData } from '@/hooks/useMaestroData';

export function ClienteCreatePage() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenantId')?.trim() ?? '';
  const maestro = useMaestroData();
  const [nombre, setNombre] = useState('');
  const [cuit, setCuit] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [pais, setPais] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (!nombre.trim()) {
      setError('Ingresá el nombre del cliente.');
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
          cuit: cuit.trim() || undefined,
          email: email.trim() || undefined,
          telefono: telefono.trim() || undefined,
          direccion: direccion.trim() || undefined,
          pais: pais.trim() || undefined,
        }),
      });
      if (!tenantId) void maestro.refreshClientes();
      navigate('/clientes', { replace: true });
    } catch (e) {
      setError(friendlyError(e, 'clientes'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <CrudPageLayout
      title="Crear cliente"
      backTo="/clientes"
      backLabel="← Volver a clientes"
    >
      <form
        className="mt-6 grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <label className="grid gap-1.5">
          <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
            Nombre *
          </span>
          <CrudInput
            placeholder="Ej: Transportes del Norte SA"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
            ID Fiscal
          </span>
          <CrudInput
            placeholder="Ej: 30-71234567-8 / RUT / NIF"
            value={cuit}
            onChange={(e) => setCuit(e.target.value)}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
            Email
          </span>
          <CrudInput
            placeholder="Ej: contacto@empresa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
            Teléfono
          </span>
          <CrudInput
            placeholder="Ej: +54 9 11 1234-5678"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
            Dirección
          </span>
          <CrudInput
            placeholder="Ej: Av. Corrientes 1234"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
          />
        </label>
        <label className="grid gap-1.5">
          <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
            País
          </span>
          <CrudInput
            placeholder="Ej: Argentina"
            value={pais}
            onChange={(e) => setPais(e.target.value)}
          />
        </label>
        <CrudFormErrorAlert message={error} />
        <CrudSubmitButton loading={loading} label="Crear cliente" />
      </form>
    </CrudPageLayout>
  );
}
