import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CrudFieldError } from '@/components/crud/CrudFieldError';
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
import { ViajeProductosLista } from '@/components/viajes/ViajeProductosLista';
import { ViajeDestinosLista } from '@/components/viajes/ViajeDestinosLista';
import {
  ViajeGananciaBrutaManualFieldset,
  gananciaBrutaManualPayloadFromDraft,
} from '@/components/viajes/ViajeGananciaBrutaManualFieldset';
import { draftRequiereGananciaBrutaManual } from '@/lib/viajesGananciaBruta';
import {
  OtrosGastosFieldset,
  emptyOtroGasto,
  otroGastoDraftToApi,
  type OtroGastoDraft,
} from '@/components/viajes/OtrosGastosFieldset';
import {
  PagosTransportistaFieldset,
  emptyPagoTransportista,
  pagoTransportistaDraftToApi,
  type PagoTransportistaDraft,
} from '@/components/viajes/PagosTransportistaFieldset';
import { apiJson } from '@/lib/api';
import {
  parseCurrencyForMoneda,
  preserveAmountOnMonedaChange,
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
  mensajeErrorTransportistaEfectivoExterno,
} from '@/lib/viajesFlota';
import {
  ViajeVehiculosLista,
  type ViajeVehiculoRowDraft,
} from '@/components/viajes/ViajeVehiculosLista';
import { vehiculosPorTipo } from '@/lib/vehiculoTipos';
import { ClienteModal } from '@/components/viajes/ClienteModal';
import { TransportistaModal } from '@/components/viajes/TransportistaModal';
import { ChoferModal } from '@/components/viajes/ChoferModal';
import { esEtiquetaCiudadValida, type PaisCodigo } from '@/lib/ciudades';
import {
  destinosPayloadParaApi,
  emptyDestinoRow,
  validarDestinosRows,
  type ViajeDestinoRowDraft,
} from '@/lib/viajesDestinos';
import {
  estadoViajeLabel,
  tooltipEstadoViaje,
  estadoMuestraKmLitros,
  draftKmLitrosVacios,
  parseKmLitrosOpcionales,
  VIAJE_ESTADOS_ALTA,
} from '@/lib/viajesEstados';
import { fechaHoraToIso } from '@/lib/viajeFechaHora';
import type { Chofer, Cliente, Producto, Transportista, Vehiculo } from '@/types/api';
import { useMaestroData } from '@/hooks/useMaestroData';
import { type OpcionProducto, type ViajeProductoItem } from '@/lib/productosViaje';

const ESTADOS = VIAJE_ESTADOS_ALTA;

const fieldLabelClass =
  'text-sm font-[family-name:var(--font-ui)] uppercase tracking-[0.08em] text-vialto-steel';

const inputClass = 'h-9 w-full border border-black/15 bg-white px-2 text-sm';
const textareaLongClass = 'min-h-20 w-full border border-black/15 bg-white px-2 py-2 text-sm';

