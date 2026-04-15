import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CrudPageLayout } from '@/components/crud/CrudPageLayout';
import { CrudSubmitButton } from '@/components/crud/CrudSubmitButton';
import {
  ChoferSearchSelect,
  ClienteSearchSelect,
  TransportistaSearchSelect,
} from '@/components/forms/MaestroSearchSelects';
import { CiudadCombobox } from '@/components/forms/CiudadCombobox';
import { MonedaSelect } from '@/components/forms/MonedaSelect';
import { PaisUbicacionSelect } from '@/components/forms/PaisUbicacionSelect';
import {
  ViajeOperacionTipoFieldset,
  type ViajeOperacionModo,
} from '@/components/viajes/ViajeOperacionTipoFieldset';
import { ViajeFechaHoraFields } from '@/components/viajes/ViajeFechaHoraFields';
import { ViajeKmLitrosDialog } from '@/components/viajes/ViajeKmLitrosDialog';
import { apiJson } from '@/lib/api';
import {
  maskCurrencyForMoneda,
  parseCurrencyForMoneda,
  type ViajeMonedaCodigo,
} from '@/lib/currencyMask';
import { friendlyError } from '@/lib/friendlyError';
import {
  choferesFlotaPropia,
  flotaPropiaVehiculosListaValida,
  mantenerIdSiEnLista,
  mensajesAyudaFlotaPropia,
  vehiculoIdsDesdeRows,
  vehiculosFlotaPropia,
} from '@/lib/viajesFlota';
import {
  ViajeVehiculosLista,
  type ViajeVehiculoRowDraft,
} from '@/components/viajes/ViajeVehiculosLista';
import { esEtiquetaCiudadValida, type PaisCodigo } from '@/lib/ciudades';
import {
  estadoViajeLabel,
  tooltipEstadoViaje,
  estadoMuestraKmLitros,
  draftKmLitrosVacios,
  parseKmLitrosOpcionales,
  VIAJE_ESTADOS_ALTA,
} from '@/lib/viajesEstados';
import { fechaHoraToIso } from '@/lib/viajeFechaHora';
import { vehiculosPorTipo } from '@/lib/vehiculoTipos';
import type { Chofer, Cliente, Transportista, Vehiculo } from '@/types/api';
import { useMaestroData } from '@/hooks/useMaestroData';

const ESTADOS = VIAJE_ESTADOS_ALTA;

const fieldLabelClass =
  'text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel';

const inputClass = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';
const textareaLongClass = 'min-h-20 w-full border border-black/15 bg-white px-2 py-2 text-sm';

