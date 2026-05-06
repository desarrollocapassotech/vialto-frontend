import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CrudDangerZone } from '@/components/crud/CrudDangerZone';
import { CrudInput, CrudSelect } from '@/components/crud/CrudFields';
import { CrudPageLayout } from '@/components/crud/CrudPageLayout';
import { CrudFormErrorAlert } from '@/components/crud/CrudFormErrorAlert';
import { CrudSubmitButton } from '@/components/crud/CrudSubmitButton';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import { useMaestroData } from '@/hooks/useMaestroData';
import type { Vehiculo } from '@/types/api';

const TIPOS = ['tractor', 'semirremolque', 'camion', 'utilitario', 'otro'] as const;
const LABEL = 'font-[family-name:var(--font-ui)] text-sm uppercase tracking-[0.08em] text-vialto-steel';

export function VehiculoEditPage() {
  const { getToken } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenantId')?.trim() ?? '';
  const maestro = useMaestroData();
  const [patente, setPatente] = useState('');
  const [tipo, setTipo] = useState<(typeof TIPOS)[number]>('camion');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [anio, setAnio] = useState('');
  const [nroChasis, setNroChasis] = useState('');
  const [poliza, setPoliza] = useState('');
  const [vencimientoPoliza, setVencimientoPoliza] = useState('');
  const [tara, setTara] = useState('');
  const [precinto, setPrecinto] = useState('');
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
          setNroChasis(row.nroChasis ?? '');
          setPoliza(row.poliza ?? '');
          setVencimientoPoliza(
            row.vencimientoPoliza ? row.vencimientoPoliza.slice(0, 10) : '',
          );
          setTara(row.tara != null ? String(row.tara) : '');
          setPrecinto(row.precinto ?? '');
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
          nroChasis: nroChasis.trim() || undefined,
          poliza: poliza.trim() || undefined,
          vencimientoPoliza: vencimientoPoliza || undefined,
          tara: tara ? Number(tara.toString().replace(',', '.')) : undefined,
          precinto: precinto.trim() || undefined,
        }),
      });
      if (!tenantId) void maestro.refreshVehiculos();
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
      if (!tenantId) void maestro.refreshVehiculos();
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
    >
      {initialLoading ? (
        <p className="mt-6 text-vialto-steel">Cargando…</p>
      ) : (
        <>
          <form
            className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              onSave();
            }}
          >
            <label className="grid gap-1.5">
              <span className={LABEL}>Patente</span>
              <CrudInput
                value={patente}
                placeholder="Ej: AA123BB"
                onChange={(e) => setPatente(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className={LABEL}>Tipo</span>
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
              <span className={LABEL}>Marca</span>
              <CrudInput
                value={marca}
                placeholder="Ej: Scania"
                onChange={(e) => setMarca(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className={LABEL}>Modelo</span>
              <CrudInput
                value={modelo}
                placeholder="Ej: R450"
                onChange={(e) => setModelo(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className={LABEL}>Año</span>
              <CrudInput
                type="number"
                placeholder="Ej: 2020"
                value={anio}
                onChange={(e) => setAnio(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className={LABEL}>Nro. de chasis</span>
              <CrudInput
                value={nroChasis}
                placeholder="Ej: 9BM379182LB123456"
                onChange={(e) => setNroChasis(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className={LABEL}>Póliza</span>
              <CrudInput
                value={poliza}
                placeholder="Ej: POL-2024-001234"
                onChange={(e) => setPoliza(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className={LABEL}>Vencimiento de póliza</span>
              <CrudInput
                type="date"
                value={vencimientoPoliza}
                onChange={(e) => setVencimientoPoliza(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className={LABEL}>Tara (kg)</span>
              <CrudInput
                type="number"
                placeholder="Ej: 8500"
                value={tara}
                onChange={(e) => setTara(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className={LABEL}>Precinto</span>
              <CrudInput
                value={precinto}
                placeholder="Ej: 00123456"
                onChange={(e) => setPrecinto(e.target.value)}
              />
            </label>
            <div className="md:col-span-2">
              <CrudFormErrorAlert message={error} />
            </div>
            <div className="md:col-span-2">
              <CrudSubmitButton loading={loading} label="Guardar cambios" />
            </div>
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