export function ViajeCreatePage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
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
  const [realizaFlete, setRealizaFlete] = useState(true);
  const [transportistaEfectivoId, setTransportistaEfectivoId] = useState('');
  const [transportistaEfectivoError, setTransportistaEfectivoError] = useState<string | null>(null);
  const [modoOperacion, setModoOperacion] = useState<ViajeOperacionModo>('externo');
  const [vehiculosRows, setVehiculosRows] = useState<ViajeVehiculoRowDraft[]>([]);
  const [vehiculosExternosRows, setVehiculosExternosRows] = useState<ViajeVehiculoRowDraft[]>([]);
  const [choferExternoId, setChoferExternoId] = useState('');
  const [paisOrigen, setPaisOrigen] = useState<PaisCodigo>('AR');
  const [origen, setOrigen] = useState('');
  const [destinosRows, setDestinosRows] = useState<ViajeDestinoRowDraft[]>([emptyDestinoRow()]);
  const [fechaCarga, setFechaCarga] = useState('');
  const [horaCarga, setHoraCarga] = useState('');
  const [fechaDescarga, setFechaDescarga] = useState('');
  const [horaDescarga, setHoraDescarga] = useState('');
  const [fechaCargaError, setFechaCargaError] = useState<string | null>(null);
  const [fechaDescargaError, setFechaDescargaError] = useState<string | null>(null);
  const [productosCatalogo, setProductosCatalogo] = useState<Producto[]>([]);
  const [productoItems, setProductoItems] = useState<ViajeProductoItem[]>([]);
  const [detalleCarga, setDetalleCarga] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [kmRecorridos, setKmRecorridos] = useState('');
  const [litrosConsumidos, setLitrosConsumidos] = useState('');
  const [monto, setMonto] = useState('');
  const [monedaMonto, setMonedaMonto] = useState<ViajeMonedaCodigo>('ARS');
  const [precioTransportistaExterno, setPrecioTransportistaExterno] = useState('');
  const [monedaPrecioTransportista, setMonedaPrecioTransportista] =
    useState<ViajeMonedaCodigo>('ARS');
  const [gananciaBrutaManual, setGananciaBrutaManual] = useState('');
  const [monedaGananciaBrutaManual, setMonedaGananciaBrutaManual] =
    useState<ViajeMonedaCodigo>('ARS');
  const [otrosGastos, setOtrosGastos] = useState<OtroGastoDraft[]>([]);
  const [pagosTransportista, setPagosTransportista] = useState<PagoTransportistaDraft[]>([]);

  type QuickCreate = 'cliente' | 'transportista' | 'chofer-ext' | 'chofer-prop';
  const [quickCreate, setQuickCreate] = useState<QuickCreate | null>(null);
  const [sessionClientes, setSessionClientes] = useState<Cliente[]>([]);
  const [sessionTransportistas, setSessionTransportistas] = useState<Transportista[]>([]);
  const [sessionChoferes, setSessionChoferes] = useState<Chofer[]>([]);
  const [sessionVehiculos, setSessionVehiculos] = useState<Vehiculo[]>([]);

  const clientes = useMemo(() => {
    const base = tenantId ? localClientes : maestro.clientes;
    const ids = new Set(base.map((c) => c.id));
    return [...base, ...sessionClientes.filter((c) => !ids.has(c.id))];
  }, [tenantId, localClientes, maestro.clientes, sessionClientes]);

  const choferes = useMemo(() => {
    const base = tenantId ? localChoferes : maestro.choferes;
    const ids = new Set(base.map((c) => c.id));
    return [...base, ...sessionChoferes.filter((c) => !ids.has(c.id))];
  }, [tenantId, localChoferes, maestro.choferes, sessionChoferes]);

  const transportistas = useMemo(() => {
    const base = tenantId ? localTransportistas : maestro.transportistas;
    const ids = new Set(base.map((t) => t.id));
    return [...base, ...sessionTransportistas.filter((t) => !ids.has(t.id))];
  }, [tenantId, localTransportistas, maestro.transportistas, sessionTransportistas]);

  const vehiculos = useMemo(() => {
    const base = tenantId ? localVehiculos : maestro.vehiculos;
    const ids = new Set(base.map((v) => v.id));
    return [...base, ...sessionVehiculos.filter((v) => !ids.has(v.id))];
  }, [tenantId, localVehiculos, maestro.vehiculos, sessionVehiculos]);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const path = tenantId
          ? `/api/platform/stock/productos/paginated?tenantId=${encodeURIComponent(tenantId)}&page=1&pageSize=100&filtroActivo=activos`
          : '/api/stock/productos/paginated?page=1&pageSize=100&filtroActivo=activos';
        const d = await apiJson<{ items: Producto[] }>(path, () => getToken());
        if (!cancelled) setProductosCatalogo(d.items);
      } catch {
        if (!cancelled) setProductosCatalogo([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, tenantId]);

  async function refreshVehiculosMaestro() {
    if (refreshingFlota) return;
    setRefreshingFlota(true);
    setError(null);
    try {
      let vehiculosData: Vehiculo[];
      if (tenantId) {
        vehiculosData = await apiJson<Vehiculo[]>(
          `/api/platform/vehiculos?tenantId=${encodeURIComponent(tenantId)}`,
          () => getToken(),
        );
        setLocalVehiculos(vehiculosData);
      } else {
        vehiculosData = await maestro.refreshVehiculos();
      }
      setVehiculosExternosRows((rows) =>
        rows.map((row) => {
          const candidatos = vehiculosPorTipo(vehiculosData, row.tipo);
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
      setVehiculosExternosRows([]);
    } else {
      setTransportistaId('');
      setRealizaFlete(true);
      setTransportistaEfectivoId('');
      setChoferExternoId('');
      setVehiculosExternosRows([]);
      setChoferId('');
      setVehiculosRows([{ tipo: 'tractor', vehiculoId: '' }]);
      setPagosTransportista([]);
    }
  }

  async function onSubmit(opts?: { kmLitrosFromModal?: boolean; km?: number; litros?: number }) {
    if (submitBusyRef.current) return;
    const externo = modoOperacion === 'externo';
    const errs: Record<string, string> = {};
    if (!clienteId) errs.clienteId = 'Seleccioná un cliente.';
    if (externo && !transportistaId.trim()) errs.transportistaId = 'Seleccioná un transportista externo.';
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    setFieldErrors({});
    const teErr = mensajeErrorTransportistaEfectivoExterno({
      operacionModo: modoOperacion,
      transportistaId,
      realizaFlete,
      transportistaEfectivoId,
    });
    if (teErr) {
      setTransportistaEfectivoError(teErr);
      setError(teErr);
      return;
    }
    setTransportistaEfectivoError(null);
    const vids = externo
      ? vehiculoIdsDesdeRows(vehiculosExternosRows)
      : vehiculoIdsDesdeRows(vehiculosRows);
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
    if (!origen.trim()) {
      setError('Completá el origen.');
      return;
    }
    const okOrigen = await esEtiquetaCiudadValida(paisOrigen, origen);
    if (!okOrigen) {
      setError('El origen debe elegirse de la lista de ciudades (no se admite texto libre).');
      return;
    }
    const destinosVal = await validarDestinosRows(destinosRows);
    if (!destinosVal.ok) {
      setError(destinosVal.message);
      return;
    }
    const fcError = !fechaCarga.trim() ? 'Ingresá la fecha de carga.' : null;
    const fdError = !fechaDescarga.trim() ? 'Ingresá la fecha de descarga.' : null;
    setFechaCargaError(fcError);
    setFechaDescargaError(fdError);
    if (fcError || fdError) return;
    if (fechaDescarga < fechaCarga) {
      setFechaDescargaError('La fecha de descarga no puede ser anterior a la de carga.');
      return;
    }

    const montoNum = parseCurrencyForMoneda(monto, monedaMonto);
    if (montoNum == null || montoNum < 0.01) {
      setError('Ingresá un monto a facturar mayor a 0.');
      return;
    }
    const gananciaDraft = {
      operacionModo: modoOperacion,
      monto,
      monedaMonto,
      precioTransportistaExterno,
      monedaPrecioTransportistaExterno: monedaPrecioTransportista,
      gananciaBrutaManual,
      monedaGananciaBrutaManual,
      otrosGastos,
    };
    if (draftRequiereGananciaBrutaManual(gananciaDraft)) {
      const manualPayload = gananciaBrutaManualPayloadFromDraft(gananciaDraft);
      if (manualPayload.gananciaBrutaManual == null) {
        setError(
          'Ingresá la ganancia bruta manual: las monedas de facturación y del transportista son distintas.',
        );
        return;
      }
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
                contratanteRealizaFlete: realizaFlete,
                transportistaEfectivoId: realizaFlete ? null : transportistaEfectivoId.trim() || null,
                choferId: choferExternoId.trim() || null,
                vehiculoIds: vids,
              }
            : {
                transportistaId: null,
                transportistaEfectivoId: null,
                choferId,
                vehiculoIds: vids,
              }),
          origen: origen.trim(),
          ...destinosPayloadParaApi(destinosVal.destinos),
          fechaCarga: fechaHoraToIso(fechaCarga, horaCarga),
          fechaDescarga: fechaHoraToIso(fechaDescarga, horaDescarga),
          productoItems: productoItems.filter((x) => x.productoId.trim()),
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
          ...gananciaBrutaManualPayloadFromDraft(gananciaDraft),
          otrosGastos: otrosGastos.map(otroGastoDraftToApi).filter(Boolean),
          pagosTransportista: pagosTransportista.map(pagoTransportistaDraftToApi).filter(Boolean),
        }),
      });
      navigate(`/viajes${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''}`, { replace: true });
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
    <>
    <CrudPageLayout
      title="Crear viaje"
      backTo={`/viajes${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ''}`}
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
          <ViajeDestinosLista
            groupId="viaje-create"
            rows={destinosRows}
            onChange={setDestinosRows}
            inputClassName={inputClass}
            disableBrowserAutocomplete
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:col-span-2 lg:col-span-3">
            <div className="flex flex-col gap-1">
              <span className={fieldLabelClass}>Cliente <span className="text-red-500">*</span></span>
              <ClienteSearchSelect
                clientes={clientes}
                value={clienteId}
                onChange={(id) => { setClienteId(id); if (id) setFieldErrors((p) => ({ ...p, clienteId: '' })); }}
                inputClassName={inputClass}
                aria-label="Cliente"
                onNuevo={() => setQuickCreate('cliente')}
              />
              <CrudFieldError message={fieldErrors.clienteId} />
            </div>
            <div className="flex flex-col gap-1">
              <span className={fieldLabelClass}>Monto a facturar</span>
              <div className="flex min-w-0 gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  placeholder="0.00"
                  className={`min-w-0 flex-1 ${inputClass} text-right tabular-nums`}
                />
                <MonedaSelect
                  value={monedaMonto}
                  onChange={(m) => {
                    setMonto((prev) => preserveAmountOnMonedaChange(prev, monedaMonto, m));
                    setMonedaMonto(m);
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
              <div className="grid gap-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className={fieldLabelClass}>Transportista externo <span className="text-red-500">*</span></span>
                    <TransportistaSearchSelect
                      transportistas={transportistas}
                      value={transportistaId}
                      onChange={(id) => {
                        setTransportistaId(id);
                        setRealizaFlete(true);
                        setTransportistaEfectivoId('');
                        if (id) setFieldErrors((p) => ({ ...p, transportistaId: '' }));
                      }}
                      inputClassName={inputClass}
                      aria-label="Transportista externo"
                      onNuevo={() => setQuickCreate('transportista')}
                    />
                    <CrudFieldError message={fieldErrors.transportistaId} />
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className={fieldLabelClass}>Precio transporte</span>
                    <div className="flex min-w-0 gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={precioTransportistaExterno}
                        onChange={(e) => setPrecioTransportistaExterno(e.target.value)}
                        placeholder="0.00"
                        className={`min-w-0 flex-1 ${inputClass} text-right tabular-nums`}
                      />
                      <MonedaSelect
                        value={monedaPrecioTransportista}
                        onChange={(m) => {
                          setPrecioTransportistaExterno((prev) =>
                            preserveAmountOnMonedaChange(prev, monedaPrecioTransportista, m),
                          );
                          setMonedaPrecioTransportista(m);
                        }}
                        aria-label="Moneda precio transportista externo"
                      />
                    </div>
                  </div>
                </div>
                {transportistaId && (
                  <div className="flex flex-col gap-2 rounded border border-black/10 bg-vialto-mist/40 px-3 py-3">
                    <span className={fieldLabelClass}>¿El transportista seleccionado realiza el flete?</span>
                    <div className="flex gap-5">
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="realiza-flete-create"
                          checked={realizaFlete}
                          onChange={() => {
                            setTransportistaEfectivoError(null);
                            setRealizaFlete(true);
                            setTransportistaEfectivoId('');
                          }}
                          className="accent-vialto-charcoal"
                        />
                        Sí
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="realiza-flete-create"
                          checked={!realizaFlete}
                          onChange={() => {
                            setTransportistaEfectivoError(null);
                            setRealizaFlete(false);
                          }}
                          className="accent-vialto-charcoal"
                        />
                        No
                      </label>
                    </div>
                    {!realizaFlete && (
                      <div className="flex min-w-0 flex-col gap-1 mt-1">
                        <span className={fieldLabelClass}>
                          Transportista que realiza el flete{' '}
                          <span className="text-red-500">*</span>
                        </span>
                        <TransportistaSearchSelect
                          transportistas={transportistas.filter((t) => t.id !== transportistaId)}
                          value={transportistaEfectivoId}
                          onChange={(id) => {
                            setTransportistaEfectivoError(null);
                            setTransportistaEfectivoId(id);
                          }}
                          inputClassName={`${inputClass}${
                            transportistaEfectivoError ? ' border-red-400' : ''
                          }`}
                          aria-label="Transportista que realiza el flete"
                          onNuevo={() => setQuickCreate('transportista')}
                        />
                        {transportistaEfectivoError && (
                          <span className="text-xs text-red-600">{transportistaEfectivoError}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div className="grid gap-3">
                  <div className="flex min-w-0 flex-col gap-1 max-w-md">
                    <span className={fieldLabelClass}>Chofer</span>
                    <ChoferSearchSelect
                      choferes={choferes}
                      value={choferExternoId}
                      onChange={setChoferExternoId}
                      inputClassName={inputClass}
                      aria-label="Chofer transportista externo"
                      onNuevo={() => setQuickCreate('chofer-ext')}
                    />
                  </div>
                  <ViajeVehiculosLista
                    groupId="viaje-create-ext"
                    crearVehiculoHref={
                      tenantId
                        ? `/vehiculos/nuevo?tenantId=${encodeURIComponent(tenantId)}`
                        : '/vehiculos/nuevo'
                    }
                    rows={vehiculosExternosRows}
                    onChange={setVehiculosExternosRows}
                    vehiculos={vehiculos}
                    alMenosUno={false}
                    onRefreshVehiculos={() => void refreshVehiculosMaestro()}
                    refreshingVehiculos={refreshingFlota}
                    getToken={getToken}
                    tenantId={tenantId || undefined}
                    onVehiculoCreado={(v) => setSessionVehiculos((prev) => [...prev, v])}
                  />
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
                    onNuevo={() => setQuickCreate('chofer-prop')}
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
                  getToken={getToken}
                  tenantId={tenantId || undefined}
                  onVehiculoCreado={(v) => setSessionVehiculos((prev) => [...prev, v])}
                />
                {ayudaFlota.vehiculo && (
                  <p className="text-xs text-amber-800/90">{ayudaFlota.vehiculo}</p>
                )}
              </div>
            }
          />

          <ViajeGananciaBrutaManualFieldset
            draft={{
              operacionModo: modoOperacion,
              monto,
              monedaMonto,
              precioTransportistaExterno,
              monedaPrecioTransportistaExterno: monedaPrecioTransportista,
              gananciaBrutaManual,
              monedaGananciaBrutaManual,
              otrosGastos,
            }}
            onPatch={(p) => {
              if (p.gananciaBrutaManual !== undefined) setGananciaBrutaManual(p.gananciaBrutaManual);
              if (p.monedaGananciaBrutaManual !== undefined) {
                setMonedaGananciaBrutaManual(p.monedaGananciaBrutaManual);
              }
            }}
            labelClassName={fieldLabelClass}
            inputClassName={inputClass}
          />
          <ViajeFechaHoraFields
            fechaCarga={fechaCarga}
            horaCarga={horaCarga}
            fechaDescarga={fechaDescarga}
            horaDescarga={horaDescarga}
            onPatch={(p) => {
              if (p.fechaCarga !== undefined) { setFechaCarga(p.fechaCarga); if (p.fechaCarga) setFechaCargaError(null); }
              if (p.horaCarga !== undefined) setHoraCarga(p.horaCarga);
              if (p.fechaDescarga !== undefined) { setFechaDescarga(p.fechaDescarga); if (p.fechaDescarga) setFechaDescargaError(null); }
              if (p.horaDescarga !== undefined) setHoraDescarga(p.horaDescarga);
            }}
            labelClassName={fieldLabelClass}
            inputClassName={inputClass}
            errorFechaCarga={fechaCargaError}
            errorFechaDescarga={fechaDescargaError}
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
            <span className={fieldLabelClass}>Productos</span>
            <ViajeProductosLista
              groupId="viaje-create"
              value={productoItems}
              onChange={setProductoItems}
              opciones={productosCatalogo.map<OpcionProducto>((p) => ({
                id: p.id,
                nombre: p.nombre,
                activo: p.activo,
              }))}
              triggerClassName={inputClass}
              inputClassName={inputClass}
              disabled={loading}
              getToken={getToken}
              onProductoCreado={(p) => setProductosCatalogo((prev) => [...prev, p])}
            />
          </div>
          <div className="flex flex-col gap-1 md:col-span-2 lg:col-span-3">
            <span className={fieldLabelClass}>Detalle adicional</span>
            <textarea
              value={detalleCarga}
              onChange={(e) => setDetalleCarga(e.target.value)}
              placeholder="Notas extra: bultos, temperatura, precinto, etc."
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
          <div className="md:col-span-2 lg:col-span-3">
            <OtrosGastosFieldset rows={otrosGastos} onChange={setOtrosGastos} />
            <button
              type="button"
              onClick={() => setOtrosGastos((prev) => [...prev, emptyOtroGasto()])}
              className="mt-2 text-xs uppercase tracking-wider px-3 py-1 border border-black/20 hover:bg-vialto-mist"
            >
              + Agregar gasto
            </button>
          </div>
          {modoOperacion === 'externo' && (
            <div className="md:col-span-2 lg:col-span-3">
              <PagosTransportistaFieldset rows={pagosTransportista} onChange={setPagosTransportista} />
              <button
                type="button"
                onClick={() => setPagosTransportista((prev) => [...prev, emptyPagoTransportista()])}
                className="mt-2 text-xs uppercase tracking-wider px-3 py-1 border border-black/20 hover:bg-vialto-mist"
              >
                + Agregar pago al transportista
              </button>
            </div>
          )}
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

    {quickCreate === 'cliente' && (
      <ClienteModal
        getToken={getToken}
        tenantId={tenantId || undefined}
        onClose={() => setQuickCreate(null)}
        onSaved={(c) => {
          setSessionClientes((prev) => [...prev, c]);
          setClienteId(c.id);
          setQuickCreate(null);
        }}
      />
    )}
    {quickCreate === 'transportista' && (
      <TransportistaModal
        getToken={getToken}
        tenantId={tenantId || undefined}
        onClose={() => setQuickCreate(null)}
        onSaved={(t) => {
          setSessionTransportistas((prev) => [...prev, t]);
          setTransportistaId(t.id);
          setQuickCreate(null);
        }}
      />
    )}
    {(quickCreate === 'chofer-ext' || quickCreate === 'chofer-prop') && (
      <ChoferModal
        getToken={getToken}
        tenantId={tenantId || undefined}
        onClose={() => setQuickCreate(null)}
        onSaved={(c) => {
          setSessionChoferes((prev) => [...prev, c]);
          if (quickCreate === 'chofer-ext') {
            setChoferExternoId(c.id);
          } else {
            setChoferId(c.id);
          }
          setQuickCreate(null);
        }}
      />
    )}
    </>
  );
}
