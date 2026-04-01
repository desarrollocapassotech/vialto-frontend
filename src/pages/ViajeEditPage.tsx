import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CrudDangerZone } from '@/components/crud/CrudDangerZone';
import { CrudInput, CrudSelect } from '@/components/crud/CrudFields';
import { CrudPageLayout } from '@/components/crud/CrudPageLayout';
import { CrudSubmitButton } from '@/components/crud/CrudSubmitButton';
import { apiJson } from '@/lib/api';
import { friendlyError } from '@/lib/friendlyError';
import type { Chofer, Cliente, Viaje } from '@/types/api';

const ESTADOS = ['pendiente', 'en_curso', 'finalizado', 'cancelado'] as const;

export function ViajeEditPage() {
  const { getToken } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenantId')?.trim() ?? '';
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [choferes, setChoferes] = useState<Chofer[]>([]);
  const [numero, setNumero] = useState('');
  const [estado, setEstado] = useState<(typeof ESTADOS)[number]>('pendiente');
  const [clienteId, setClienteId] = useState('');
  const [choferId, setChoferId] = useState('');
  const [transportistaId, setTransportistaId] = useState('');
  const [vehiculoId, setVehiculoId] = useState('');
  const [patenteTractor, setPatenteTractor] = useState('');
  const [patenteSemirremolque, setPatenteSemirremolque] = useState('');
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [fechaCarga, setFechaCarga] = useState('');
  const [fechaDescarga, setFechaDescarga] = useState('');
  const [mercaderia, setMercaderia] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [monto, setMonto] = useState('');
  const [fechaSalida, setFechaSalida] = useState('');
  const [fechaLlegada, setFechaLlegada] = useState('');
  const [kmRecorridos, setKmRecorridos] = useState('');
  const [litrosConsumidos, setLitrosConsumidos] = useState('');
  const [documentacionCsv, setDocumentacionCsv] = useState('');
  const [precioCliente, setPrecioCliente] = useState('');
  const [precioTransportistaExterno, setPrecioTransportistaExterno] = useState('');
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
        const viajePath = tenantId
          ? `/api/platform/viajes/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(
              tenantId,
            )}`
          : `/api/viajes/${encodeURIComponent(id)}`;
        const clientesPath = tenantId
          ? `/api/platform/clientes?tenantId=${encodeURIComponent(tenantId)}`
          : '/api/clientes';
        const choferesPath = tenantId
          ? `/api/platform/choferes?tenantId=${encodeURIComponent(tenantId)}`
          : '/api/choferes';
        const [row, clientesData, choferesData] = await Promise.all([
          apiJson<Viaje>(viajePath, () => getToken()),
          apiJson<Cliente[]>(clientesPath, () => getToken()),
          apiJson<Chofer[]>(choferesPath, () => getToken()),
        ]);
        if (!cancelled) {
          setClientes(clientesData);
          setChoferes(choferesData);
          setNumero(row.numero);
          setEstado((ESTADOS.includes(row.estado as any) ? row.estado : 'pendiente') as (typeof ESTADOS)[number]);
          setClienteId(row.clienteId);
          setChoferId(row.choferId ?? choferesData[0]?.id ?? '');
          setTransportistaId(row.transportistaId ?? '');
          setVehiculoId(row.vehiculoId ?? '');
          setPatenteTractor(row.patenteTractor ?? '');
          setPatenteSemirremolque(row.patenteSemirremolque ?? '');
          setOrigen(row.origen ?? '');
          setDestino(row.destino ?? '');
          setFechaCarga(row.fechaCarga ? new Date(row.fechaCarga).toISOString().slice(0, 16) : '');
          setFechaDescarga(row.fechaDescarga ? new Date(row.fechaDescarga).toISOString().slice(0, 16) : '');
          setFechaSalida(row.fechaSalida ? new Date(row.fechaSalida).toISOString().slice(0, 16) : '');
          setFechaLlegada(row.fechaLlegada ? new Date(row.fechaLlegada).toISOString().slice(0, 16) : '');
          setMercaderia(row.mercaderia ?? '');
          setObservaciones(row.observaciones ?? '');
          setMonto(row.monto != null ? String(row.monto) : '');
          setKmRecorridos(row.kmRecorridos != null ? String(row.kmRecorridos) : '');
          setLitrosConsumidos(row.litrosConsumidos != null ? String(row.litrosConsumidos) : '');
          setDocumentacionCsv((row.documentacion ?? []).join(', '));
          setPrecioCliente(row.precioCliente != null ? String(row.precioCliente) : '');
          setPrecioTransportistaExterno(
            row.precioTransportistaExterno != null
              ? String(row.precioTransportistaExterno)
              : '',
          );
        }
      } catch (e) {
        if (!cancelled) setError(friendlyError(e, 'viajes'));
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
    if (!numero.trim()) {
      setError('Ingresá el número de viaje.');
      return;
    }
    if (!clienteId) {
      setError('Seleccioná un cliente.');
      return;
    }
    if (!choferId) {
      setError('Seleccioná un chofer.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const path = tenantId
        ? `/api/platform/viajes/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(
            tenantId,
          )}`
        : `/api/viajes/${encodeURIComponent(id)}`;
      await apiJson(path, () => getToken(), {
        method: 'PATCH',
        body: JSON.stringify({
          numero: numero.trim(),
          estado,
          clienteId,
          choferId,
          transportistaId: transportistaId.trim() || undefined,
          vehiculoId: vehiculoId.trim() || undefined,
          patenteTractor: patenteTractor.trim().toUpperCase(),
          patenteSemirremolque: patenteSemirremolque.trim().toUpperCase(),
          origen: origen.trim() || undefined,
          destino: destino.trim() || undefined,
          fechaCarga: fechaCarga ? new Date(fechaCarga).toISOString() : undefined,
          fechaDescarga: fechaDescarga ? new Date(fechaDescarga).toISOString() : undefined,
          fechaSalida: fechaSalida ? new Date(fechaSalida).toISOString() : undefined,
          fechaLlegada: fechaLlegada ? new Date(fechaLlegada).toISOString() : undefined,
          kmRecorridos: kmRecorridos.trim() ? Number(kmRecorridos) : undefined,
          litrosConsumidos: litrosConsumidos.trim() ? Number(litrosConsumidos) : undefined,
          mercaderia: mercaderia.trim() || undefined,
          observaciones: observaciones.trim() || undefined,
          documentacion: documentacionCsv
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
          monto: monto ? Number(monto) : undefined,
          precioCliente: precioCliente ? Number(precioCliente) : undefined,
          precioTransportistaExterno: precioTransportistaExterno
            ? Number(precioTransportistaExterno)
            : undefined,
        }),
      });
      navigate('/viajes', { replace: true });
    } catch (e) {
      setError(friendlyError(e, 'viajes'));
    } finally {
      setLoading(false);
    }
  }

  async function onDelete() {
    if (!id || confirmDelete.trim() !== numero.trim()) return;
    setDeleting(true);
    setError(null);
    try {
      const path = tenantId
        ? `/api/platform/viajes/${encodeURIComponent(id)}?tenantId=${encodeURIComponent(
            tenantId,
          )}`
        : `/api/viajes/${encodeURIComponent(id)}`;
      await apiJson(path, () => getToken(), {
        method: 'DELETE',
      });
      navigate('/viajes', { replace: true });
    } catch (e) {
      setError(friendlyError(e, 'viajes'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <CrudPageLayout
      title="Editar viaje"
      backTo="/viajes"
      backLabel="← Volver a viajes"
      error={error}
    >
      {initialLoading ? (
        <p className="mt-6 text-vialto-steel">Cargando…</p>
      ) : (
        <>
          <form className="mt-6 grid gap-4" onSubmit={(e) => { e.preventDefault(); onSave(); }}>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Numero
              </span>
              <CrudInput
                value={numero}
                placeholder="Ej: VIA-000123"
                onChange={(e) => setNumero(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Estado
              </span>
              <CrudSelect
                value={estado}
                onChange={(e) => setEstado(e.target.value as (typeof ESTADOS)[number])}
              >
                {ESTADOS.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </CrudSelect>
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Cliente
              </span>
              <CrudSelect value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </CrudSelect>
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Chofer
              </span>
              <CrudSelect value={choferId} onChange={(e) => setChoferId(e.target.value)}>
                {choferes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </CrudSelect>
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Transportista ID
              </span>
              <CrudInput
                value={transportistaId}
                placeholder="Opcional"
                onChange={(e) => setTransportistaId(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Vehículo ID
              </span>
              <CrudInput
                value={vehiculoId}
                placeholder="Opcional"
                onChange={(e) => setVehiculoId(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Patente tractor
              </span>
              <CrudInput
                value={patenteTractor}
                placeholder="Ej: AB123CD"
                onChange={(e) => setPatenteTractor(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Patente semirremolque
              </span>
              <CrudInput
                value={patenteSemirremolque}
                placeholder="Ej: AC456EF"
                onChange={(e) => setPatenteSemirremolque(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Origen
              </span>
              <CrudInput
                value={origen}
                placeholder="Ej: Rosario, Santa Fe"
                onChange={(e) => setOrigen(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Destino
              </span>
              <CrudInput
                value={destino}
                placeholder="Ej: Cordoba Capital"
                onChange={(e) => setDestino(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Fecha carga
              </span>
              <CrudInput
                type="datetime-local"
                value={fechaCarga}
                onChange={(e) => setFechaCarga(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Fecha descarga
              </span>
              <CrudInput
                type="datetime-local"
                value={fechaDescarga}
                onChange={(e) => setFechaDescarga(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Fecha salida
              </span>
              <CrudInput
                type="datetime-local"
                value={fechaSalida}
                onChange={(e) => setFechaSalida(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Fecha llegada
              </span>
              <CrudInput
                type="datetime-local"
                value={fechaLlegada}
                onChange={(e) => setFechaLlegada(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Mercadería
              </span>
              <CrudInput
                value={mercaderia}
                placeholder="Ej: rollos de acero"
                onChange={(e) => setMercaderia(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Observaciones
              </span>
              <CrudInput
                value={observaciones}
                placeholder="Notas operativas"
                onChange={(e) => setObservaciones(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Monto del viaje
              </span>
              <CrudInput
                type="number"
                placeholder="Ej: 1500000"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Km recorridos
              </span>
              <CrudInput
                type="number"
                placeholder="Ej: 420"
                value={kmRecorridos}
                onChange={(e) => setKmRecorridos(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Litros consumidos
              </span>
              <CrudInput
                type="number"
                placeholder="Ej: 180"
                value={litrosConsumidos}
                onChange={(e) => setLitrosConsumidos(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Precio cliente
              </span>
              <CrudInput
                type="number"
                placeholder="Ej: 1500000"
                value={precioCliente}
                onChange={(e) => setPrecioCliente(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Precio transportista externo
              </span>
              <CrudInput
                type="number"
                placeholder="Ej: 1200000"
                value={precioTransportistaExterno}
                onChange={(e) => setPrecioTransportistaExterno(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Documentación (URLs separadas por coma)
              </span>
              <textarea
                value={documentacionCsv}
                onChange={(e) => setDocumentacionCsv(e.target.value)}
                className="min-h-20 w-full border border-black/15 bg-white px-3 py-2 text-sm"
                placeholder="https://... , https://..."
              />
            </label>
            <CrudSubmitButton loading={loading} label="Guardar cambios" />
          </form>
          <CrudDangerZone
            message="Escribí el número del viaje para eliminarlo."
            confirmValue={confirmDelete}
            onConfirmValueChange={setConfirmDelete}
            canDelete={confirmDelete.trim() === numero.trim()}
            deleting={deleting}
            onDelete={onDelete}
            deleteLabel="Eliminar viaje"
          />
        </>
      )}
    </CrudPageLayout>
  );
}
