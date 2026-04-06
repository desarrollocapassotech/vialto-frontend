import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CrudDangerZone } from '@/components/crud/CrudDangerZone';
import { CrudInput, CrudSelect } from '@/components/crud/CrudFields';
import { CrudPageLayout } from '@/components/crud/CrudPageLayout';
import { CrudSubmitButton } from '@/components/crud/CrudSubmitButton';
import { CiudadCombobox } from '@/components/forms/CiudadCombobox';
import { PaisUbicacionSelect } from '@/components/forms/PaisUbicacionSelect';
import {
  ViajeOperacionTipoFieldset,
  type ViajeOperacionModo,
} from '@/components/viajes/ViajeOperacionTipoFieldset';
import { apiJson } from '@/lib/api';
import { formatCurrencyArFromNumber, maskCurrencyArInput, parseCurrencyAr } from '@/lib/currencyMask';
import { friendlyError } from '@/lib/friendlyError';
import { esEtiquetaCiudadValida, inferirPaisDesdeUbicacion, type PaisCodigo } from '@/lib/ciudades';
import { estadoViajeLabel } from '@/lib/viajesEstados';
import type { Chofer, Cliente, Transportista, Vehiculo, Viaje } from '@/types/api';

const ESTADOS = ['pendiente', 'en_curso', 'finalizado', 'cancelado'] as const;

