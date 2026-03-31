import { useAuth } from '@clerk/clerk-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CrudInput } from '@/components/crud/CrudFields';
import { CrudPageLayout } from '@/components/crud/CrudPageLayout';
import { CrudSubmitButton } from '@/components/crud/CrudSubmitButton';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';

export function ClienteCreatePage() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenantId')?.trim() ?? '';
  const [nombre, setNombre] = useState('');
  const [cuit, setCuit] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
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
        }),
      });
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
      error={error}
    >
      <form
        className="mt-6 grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <CrudInput
          placeholder="Nombre *"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <CrudInput
          placeholder="CUIT"
          value={cuit}
          onChange={(e) => setCuit(e.target.value)}
        />
        <CrudInput
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <CrudInput
          placeholder="Teléfono"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
        />
        <CrudInput
          placeholder="Dirección"
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
        />
        <CrudSubmitButton loading={loading} label="Crear cliente" />
      </form>
    </CrudPageLayout>
  );
}
