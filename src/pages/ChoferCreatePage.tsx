import { useAuth } from '@clerk/clerk-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  TransportistaAsignacionFields,
  type AsignacionModo,
} from '@/components/crud/TransportistaAsignacionFields';
import { CrudInput } from '@/components/crud/CrudFields';
import { CrudPageLayout } from '@/components/crud/CrudPageLayout';
import { CrudFormErrorAlert } from '@/components/crud/CrudFormErrorAlert';
import { CrudSubmitButton } from '@/components/crud/CrudSubmitButton';
import { useTransportistasList } from '@/hooks/useTransportistasList';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { useMaestroData } from '@/hooks/useMaestroData';

export function ChoferCreatePage() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenantId')?.trim() ?? '';
  const maestro = useMaestroData();
  const transportistas = useTransportistasList(tenantId || undefined);
  const [nombre, setNombre] = useState('');
  const [dni, setDni] = useState('');
  const [telefono, setTelefono] = useState('');
  const [modoAsignacion, setModoAsignacion] = useState<AsignacionModo>('propio');
  const [transportistaId, setTransportistaId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    if (!nombre.trim()) {
      setError('Ingresá el nombre del chofer.');
      return;
    }
    if (modoAsignacion === 'externo' && !transportistaId.trim()) {
      setError('Seleccioná un transportista o elegí flota propia.');
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
          telefono: telefono.trim() || undefined,
          transportistaId:
            modoAsignacion === 'externo' ? transportistaId.trim() : null,
        }),
      });
      if (!tenantId) void maestro.refreshChoferes();
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
            Teléfono
          </span>
          <CrudInput placeholder="Ej: +54 9 11 1234-5678" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        </label>
        <TransportistaAsignacionFields
          modo={modoAsignacion}
          onModoChange={(m) => {
            setModoAsignacion(m);
            if (m === 'propio') setTransportistaId('');
          }}
          transportistaId={transportistaId}
          onTransportistaIdChange={setTransportistaId}
          transportistas={transportistas ?? []}
          loadingTransportistas={transportistas === null}
        />
        <CrudFormErrorAlert message={error} />
        <CrudSubmitButton loading={loading} label="Crear chofer" />
      </form>
    </CrudPageLayout>
  );
}