export function ViajeEditPage() {
  const { getToken } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenantId')?.trim() ?? '';
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [choferes, setChoferes] = useState<Chofer[]>([]);
  const [transportistas, setTransportistas] = useState<Transportista[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [numero, setNumero] = useState('');
  const [estado, setEstado] = useState<(typeof ESTADOS)[number]>('pendiente');
  const [clienteId, setClienteId] = useState('');
  const [choferId, setChoferId] = useState('');
  const [transportistaId, setTransportistaId] = useState('');
  const [modoOperacion, setModoOperacion] = useState<ViajeOperacionModo>('propio');
  const [vehiculoId, setVehiculoId] = useState('');
  const [patenteTractor, setPatenteTractor] = useState('');
  const [patenteSemirremolque, setPatenteSemirremolque] = useState('');
  const [paisOrigen, setPaisOrigen] = useState<PaisCodigo>('AR');
  const [paisDestino, setPaisDestino] = useState<PaisCodigo>('AR');
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
        const transportistasPath = tenantId
          ? `/api/platform/transportistas?tenantId=${encodeURIComponent(tenantId)}`
          : '/api/transportistas';
        const vehiculosPath = tenantId
          ? `/api/platform/vehiculos?tenantId=${encodeURIComponent(tenantId)}`
          : '/api/vehiculos';
        const [row, clientesData, choferesData, transportistasData, vehiculosData] = await Promise.all([
          apiJson<Viaje>(viajePath, () => getToken()),
          apiJson<Cliente[]>(clientesPath, () => getToken()),
          apiJson<Chofer[]>(choferesPath, () => getToken()),
          apiJson<Transportista[]>(transportistasPath, () => getToken()),
          apiJson<Vehiculo[]>(vehiculosPath, () => getToken()),
        ]);
        if (!cancelled) {
          setClientes(clientesData);
          setChoferes(choferesData);
          setTransportistas(transportistasData);
          setVehiculos(vehiculosData);
          setNumero(row.numero);
          setEstado((ESTADOS.includes(row.estado as any) ? row.estado : 'pendiente') as (typeof ESTADOS)[number]);
          setClienteId(row.clienteId);
          setChoferId(row.choferId ?? choferesData[0]?.id ?? '');
          setTransportistaId(row.transportistaId ?? '');
          setModoOperacion((row.transportistaId ?? '').trim() ? 'externo' : 'propio');
          setVehiculoId(row.vehiculoId ?? '');
          setPatenteTractor(row.patenteTractor ?? '');
          setPatenteSemirremolque(row.patenteSemirremolque ?? '');
          setOrigen(row.origen ?? '');
          setDestino(row.destino ?? '');
          setPaisOrigen(inferirPaisDesdeUbicacion(row.origen ?? ''));
          setPaisDestino(inferirPaisDesdeUbicacion(row.destino ?? ''));
          setFechaCarga(row.fechaCarga ? new Date(row.fechaCarga).toISOString().slice(0, 16) : '');
          setFechaDescarga(row.fechaDescarga ? new Date(row.fechaDescarga).toISOString().slice(0, 16) : '');
          setFechaSalida(row.fechaSalida ? new Date(row.fechaSalida).toISOString().slice(0, 16) : '');
          setFechaLlegada(row.fechaLlegada ? new Date(row.fechaLlegada).toISOString().slice(0, 16) : '');
          setMercaderia(row.mercaderia ?? '');
          setObservaciones(row.observaciones ?? '');
          setMonto(formatCurrencyArFromNumber(row.monto));
          setKmRecorridos(row.kmRecorridos != null ? String(row.kmRecorridos) : '');
          setLitrosConsumidos(row.litrosConsumidos != null ? String(row.litrosConsumidos) : '');
          setDocumentacionCsv((row.documentacion ?? []).join(', '));
          setPrecioCliente(formatCurrencyArFromNumber(row.precioCliente));
          setPrecioTransportistaExterno(formatCurrencyArFromNumber(row.precioTransportistaExterno));
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

  function applyModoOperacion(m: ViajeOperacionModo) {
    setModoOperacion(m);
    if (m === 'externo') {
      setChoferId('');
      setVehiculoId('');
    } else {
      setTransportistaId('');
      setChoferId((prev) => prev || choferes[0]?.id || '');
    }
  }

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
    const externo = modoOperacion === 'externo';
    if (externo && !transportistaId.trim()) {
      setError('Seleccioná un transportista externo.');
      return;
    }
    if (!externo && (!choferId || !vehiculoId.trim())) {
      setError('En flota propia, seleccioná chofer y vehículo.');
      return;
    }
    const o = origen.trim();
    const d = destino.trim();
    if (o || d) {
      const [okO, okD] = await Promise.all([
        o ? esEtiquetaCiudadValida(paisOrigen, o) : Promise.resolve(true),
        d ? esEtiquetaCiudadValida(paisDestino, d) : Promise.resolve(true),
      ]);
      if (!okO || !okD) {
        setError('Origen y destino deben elegirse de la lista de ciudades (no se admite texto libre).');
        return;
      }
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
          ...(externo
            ? {
                transportistaId: transportistaId.trim(),
                choferId: null,
                vehiculoId: null,
              }
            : {
                transportistaId: null,
                choferId,
                vehiculoId: vehiculoId.trim(),
              }),
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
          monto: parseCurrencyAr(monto),
          precioCliente: parseCurrencyAr(precioCliente),
          precioTransportistaExterno: parseCurrencyAr(precioTransportistaExterno),
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
          <form
            className="mt-6 grid gap-4 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              onSave();
            }}
          >
            <div className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Número de viaje
              </span>
              <span className="flex min-h-[2.25rem] items-center text-sm font-medium text-vialto-charcoal">
                {numero || '—'}
              </span>
            </div>
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
                    {estadoViajeLabel[x] ?? x}
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
            <ViajeOperacionTipoFieldset
              modo={modoOperacion}
              onModoChange={applyModoOperacion}
              className="col-span-full grid min-w-0 gap-3 border-0 p-0"
              externoContent={
                <>
                  <label className="grid gap-1.5">
                    <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                      Transportista externo
                    </span>
                    <CrudSelect value={transportistaId} onChange={(e) => setTransportistaId(e.target.value)}>
                      <option value="">Elegí un transportista…</option>
                      {transportistas.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nombre}
                        </option>
                      ))}
                    </CrudSelect>
                  </label>
                  <label className="grid gap-1.5 pt-1">
                    <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                      Precio transportista externo
                    </span>
                    <CrudInput
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="Ej: 1.200.000,50"
                      value={precioTransportistaExterno}
                      onChange={(e) => setPrecioTransportistaExterno(maskCurrencyArInput(e.target.value))}
                      className="text-right tabular-nums"
                    />
                  </label>
                </>
              }
              propioContent={
                <>
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
                  <label className="grid gap-1.5 pt-1">
                    <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                      Vehículo
                    </span>
                    <CrudSelect value={vehiculoId} onChange={(e) => setVehiculoId(e.target.value)}>
                      <option value="">Elegí un vehículo…</option>
                      {vehiculos.map((vh) => (
                        <option key={vh.id} value={vh.id}>
                          {vh.patente}
                        </option>
                      ))}
                    </CrudSelect>
                  </label>
                </>
              }
            />
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
            <div className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Origen
              </span>
              <div className="flex flex-wrap gap-2 items-start">
                <PaisUbicacionSelect
                  value={paisOrigen}
                  onChange={(p) => {
                    setPaisOrigen(p);
                    setOrigen('');
                  }}
                  aria-label="País de origen"
                  className="h-10 min-w-[10rem] border border-black/15 bg-white px-3 text-sm"
                />
                <div className="min-w-[200px] flex-1">
                  <CiudadCombobox
                    pais={paisOrigen}
                    value={origen}
                    onChange={setOrigen}
                    inputClassName="h-10 w-full border border-black/15 bg-white px-3 text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="grid gap-1.5">
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Destino
              </span>
              <div className="flex flex-wrap gap-2 items-start">
                <PaisUbicacionSelect
                  value={paisDestino}
                  onChange={(p) => {
                    setPaisDestino(p);
                    setDestino('');
                  }}
                  aria-label="País de destino"
                  className="h-10 min-w-[10rem] border border-black/15 bg-white px-3 text-sm"
                />
                <div className="min-w-[200px] flex-1">
                  <CiudadCombobox
                    pais={paisDestino}
                    value={destino}
                    onChange={setDestino}
                    inputClassName="h-10 w-full border border-black/15 bg-white px-3 text-sm"
                  />
                </div>
              </div>
            </div>
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
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="Ej: 1.500.000,50"
                value={monto}
                onChange={(e) => setMonto(maskCurrencyArInput(e.target.value))}
                className="text-right tabular-nums"
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
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="Ej: 1.500.000,50"
                value={precioCliente}
                onChange={(e) => setPrecioCliente(maskCurrencyArInput(e.target.value))}
                className="text-right tabular-nums"
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
