import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CrudPageLayout } from '@/components/crud/CrudPageLayout';
import { CrudSubmitButton } from '@/components/crud/CrudSubmitButton';
import { CiudadCombobox } from '@/components/forms/CiudadCombobox';
import { PaisUbicacionSelect } from '@/components/forms/PaisUbicacionSelect';
import {
  ViajeOperacionTipoFieldset,
  type ViajeOperacionModo,
} from '@/components/viajes/ViajeOperacionTipoFieldset';
import { apiJson } from '@/lib/api';
import { maskCurrencyArInput, parseCurrencyAr } from '@/lib/currencyMask';
import { friendlyError } from '@/lib/friendlyError';
import { esEtiquetaCiudadValida, type PaisCodigo } from '@/lib/ciudades';
import { estadoViajeLabel } from '@/lib/viajesEstados';
import type { Chofer, Cliente, Transportista, Vehiculo } from '@/types/api';

const ESTADOS = ['pendiente', 'en_curso', 'finalizado', 'cancelado'] as const;

const fieldLabelClass =
  'text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel';

const inputClass = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';

export function ViajeCreatePage() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenantId')?.trim() ?? '';
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [choferes, setChoferes] = useState<Chofer[]>([]);
  const [transportistas, setTransportistas] = useState<Transportista[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
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
  const [fechaSalida, setFechaSalida] = useState('');
  const [fechaLlegada, setFechaLlegada] = useState('');
  const [mercaderia, setMercaderia] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [kmRecorridos, setKmRecorridos] = useState('');
  const [litrosConsumidos, setLitrosConsumidos] = useState('');
  const [monto, setMonto] = useState('');
  const [precioCliente, setPrecioCliente] = useState('');
  const [precioTransportistaExterno, setPrecioTransportistaExterno] = useState('');
  const [documentacionCsv, setDocumentacionCsv] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingRefs, setLoadingRefs] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
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
        const [clientesData, choferesData, transportistasData, vehiculosData] = await Promise.all([
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
          if (clientesData.length > 0) setClienteId(clientesData[0].id);
          if (choferesData.length > 0) setChoferId(choferesData[0].id);
        }
      } catch (e) {
        if (!cancelled) setError(friendlyError(e, 'viajes'));
      } finally {
        if (!cancelled) setLoadingRefs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, tenantId]);

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

  async function onSubmit() {
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
    if (!patenteTractor.trim() || !patenteSemirremolque.trim()) {
      setError('Completá patente de tractor y semirremolque.');
      return;
    }
    if (!origen.trim() || !destino.trim()) {
      setError('Completá origen y destino.');
      return;
    }
    const [okOrigen, okDestino] = await Promise.all([
      esEtiquetaCiudadValida(paisOrigen, origen),
      esEtiquetaCiudadValida(paisDestino, destino),
    ]);
    if (!okOrigen || !okDestino) {
      setError('Origen y destino deben elegirse de la lista de ciudades (no se admite texto libre).');
      return;
    }
    if (!fechaCarga || !fechaDescarga) {
      setError('Completá fecha de carga y fecha de descarga.');
      return;
    }
    if (!mercaderia.trim()) {
      setError('Ingresá la descripción de mercadería.');
      return;
    }
    if (!observaciones.trim()) {
      setError('Ingresá observaciones.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const path = tenantId
        ? `/api/platform/viajes?tenantId=${encodeURIComponent(tenantId)}`
        : '/api/viajes';
      await apiJson(path, () => getToken(), {
        method: 'POST',
        body: JSON.stringify({
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
          origen: origen.trim(),
          destino: destino.trim(),
          fechaCarga: new Date(fechaCarga).toISOString(),
          fechaDescarga: new Date(fechaDescarga).toISOString(),
          fechaSalida: fechaSalida ? new Date(fechaSalida).toISOString() : undefined,
          fechaLlegada: fechaLlegada ? new Date(fechaLlegada).toISOString() : undefined,
          mercaderia: mercaderia.trim(),
          observaciones: observaciones.trim(),
          kmRecorridos: kmRecorridos.trim() ? Number(kmRecorridos) : undefined,
          litrosConsumidos: litrosConsumidos.trim() ? Number(litrosConsumidos) : undefined,
          monto: parseCurrencyAr(monto),
          precioCliente: parseCurrencyAr(precioCliente),
          precioTransportistaExterno: parseCurrencyAr(precioTransportistaExterno),
          documentacion: documentacionCsv
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });
      navigate('/viajes', { replace: true });
    } catch (e) {
      setError(friendlyError(e, 'viajes'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <CrudPageLayout
      title="Crear viaje"
      backTo="/viajes"
      backLabel="← Volver a viajes"
      error={error}
    >
      {loadingRefs ? (
        <p className="mt-6 text-vialto-steel">Cargando referencias…</p>
      ) : (
        <form
          className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <p className="text-sm text-vialto-steel md:col-span-2 lg:col-span-3">
            El número de viaje se asigna automáticamente al guardar (formato año-correlativo).
          </p>

          <div className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Estado</span>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value as (typeof ESTADOS)[number])}
              className={inputClass}
            >
              {ESTADOS.map((x) => (
                <option key={x} value={x}>
                  {estadoViajeLabel[x] ?? x}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Origen</span>
            <div className="flex flex-wrap gap-2 items-start">
              <PaisUbicacionSelect
                value={paisOrigen}
                onChange={(p) => {
                  setPaisOrigen(p);
                  setOrigen('');
                }}
                aria-label="País de origen"
              />
              <div className="min-w-[200px] flex-1">
                <CiudadCombobox
                  pais={paisOrigen}
                  value={origen}
                  onChange={setOrigen}
                  inputClassName={inputClass}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Destino</span>
            <div className="flex flex-wrap gap-2 items-start">
              <PaisUbicacionSelect
                value={paisDestino}
                onChange={(p) => {
                  setPaisDestino(p);
                  setDestino('');
                }}
                aria-label="País de destino"
              />
              <div className="min-w-[200px] flex-1">
                <CiudadCombobox
                  pais={paisDestino}
                  value={destino}
                  onChange={setDestino}
                  inputClassName={inputClass}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Monto</span>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={monto}
              onChange={(e) => setMonto(maskCurrencyArInput(e.target.value))}
              placeholder="Ej. 1.500.000,50"
              className={`${inputClass} text-right tabular-nums`}
            />
          </div>
          <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-3">
            <span className={fieldLabelClass}>Cliente</span>
            <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={inputClass}>
              {clientes.length === 0 && <option value="">Sin clientes</option>}
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
          <ViajeOperacionTipoFieldset
            modo={modoOperacion}
            onModoChange={applyModoOperacion}
            externoContent={
              <>
                <div className="flex flex-col gap-1">
                  <span className={fieldLabelClass}>Transportista externo</span>
                  <select
                    value={transportistaId}
                    onChange={(e) => setTransportistaId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Elegí un transportista…</option>
                    {transportistas.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1 pt-2">
                  <span className={fieldLabelClass}>Precio transportista externo</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={precioTransportistaExterno}
                    onChange={(e) => setPrecioTransportistaExterno(maskCurrencyArInput(e.target.value))}
                    placeholder="Ej. 1.200.000,50"
                    className={`${inputClass} text-right tabular-nums`}
                  />
                </div>
              </>
            }
            propioContent={
              <>
                <div className="flex flex-col gap-1">
                  <span className={fieldLabelClass}>Chofer</span>
                  <select
                    value={choferId}
                    onChange={(e) => setChoferId(e.target.value)}
                    className={inputClass}
                  >
                    {choferes.length === 0 && <option value="">Sin choferes</option>}
                    {choferes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1 pt-2">
                  <span className={fieldLabelClass}>Vehículo</span>
                  <select
                    value={vehiculoId}
                    onChange={(e) => setVehiculoId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Elegí un vehículo…</option>
                    {vehiculos.map((vh) => (
                      <option key={vh.id} value={vh.id}>
                        {vh.patente}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            }
          />
          <div className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Patente tractor</span>
            <input
              value={patenteTractor}
              onChange={(e) => setPatenteTractor(e.target.value)}
              placeholder="Ej. AA123BB"
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Patente semirremolque</span>
            <input
              value={patenteSemirremolque}
              onChange={(e) => setPatenteSemirremolque(e.target.value)}
              placeholder="Ej. AA456CC"
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Fecha de carga</span>
            <input
              type="datetime-local"
              value={fechaCarga}
              onChange={(e) => setFechaCarga(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Fecha de descarga</span>
            <input
              type="datetime-local"
              value={fechaDescarga}
              onChange={(e) => setFechaDescarga(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Fecha de salida</span>
            <input
              type="datetime-local"
              value={fechaSalida}
              onChange={(e) => setFechaSalida(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Fecha de llegada</span>
            <input
              type="datetime-local"
              value={fechaLlegada}
              onChange={(e) => setFechaLlegada(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Mercadería</span>
            <input
              value={mercaderia}
              onChange={(e) => setMercaderia(e.target.value)}
              placeholder="Descripción de la carga"
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Observaciones</span>
            <input
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Notas adicionales"
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Km recorridos</span>
            <input
              type="number"
              value={kmRecorridos}
              onChange={(e) => setKmRecorridos(e.target.value)}
              placeholder="0"
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Litros consumidos</span>
            <input
              type="number"
              value={litrosConsumidos}
              onChange={(e) => setLitrosConsumidos(e.target.value)}
              placeholder="0"
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Precio cliente</span>
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={precioCliente}
              onChange={(e) => setPrecioCliente(maskCurrencyArInput(e.target.value))}
              placeholder="Ej. 1.500.000,50"
              className={`${inputClass} text-right tabular-nums`}
            />
          </div>
          <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-3">
            <span className={fieldLabelClass}>Documentación</span>
            <textarea
              value={documentacionCsv}
              onChange={(e) => setDocumentacionCsv(e.target.value)}
              placeholder="URLs separadas por coma"
              className="min-h-20 border border-black/15 bg-white px-2 py-2 text-sm"
            />
          </div>

          <div className="md:col-span-2 lg:col-span-3 pt-2">
            <CrudSubmitButton loading={loading} label="Crear viaje" />
          </div>
        </form>
      )}
    </CrudPageLayout>
  );
}
