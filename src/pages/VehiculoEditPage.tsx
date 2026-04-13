import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CrudDangerZone } from '@/components/crud/CrudDangerZone';
import {
  TransportistaAsignacionFields,
  type AsignacionModo,
} from '@/components/crud/TransportistaAsignacionFields';
import { CrudInput, CrudSelect } from '@/components/crud/CrudFields';
import { CrudPageLayout } from '@/components/crud/CrudPageLayout';
import { CrudSubmitButton } from '@/components/crud/CrudSubmitButton';
import { useTransportistasList } from '@/hooks/useTransportistasList';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import type { Vehiculo } from '@/types/api';

const TIPOS = ['tractor', 'semirremolque', 'camion', 'utilitario', 'otro'] as const;

export function VehiculoEditPage() {
  const { getToken } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenantId')?.trim() ?? '';
  const transportistas = useTransportistasList(tenantId || undefined);
  const [patente, setPatente] = useState('');
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>('camion');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [anio, setAnio] = useState('');
  const [modoAsignacion, setModoAsignacion] = useState<AsignacionModo>('propio');
  const [transportistaId, setTransportistaId] = useState('');
const [confirmDelete, setConfirmDelete] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setInitialLoading(true);
    (async () => {
      try {
        const path = tenantId
          ? `/api/platform/vehiculos/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(
              tenantId,
            )}`
          : `/api/vehiculos/${encodeURIComponent(id)}`;
        const row = await apiJson<Vehiculo>(path, () => getToken());
        if (!cancelled) {
          setPatente(row.patente);
          setTipo((TIPOS.includes(row.tipo as any) ? row.tipo : 'camion') as (typeof TIPOS)[number]);
          setMarca(row.marca ?? '');
          setModelo(row.modelo ?? '');
          const añoVal = row.año ?? row.anio;
          setAnio(añoVal != null ? String(añoVal) : '');
          const tid = row.transportistaId;
          setModoAsignacion(tid ? 'externo' : 'propio');
          setTransportistaId(tid ?? '');
        }
      } catch (e) {
        if (!cancelled) setError(friendlyError(e, 'vehiculos'));
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, id, tenantId]);

  async function onSave() {
    if (!id) return;
    if (!patente.trim()) {
      setError('Ingresá la patente.');
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
        ? `/api/platform/vehiculos/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(
            tenantId,
          )}`
        : `/api/vehiculos/${encodeURIComponent(id)}`;
      await apiJson(path, () => getToken(), {
        method: 'PATCH',
        body: JSON.stringify({
          patente: patente.trim().toUpperCase(),
          tipo,
          marca: marca.trim() || undefined,
          modelo: modelo.trim() || undefined,
          anio: anio ? Number(anio) : undefined,
          transportistaId:
            modoAsignacion === 'externo' ? transportistaId.trim() : null,
        }),
      });
      navigate('/vehiculos', { replace: true });
    } catch (e) {
      setError(friendlyError(e, 'vehiculos'));
    } finally {
      setLoading(false);
    }
  }

  async function onDelete() {
    if (!id || confirmDelete.trim().toUpperCase() !== patente.trim().toUpperCase()) return;
    setDeleting(true);
    setError(null);
    try {
      const path = tenantId
        ? `/api/platform/vehiculos/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(
            tenantId,
          )}`
        : `/api/vehiculos/${encodeURIComponent(id)}`;
      await apiJson(path, () => getToken(), {
        method: 'DELETE',
      });
      navigate('/vehiculos', { replace: true });
    } catch (e) {
      setError(friendlyError(e, 'vehiculos'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <CrudPageLayout
      title="Editar vehículo"
      backTo="/vehiculos"
      backLabel="← Volver a vehículos"
      error={error}
    >
      {initialLoading ? (
        <p className="mt-6 text-vialto-steel">Cargando…</p>
      ) : (
        <>
          <form className="mt-6 grid gap-4" onSubmit={(e) => { e.preventDefault(); onSave(); }}>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Patente
              </span>
              <CrudInput
                value={patente}
                placeholder="Ej: AA123BB"
                onChange={(e) => setPatente(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Tipo
              </span>
              <CrudSelect
                value={tipo}
                onChange={(e) => setTipo(e.target.value as (typeof TIPOS)[number])}
              >
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </CrudSelect>
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Marca
              </span>
              <CrudInput
                value={marca}
                placeholder="Ej: Scania"
                onChange={(e) => setMarca(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Modelo
              </span>
              <CrudInput
                value={modelo}
                placeholder="Ej: R450"
                onChange={(e) => setModelo(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Año
              </span>
              <CrudInput
                type="number"
                placeholder="Ej: 2020"
                value={anio}
                onChange={(e) => setAnio(e.target.value)}
              />
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
<CrudSubmitButton loading={loading} label="Guardar cambios" />
          </form>
          <CrudDangerZone
            message="Escribí la patente para eliminar este vehículo."
            confirmValue={confirmDelete}
            onConfirmValueChange={setConfirmDelete}
            canDelete={
              confirmDelete.trim().toUpperCase() === patente.trim().toUpperCase()
            }
            deleting={deleting}
            onDelete={onDelete}
            deleteLabel="Eliminar vehículo"
          />
        </>
      )}
    </CrudPageLayout>
  );
}