export function ViajeCreatePage() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tenantId = searchParams.get('tenantId')?.trim() ?? '';
  const maestro = useMaestroData();
  const [localClientes, setLocalClientes] = useState<Cliente[]>([]);
  const [localChoferes, setLocalChoferes] = useState<Chofer[]>([]);
  const [localTransportistas, setLocalTransportistas] = useState<Transportista[]>([]);
  const [localVehiculos, setLocalVehiculos] = useState<Vehiculo[]>([]);
  const [estado, setEstado] = useState<(typeof ESTADOS)[number]>('pendiente');
  const [clienteId, setClienteId] = useState('');
  const [choferId, setChoferId] = useState('');
  const [transportistaId, setTransportistaId] = useState('');
  const [modoOperacion, setModoOperacion] = useState<ViajeOperacionModo>('propio');
  const [vehiculosRows, setVehiculosRows] = useState<ViajeVehiculoRowDraft[]>([
    { tipo: 'tractor', vehiculoId: '' },
  ]);
  const [paisOrigen, setPaisOrigen] = useState<PaisCodigo>('AR');
  const [paisDestino, setPaisDestino] = useState<PaisCodigo>('AR');
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [fechaCarga, setFechaCarga] = useState('');
  const [horaCarga, setHoraCarga] = useState('');
  const [fechaDescarga, setFechaDescarga] = useState('');
  const [horaDescarga, setHoraDescarga] = useState('');
  const [detalleCarga, setDetalleCarga] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [kmRecorridos, setKmRecorridos] = useState('');
  const [litrosConsumidos, setLitrosConsumidos] = useState('');
  const [monto, setMonto] = useState('');
  const [monedaMonto, setMonedaMonto] = useState<ViajeMonedaCodigo>('ARS');
  const [precioTransportistaExterno, setPrecioTransportistaExterno] = useState('');
  const [monedaPrecioTransportista, setMonedaPrecioTransportista] =
    useState<ViajeMonedaCodigo>('ARS');
  const clientes = tenantId ? localClientes : maestro.clientes;
  const choferes = tenantId ? localChoferes : maestro.choferes;
  const transportistas = tenantId ? localTransportistas : maestro.transportistas;
  const vehiculos = tenantId ? localVehiculos : maestro.vehiculos;

  const [loading, setLoading] = useState(false);
  const [localLoadingRefs, setLocalLoadingRefs] = useState(true);
  const loadingRefs = tenantId ? localLoadingRefs : maestro.loading;
  const [refreshingFlota, setRefreshingFlota] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitBusyRef = useRef(false);
  const [kmLitrosModalOpen, setKmLitrosModalOpen] = useState(false);
  const [modalKm, setModalKm] = useState('');
  const [modalLitros, setModalLitros] = useState('');
  const [kmLitrosFieldError, setKmLitrosFieldError] = useState<string | null>(null);

  useEffect(() => {
    // Tenant mode: master data comes from MaestroDataProvider context
    if (!tenantId) return;
    let cancelled = false;
    (async () => {
      try {
        const [clientesData, choferesData, transportistasData, vehiculosData] = await Promise.all([
          apiJson<Cliente[]>(`/api/platform/clientes?tenantId=${encodeURIComponent(tenantId)}`, () => getToken()),
          apiJson<Chofer[]>(`/api/platform/choferes?tenantId=${encodeURIComponent(tenantId)}`, () => getToken()),
          apiJson<Transportista[]>(`/api/platform/transportistas?tenantId=${encodeURIComponent(tenantId)}`, () => getToken()),
          apiJson<Vehiculo[]>(`/api/platform/vehiculos?tenantId=${encodeURIComponent(tenantId)}`, () => getToken()),
        ]);
        if (!cancelled) {
          setLocalClientes(clientesData);
          setLocalChoferes(choferesData);
          setLocalTransportistas(transportistasData);
          setLocalVehiculos(vehiculosData);
        }
      } catch (e) {
        if (!cancelled) setError(friendlyError(e, 'viajes'));
      } finally {
        if (!cancelled) setLocalLoadingRefs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, tenantId]);

  async function refreshFlotaVehiculos() {
    if (refreshingFlota) return;
    setRefreshingFlota(true);
    setError(null);
    try {
      let choferesData: Chofer[];
      let vehiculosData: Vehiculo[];
      if (tenantId) {
        [choferesData, vehiculosData] = await Promise.all([
          apiJson<Chofer[]>(`/api/platform/choferes?tenantId=${encodeURIComponent(tenantId)}`, () => getToken()),
          apiJson<Vehiculo[]>(`/api/platform/vehiculos?tenantId=${encodeURIComponent(tenantId)}`, () => getToken()),
        ]);
        setLocalChoferes(choferesData);
        setLocalVehiculos(vehiculosData);
      } else {
        [choferesData, vehiculosData] = await Promise.all([
          maestro.refreshChoferes(),
          maestro.refreshVehiculos(),
        ]);
      }
      const cp = choferesFlotaPropia(choferesData);
      const vp = vehiculosFlotaPropia(vehiculosData);
      setChoferId((prev) => mantenerIdSiEnLista(prev, cp));
      setVehiculosRows((rows) =>
        rows.map((row) => {
          const candidatos = vehiculosPorTipo(vp, row.tipo);
          return {
            ...row,
            vehiculoId: mantenerIdSiEnLista(row.vehiculoId, candidatos),
          };
        }),
      );
    } catch (e) {
      setError(friendlyError(e, 'viajes'));
    } finally {
      setRefreshingFlota(false);
    }
  }

  const choferesPropios = useMemo(() => choferesFlotaPropia(choferes), [choferes]);
  const vehiculosPropios = useMemo(() => vehiculosFlotaPropia(vehiculos), [vehiculos]);
  const ayudaFlota = useMemo(
    () => mensajesAyudaFlotaPropia(choferes, vehiculos),
    [choferes, vehiculos],
  );

  useEffect(() => {
    if (modoOperacion !== 'propio') return;
    setChoferId((prev) => mantenerIdSiEnLista(prev, choferesPropios));
  }, [modoOperacion, choferesPropios]);

  function applyModoOperacion(m: ViajeOperacionModo) {
    setModoOperacion(m);
    if (m === 'externo') {
      setChoferId('');
      setVehiculosRows([]);
    } else {
      setTransportistaId('');
      setChoferId('');
      setVehiculosRows([{ tipo: 'tractor', vehiculoId: '' }]);
    }
  }

  async function onSubmit(opts?: { kmLitrosFromModal?: boolean; km?: number; litros?: number }) {
    if (submitBusyRef.current) return;
    if (!clienteId) {
      setError('Seleccioná un cliente.');
      return;
    }
    const externo = modoOperacion === 'externo';
    if (externo && !transportistaId.trim()) {
      setError('Seleccioná un transportista externo.');
      return;
    }
    const vids = vehiculoIdsDesdeRows(vehiculosRows);
    if (!externo && vids.length === 0) {
      setError('Agregá al menos un vehículo al viaje (tipo y patente desde el maestro).');
      return;
    }
    if (
      !externo &&
      !flotaPropiaVehiculosListaValida(choferId, vids, choferesPropios, vehiculosPropios)
    ) {
      setError('En flota propia, elegí chofer y vehículos de las listas (si no aparecen, cargá la página).');
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
    const montoNum = parseCurrencyForMoneda(monto, monedaMonto);
    if (montoNum == null || montoNum < 0.01) {
      setError('Ingresá un monto a facturar mayor a 0.');
      return;
    }
    if (
      !opts?.kmLitrosFromModal &&
      estadoMuestraKmLitros(estado) &&
      draftKmLitrosVacios(kmRecorridos, litrosConsumidos)
    ) {
      setModalKm(kmRecorridos);
      setModalLitros(litrosConsumidos);
      setKmLitrosFieldError(null);
      setKmLitrosModalOpen(true);
      return;
    }
    const kmNum = opts?.kmLitrosFromModal
      ? opts.km
      : kmRecorridos.trim()
        ? Number(kmRecorridos.replace(',', '.'))
        : undefined;
    const litNum = opts?.kmLitrosFromModal
      ? opts.litros
      : litrosConsumidos.trim()
        ? Number(litrosConsumidos.replace(',', '.'))
        : undefined;
    submitBusyRef.current = true;
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
                vehiculoIds: [],
              }
            : {
                transportistaId: null,
                choferId,
                vehiculoIds: vids,
              }),
          origen: origen.trim(),
          destino: destino.trim(),
          fechaCarga: fechaHoraToIso(fechaCarga, horaCarga),
          fechaDescarga: fechaHoraToIso(fechaDescarga, horaDescarga),
          detalleCarga: detalleCarga.trim() || undefined,
          observaciones: observaciones.trim() || undefined,
          kmRecorridos:
            kmNum !== undefined && Number.isFinite(kmNum) ? kmNum : undefined,
          litrosConsumidos:
            litNum !== undefined && Number.isFinite(litNum) ? litNum : undefined,
          monto: montoNum,
          monedaMonto,
          precioTransportistaExterno: parseCurrencyForMoneda(
            precioTransportistaExterno,
            monedaPrecioTransportista,
          ),
          monedaPrecioTransportistaExterno: monedaPrecioTransportista,
        }),
      });
      navigate('/viajes', { replace: true });
    } catch (e) {
      setError(friendlyError(e, 'viajes'));
    } finally {
      submitBusyRef.current = false;
      setLoading(false);
    }
  }

  function confirmKmLitrosModalCreate() {
    const p = parseKmLitrosOpcionales(modalKm, modalLitros);
    if (!p.ok) {
      setKmLitrosFieldError(p.message);
      return;
    }
    setKmLitrosModalOpen(false);
    setKmLitrosFieldError(null);
    if (p.km !== undefined) setKmRecorridos(String(p.km));
    if (p.litros !== undefined) setLitrosConsumidos(String(p.litros));
    void onSubmit({ kmLitrosFromModal: true, km: p.km, litros: p.litros });
  }

  return (
    <CrudPageLayout
      title="Crear viaje"
      backTo="/viajes"
      backLabel="← Volver a viajes"
    >
      {loadingRefs ? (
        <p className="mt-6 text-vialto-steel">Cargando referencias…</p>
      ) : (
        <form
          autoComplete="off"
          className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <div className="flex flex-col gap-1">
            <span className={fieldLabelClass}>Estado</span>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value as (typeof ESTADOS)[number])}
              className={inputClass}
            >
              {ESTADOS.map((x) => (
                <option key={x} value={x} title={tooltipEstadoViaje(x)}>
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
                  disableBrowserAutocomplete
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
                  disableBrowserAutocomplete
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:col-span-2 lg:col-span-3">
            <div className="flex flex-col gap-1">
              <span className={fieldLabelClass}>Cliente</span>
              <ClienteSearchSelect
                clientes={clientes}
                value={clienteId}
                onChange={setClienteId}
                inputClassName={inputClass}
                aria-label="Cliente"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className={fieldLabelClass}>Monto a facturar</span>
              <div className="flex min-w-0 gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={monto}
                  onChange={(e) =>
                    setMonto(maskCurrencyForMoneda(e.target.value, monedaMonto))
                  }
                  placeholder={monedaMonto === 'USD' ? 'Ej. 12,500.50' : 'Ej. 1.500.000,50'}
                  className={`min-w-0 flex-1 ${inputClass} text-right tabular-nums`}
                />
                <MonedaSelect
                  value={monedaMonto}
                  onChange={(m) => {
                    setMonedaMonto(m);
                    setMonto('');
                  }}
                  aria-label="Moneda monto a facturar"
                />
              </div>
            </div>
          </div>
          <ViajeOperacionTipoFieldset
            modo={modoOperacion}
            onModoChange={applyModoOperacion}
            externoContent={
              <div className="grid gap-2">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className={fieldLabelClass}>Transportista externo</span>
                    <TransportistaSearchSelect
                      transportistas={transportistas}
                      value={transportistaId}
                      onChange={setTransportistaId}
                      inputClassName={inputClass}
                      aria-label="Transportista externo"
                    />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className={fieldLabelClass}>Precio transportista externo</span>
                    <div className="flex min-w-0 gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={precioTransportistaExterno}
                        onChange={(e) =>
                          setPrecioTransportistaExterno(
                            maskCurrencyForMoneda(e.target.value, monedaPrecioTransportista),
                          )
                        }
                        placeholder={
                          monedaPrecioTransportista === 'USD'
                            ? 'Ej. 8,500.00'
                            : 'Ej. 1.200.000,50'
                        }
                        className={`min-w-0 flex-1 ${inputClass} text-right tabular-nums`}
                      />
                      <MonedaSelect
                        value={monedaPrecioTransportista}
                        onChange={(m) => {
                          setMonedaPrecioTransportista(m);
                          setPrecioTransportistaExterno('');
                        }}
                        aria-label="Moneda precio transportista externo"
                      />
                    </div>
                  </div>
                </div>
              </div>
            }
            propioContent={
              <div className="grid gap-3">
                <div className="flex min-w-0 flex-col gap-1 max-w-md">
                  <span className={fieldLabelClass}>Chofer (flota propia)</span>
                  <ChoferSearchSelect
                    choferes={choferesPropios}
                    value={choferId}
                    onChange={setChoferId}
                    inputClassName={inputClass}
                    aria-label="Chofer flota propia"
                  />
                  {ayudaFlota.chofer && (
                    <p className="text-xs text-amber-800/90">{ayudaFlota.chofer}</p>
                  )}
                </div>
                <ViajeVehiculosLista
                  groupId="viaje-create"
                  crearVehiculoHref="/vehiculos/nuevo"
                  rows={vehiculosRows}
                  onChange={setVehiculosRows}
                  vehiculos={vehiculosPropios}
                  onRefreshVehiculos={() => void refreshFlotaVehiculos()}
                  refreshingVehiculos={refreshingFlota}
                />
                {ayudaFlota.vehiculo && (
                  <p className="text-xs text-amber-800/90">{ayudaFlota.vehiculo}</p>
                )}
              </div>
            }
          />
          <ViajeFechaHoraFields
            fechaCarga={fechaCarga}
            horaCarga={horaCarga}
            fechaDescarga={fechaDescarga}
            horaDescarga={horaDescarga}
            onPatch={(p) => {
              if (p.fechaCarga !== undefined) setFechaCarga(p.fechaCarga);
              if (p.horaCarga !== undefined) setHoraCarga(p.horaCarga);
              if (p.fechaDescarga !== undefined) setFechaDescarga(p.fechaDescarga);
              if (p.horaDescarga !== undefined) setHoraDescarga(p.horaDescarga);
            }}
            labelClassName={fieldLabelClass}
            inputClassName={inputClass}
          />
          {estadoMuestraKmLitros(estado) && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:col-span-2 lg:col-span-3">
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
            </div>
          )}
          <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-3">
            <span className={fieldLabelClass}>Detalle de carga</span>
            <textarea
              value={detalleCarga}
              onChange={(e) => setDetalleCarga(e.target.value)}
              placeholder="Ej. producto, bultos, temperatura, notas sobre la carga"
              className={textareaLongClass}
            />
          </div>
          <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-3">
            <span className={fieldLabelClass}>Observaciones</span>
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Notas adicionales"
              className={textareaLongClass}
            />
          </div>

          {error && (
            <div className="md:col-span-2 lg:col-span-3">
              <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
                {error}
              </p>
            </div>
          )}
          <div className="md:col-span-2 lg:col-span-3 pt-2">
            <CrudSubmitButton
              loading={loading}
              label="Crear viaje"
              disableWhileLoading={false}
            />
          </div>
        </form>
      )}
      <ViajeKmLitrosDialog
        open={kmLitrosModalOpen}
        title="Km y litros del viaje"
        km={modalKm}
        litros={modalLitros}
        error={kmLitrosFieldError}
        busy={loading}
        onKmChange={setModalKm}
        onLitrosChange={setModalLitros}
        onConfirm={confirmKmLitrosModalCreate}
        onCancel={() => {
          setKmLitrosModalOpen(false);
          setKmLitrosFieldError(null);
        }}
      />
    </CrudPageLayout>
  );
}
