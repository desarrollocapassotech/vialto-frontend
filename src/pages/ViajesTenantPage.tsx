import { useAuth } from '@clerk/clerk-react';
import { useMaestroData } from '@/hooks/useMaestroData';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ClienteSearchSelect, TransportistaSearchSelect } from '@/components/forms/MaestroSearchSelects';
import { CiudadCombobox } from '@/components/forms/CiudadCombobox';
import { PaisUbicacionSelect } from '@/components/forms/PaisUbicacionSelect';
import type { ViajeOperacionModo } from '@/components/viajes/ViajeOperacionTipoFieldset';
import { FacturarOpcionModal } from '@/components/viajes/FacturarOpcionModal';
import { AgregarGastoModal } from '@/components/viajes/AgregarGastoModal';
import { RegistrarPagoTransportistaModal } from '@/components/viajes/RegistrarPagoTransportistaModal';
import { ViajesListadoHeaderFiltro } from '@/components/viajes/ViajesListadoHeaderFiltro';
import { apiJson } from '@/lib/api';
import {
  formatNumberForMoneda,
  normalizeViajeMoneda,
  parseCurrencyForMoneda,
} from '@/lib/currencyMask';
import { friendlyError } from '@/lib/friendlyError';
import {
  choferesFlotaPropia,
  flotaPropiaVehiculosListaValida,
  formatViajeImporteForListado,
  mensajesAyudaFlotaPropia,
  normalizarIdEnLista,
  nombreClienteListadoViaje,
  nombreTransportistaExternoListadoViaje,
  numeroFacturaVisibleViaje,
  textoMontoFacturarListado,
  vehiculoIdsDesdeRows,
  vehiculosFlotaPropia,
} from '@/lib/viajesFlota';
import {
  ViajeGananciaBrutaCelda,
  ViajeGananciaBrutaColumnHeader,
} from '@/components/viajes/ViajeGananciaBruta';
import { ViajeOrigenDestinoLinea } from '@/components/viajes/ViajeOrigenDestinoLinea';
import { ViajeEditModal, type ViajeInlineDraft } from '@/components/viajes/ViajeEditModal';
import {
  otroGastoDraftFromApi,
  otroGastoDraftToApi,
} from '@/components/viajes/OtrosGastosFieldset';
import {
  pagoTransportistaDraftFromApi,
  pagoTransportistaDraftToApi,
} from '@/components/viajes/PagosTransportistaFieldset';
import {
  esEtiquetaCiudadValida,
  inferirPaisDesdeUbicacion,
  type PaisCodigo,
} from '@/lib/ciudades';
import { fechaHoraToIso, isoToFechaHora } from '@/lib/viajeFechaHora';
import {
  estadoViajeBadgeClass,
  estadoViajeBadgeClassDefault,
  estadoViajeLabel,
  tooltipEstadoViaje,
  viajeEstadoEsFacturadoOCobrado,
  viajeEstadoPermiteBotonFacturar,
  viajePermiteAgregarGasto,
  estadosDisponiblesParaViaje,
  VIAJE_ESTADOS_TODOS,
} from '@/lib/viajesEstados';
import {
  calcularSaldoTransportista,
  viajeRequierePagosTransportista,
} from '@/lib/viajesTransportistaPagos';
import type {
  Factura,
  PaginatedMeta,
  Carga,
  Viaje,
} from '@/types/api';
import { cargaIdsOrdenadosDesdeViaje, mergeOpcionesCarga } from '@/lib/cargasOpciones';


type ViajesPaginatedResponse = {
  items: Viaje[];
  meta: PaginatedMeta;
};

export function ViajesTenantPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Viaje[] | null>(null);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ViajeInlineDraft | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [fechaCargaError, setFechaCargaError] = useState<string | null>(null);
  const [fechaDescargaError, setFechaDescargaError] = useState<string | null>(null);
  /** Fila donde el usuario abrió el selector de estado con un clic en el badge. */
  const [estadoQuickId, setEstadoQuickId] = useState<string | null>(null);
  const [savingEstadoId, setSavingEstadoId] = useState<string | null>(null);
  const { clientes, choferes, transportistas, vehiculos } = useMaestroData();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  /** Filtros de listado (ref para el fetch; la versión fuerza refetch). */
  const filtrosAplicadosRef = useRef({
    clienteId: '',
    transportistaId: '',
    estado: '',
    tipoFecha: '' as '' | 'carga' | 'descarga',
    fechaDesde: '',
    fechaHasta: '',
    tipoUbicacion: '' as '' | 'origen' | 'destino',
    /** Etiqueta completa de ciudad (misma que guarda el viaje al elegir del combobox). */
    ubicacion: '',
  });
  /** Cliente seleccionado en filtro de columna (checks y facturación masiva). */
  const [clienteIdFiltroActivo, setClienteIdFiltroActivo] = useState('');
  const [transportistaIdFiltroActivo, setTransportistaIdFiltroActivo] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [tipoFechaFiltro, setTipoFechaFiltro] = useState<'' | 'carga' | 'descarga'>('');
  const [fechaDesdeFiltro, setFechaDesdeFiltro] = useState('');
  const [fechaHastaFiltro, setFechaHastaFiltro] = useState('');
  const [tipoUbicacionFiltro, setTipoUbicacionFiltro] = useState<'' | 'origen' | 'destino'>('');
  const [paisUbicacionFiltro, setPaisUbicacionFiltro] = useState<PaisCodigo>('AR');
  const [ubicacionFiltro, setUbicacionFiltro] = useState('');
  const [listadoQueryVersion, setListadoQueryVersion] = useState(0);
  /** Mientras se vuelve a pedir el listado (filtros, página, etc.). */
  const [listadoRefetching, setListadoRefetching] = useState(false);
  /** Selección para facturar varios viajes juntos (solo con filtro por cliente). */
  const [idsFacturarSeleccion, setIdsFacturarSeleccion] = useState<string[]>([]);
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  /** Modal de elección al facturar: nueva factura o agregar a una existente del cliente. */
  const [facturarOpcionState, setFacturarOpcionState] = useState<{
    viaje: Viaje;
    facturas: Factura[];
  } | null>(null);
  const [facturarOpcionBusy, setFacturarOpcionBusy] = useState(false);
  /** Viaje sobre el que se está abriendo el modal de agregar gasto. */
  const [agregarGastoViaje, setAgregarGastoViaje] = useState<Viaje | null>(null);
  /** Viaje sobre el que se está abriendo el modal de registrar pago al transportista. */
  const [registrarPagoViaje, setRegistrarPagoViaje] = useState<Viaje | null>(null);
  /** IDs de viajes que ya tienen al menos una factura asociada (derivado de rows, sin request extra). */
  const viajesConFactura = useMemo(
    () => new Set((rows ?? []).filter((v) => v.facturaId).map((v) => v.id)),
    [rows],
  );
  const viajeEdicionSnapshot = useMemo(
    () => (editingId && rows ? rows.find((r) => r.id === editingId) ?? null : null),
    [editingId, rows],
  );
  const [cargasCatalogo, setCargasCatalogo] = useState<Carga[]>([]);
  const opcionesCargaModal = useMemo(
    () => mergeOpcionesCarga(cargasCatalogo, viajeEdicionSnapshot),
    [cargasCatalogo, viajeEdicionSnapshot],
  );
  /** Aviso al editar un viaje en flota propia si chofer/vehículo del maestro no era compatible. */
  const [viajeEditHint, setViajeEditHint] = useState<string | null>(null);

  const choferesPropios = useMemo(() => choferesFlotaPropia(choferes), [choferes]);
  const vehiculosPropios = useMemo(() => vehiculosFlotaPropia(vehiculos), [vehiculos]);
  const ayudaFlotaListado = useMemo(
    () => mensajesAyudaFlotaPropia(choferes, vehiculos),
    [choferes, vehiculos],
  );

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const d = await apiJson<{ items: Carga[] }>(
          '/api/cargas/paginated?page=1&pageSize=100&filtroActivo=activos',
          () => getToken(),
        );
        if (!cancelled) setCargasCatalogo(d.items);
      } catch {
        if (!cancelled) setCargasCatalogo([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('pageSize', String(pageSize));
        const {
          clienteId: cid,
          transportistaId: tid,
          estado: estF,
          tipoFecha: tf,
          fechaDesde: fd,
          fechaHasta: fh,
          tipoUbicacion: tu,
          ubicacion: ut,
        } = filtrosAplicadosRef.current;
        if (cid) params.set('clienteId', cid);
        if (tid) params.set('transportistaId', tid);
        if (estF.trim()) params.set('estado', estF.trim());
        if ((tf === 'carga' || tf === 'descarga') && (fd.trim() || fh.trim())) {
          params.set('tipoFecha', tf);
          if (fd.trim()) params.set('fechaDesde', fd.trim());
          if (fh.trim()) params.set('fechaHasta', fh.trim());
        }
        const utTrim = ut.trim();
        if ((tu === 'origen' || tu === 'destino') && utTrim) {
          params.set('tipoUbicacion', tu);
          params.set('ubicacion', utTrim);
        }
        const data = await apiJson<ViajesPaginatedResponse>(
          `/api/viajes/paginated?${params.toString()}`,
          () => getTokenRef.current(),
        );
        if (!cancelled) {
          setRows(data.items);
          setMeta(data.meta);
          setError(null);
          setListadoRefetching(false);
        }
      } catch (e) {
        if (!cancelled) {
          setRows(null);
          setMeta(null);
          setError(friendlyError(e, 'viajes'));
          setListadoRefetching(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, page, pageSize, listadoQueryVersion]);

  function aplicarFiltroColumnaCliente(clienteId: string) {
    const cid = clienteId.trim();
    filtrosAplicadosRef.current = {
      ...filtrosAplicadosRef.current,
      clienteId: cid,
    };
    setListadoRefetching(true);
    setClienteIdFiltroActivo(cid);
    setPage(1);
    setListadoQueryVersion((v) => v + 1);
  }

  function aplicarFiltroColumnaTransportista(transportistaId: string) {
    const tid = transportistaId.trim();
    filtrosAplicadosRef.current = {
      ...filtrosAplicadosRef.current,
      transportistaId: tid,
    };
    setListadoRefetching(true);
    setTransportistaIdFiltroActivo(tid);
    setPage(1);
    setListadoQueryVersion((v) => v + 1);
  }

  function aplicarFiltroEstado(val: string) {
    const e = val.trim();
    filtrosAplicadosRef.current = { ...filtrosAplicadosRef.current, estado: e };
    setEstadoFiltro(e);
    setListadoRefetching(true);
    setPage(1);
    setListadoQueryVersion((v) => v + 1);
  }

  function aplicarTipoFechaFiltro(val: '' | 'carga' | 'descarga') {
    if (!val) {
      filtrosAplicadosRef.current = {
        ...filtrosAplicadosRef.current,
        tipoFecha: '',
        fechaDesde: '',
        fechaHasta: '',
      };
      setTipoFechaFiltro('');
      setFechaDesdeFiltro('');
      setFechaHastaFiltro('');
    } else {
      filtrosAplicadosRef.current = { ...filtrosAplicadosRef.current, tipoFecha: val };
      setTipoFechaFiltro(val);
    }
    setListadoRefetching(true);
    setPage(1);
    setListadoQueryVersion((v) => v + 1);
  }

  function aplicarFechaDesdeFiltro(val: string) {
    const s = val.trim();
    filtrosAplicadosRef.current = { ...filtrosAplicadosRef.current, fechaDesde: s };
    setFechaDesdeFiltro(s);
    setListadoRefetching(true);
    setPage(1);
    setListadoQueryVersion((v) => v + 1);
  }

  function aplicarFechaHastaFiltro(val: string) {
    const s = val.trim();
    filtrosAplicadosRef.current = { ...filtrosAplicadosRef.current, fechaHasta: s };
    setFechaHastaFiltro(s);
    setListadoRefetching(true);
    setPage(1);
    setListadoQueryVersion((v) => v + 1);
  }

  function aplicarTipoUbicacionFiltro(val: '' | 'origen' | 'destino') {
    const habiaCiudadEnFiltro =
      filtrosAplicadosRef.current.ubicacion.trim() !== '';

    if (!val) {
      filtrosAplicadosRef.current = {
        ...filtrosAplicadosRef.current,
        tipoUbicacion: '',
        ubicacion: '',
      };
      setTipoUbicacionFiltro('');
      setUbicacionFiltro('');
      setPaisUbicacionFiltro('AR');
    } else {
      filtrosAplicadosRef.current = {
        ...filtrosAplicadosRef.current,
        tipoUbicacion: val,
        ubicacion: '',
      };
      setTipoUbicacionFiltro(val);
      setUbicacionFiltro('');
    }

    /** Solo se pide de nuevo el listado si había ciudad aplicada (se quitó o se cambió origen/destino). */
    if (habiaCiudadEnFiltro) {
      setListadoRefetching(true);
      setPage(1);
      setListadoQueryVersion((v) => v + 1);
    }
  }

  function aplicarPaisUbicacionFiltro(p: PaisCodigo) {
    const habiaCiudadEnFiltro =
      filtrosAplicadosRef.current.ubicacion.trim() !== '';
    filtrosAplicadosRef.current = { ...filtrosAplicadosRef.current, ubicacion: '' };
    setUbicacionFiltro('');
    setPaisUbicacionFiltro(p);
    if (habiaCiudadEnFiltro) {
      setListadoRefetching(true);
      setPage(1);
      setListadoQueryVersion((v) => v + 1);
    }
  }

  /** Solo se llama desde `CiudadCombobox` al elegir una ciudad de la lista (o vaciar). */
  function aplicarUbicacionCiudadSeleccion(val: string) {
    const s = val.trim().slice(0, 200);
    filtrosAplicadosRef.current = { ...filtrosAplicadosRef.current, ubicacion: s };
    setUbicacionFiltro(s);
    setListadoRefetching(true);
    setPage(1);
    setListadoQueryVersion((v) => v + 1);
  }

  function limpiarFiltrosColumnas() {
    filtrosAplicadosRef.current = {
      clienteId: '',
      transportistaId: '',
      estado: '',
      tipoFecha: '',
      fechaDesde: '',
      fechaHasta: '',
      tipoUbicacion: '',
      ubicacion: '',
    };
    setListadoRefetching(true);
    setClienteIdFiltroActivo('');
    setTransportistaIdFiltroActivo('');
    setEstadoFiltro('');
    setTipoFechaFiltro('');
    setFechaDesdeFiltro('');
    setFechaHastaFiltro('');
    setTipoUbicacionFiltro('');
    setPaisUbicacionFiltro('AR');
    setUbicacionFiltro('');
    setPage(1);
    setListadoQueryVersion((v) => v + 1);
  }

  const hayFiltrosColumnasActivos =
    !!clienteIdFiltroActivo.trim() ||
    !!transportistaIdFiltroActivo.trim() ||
    !!estadoFiltro.trim() ||
    !!fechaDesdeFiltro.trim() ||
    !!fechaHastaFiltro.trim() ||
    !!ubicacionFiltro.trim();

  /** Una unidad por columna de filtro con criterio aplicado (máx. 5). */
  const cantidadFiltrosColumnasActivos = useMemo(() => {
    let n = 0;
    if (clienteIdFiltroActivo.trim()) n += 1;
    if (transportistaIdFiltroActivo.trim()) n += 1;
    if (estadoFiltro.trim()) n += 1;
    if (ubicacionFiltro.trim()) n += 1;
    if (fechaDesdeFiltro.trim() || fechaHastaFiltro.trim()) {
      n += 1;
    }
    return n;
  }, [
    clienteIdFiltroActivo,
    transportistaIdFiltroActivo,
    estadoFiltro,
    ubicacionFiltro,
    fechaDesdeFiltro,
    fechaHastaFiltro,
  ]);

  useEffect(() => {
    setIdsFacturarSeleccion([]);
  }, [clienteIdFiltroActivo]);

  function esElegibleFacturarLote(v: Viaje): boolean {
    return viajeEstadoPermiteBotonFacturar(v.estado) && !viajesConFactura.has(v.id);
  }

  function toggleFacturarLote(id: string) {
    setIdsFacturarSeleccion((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleSeleccionarTodosEnPagina() {
    const elegibles = (rows ?? []).filter(esElegibleFacturarLote).map((v) => v.id);
    if (elegibles.length === 0) return;
    const todosMarcados = elegibles.every((id) => idsFacturarSeleccion.includes(id));
    if (todosMarcados) {
      const setE = new Set(elegibles);
      setIdsFacturarSeleccion((prev) => prev.filter((id) => !setE.has(id)));
    } else {
      setIdsFacturarSeleccion((prev) => [...new Set([...prev, ...elegibles])]);
    }
  }

  function facturarSeleccionMultiple() {
    const ids = idsFacturarSeleccion;
    const cid = clienteIdFiltroActivo.trim();
    if (ids.length === 0 || !cid) return;
    navigate('/facturacion', {
      state: {
        newFacturaDraft: {
          clienteId: cid,
          viajeIds: ids,
        },
      },
    });
  }

  useEffect(() => {
    if (!editingId || !draft || draft.operacionModo !== 'propio') return;
    setDraft((p) => {
      if (!p || p.operacionModo !== 'propio') return p;
      const cid = normalizarIdEnLista(p.choferId, choferesPropios);
      if (cid === p.choferId) return p;
      return { ...p, choferId: cid };
    });
  }, [editingId, draft?.operacionModo, choferesPropios]);

  useEffect(() => {
    if (draft?.operacionModo === 'externo') setViajeEditHint(null);
  }, [draft?.operacionModo]);

  function startEdit(v: Viaje) {
    setEstadoQuickId(null);
    setError(null);
    setEditingId(v.id);
    const esExterno = !!(v.transportistaId ?? '').trim();
    const chRow = choferes.find((c) => c.id === v.choferId);
    const partes: string[] = [];
    if (!esExterno && v.choferId && chRow?.transportistaId) {
      partes.push(
        'El chofer asociado a este viaje figura con transportista externo en su ficha; elegí uno de flota propia o actualizá el chofer.',
      );
    }
    if (!esExterno && v.vehiculosViaje?.length) {
      for (const vv of v.vehiculosViaje) {
        const vr = vehiculos.find((x) => x.id === vv.vehiculoId);
        if (vr?.transportistaId) {
          partes.push(
            'Algún vehículo del viaje figura con transportista externo en su ficha; elegí flota propia o actualizá el maestro.',
          );
          break;
        }
      }
    }
    setViajeEditHint(partes.length ? partes.join(' ') : null);
    const partesFc = isoToFechaHora(v.fechaCarga);
    const partesFd = isoToFechaHora(v.fechaDescarga);
    setDraft({
      numero: v.numero ?? '',
      estado: v.estado ?? 'pendiente',
      clienteId: v.clienteId ?? '',
      operacionModo: esExterno ? 'externo' : 'propio',
      choferId: normalizarIdEnLista(v.choferId, choferesPropios),
      choferExternoId: esExterno ? (v.choferId ?? '') : '',
      transportistaId: v.transportistaId ?? '',
      vehiculosRows:
        !esExterno && v.vehiculosViaje && v.vehiculosViaje.length > 0
          ? [...v.vehiculosViaje]
              .sort((a, b) => a.orden - b.orden)
              .map((x) => ({
                tipo: (x.vehiculo?.tipo ?? 'tractor').toLowerCase(),
                vehiculoId: normalizarIdEnLista(x.vehiculoId, vehiculosPropios),
              }))
          : !esExterno
            ? [{ tipo: 'tractor', vehiculoId: '' }]
            : [],
      vehiculoExternoId: esExterno ? (v.vehiculosViaje?.[0]?.vehiculoId ?? '') : '',
      paisOrigen: inferirPaisDesdeUbicacion(v.origen ?? ''),
      paisDestino: inferirPaisDesdeUbicacion(v.destino ?? ''),
      origen: v.origen ?? '',
      destino: v.destino ?? '',
      fechaCarga: partesFc.fecha,
      horaCarga: partesFc.hora,
      fechaDescarga: partesFd.fecha,
      horaDescarga: partesFd.hora,
      cargaIds: cargaIdsOrdenadosDesdeViaje(v),
      detalleCarga: v.detalleCarga ?? '',
      observaciones: v.observaciones ?? '',
      monto: formatNumberForMoneda(v.monto, normalizeViajeMoneda(v.monedaMonto)),
      monedaMonto: normalizeViajeMoneda(v.monedaMonto),
      kmRecorridos: v.kmRecorridos != null ? String(v.kmRecorridos) : '',
      litrosConsumidos: v.litrosConsumidos != null ? String(v.litrosConsumidos) : '',
      precioTransportistaExterno: formatNumberForMoneda(
        v.precioTransportistaExterno,
        normalizeViajeMoneda(v.monedaPrecioTransportistaExterno),
      ),
      monedaPrecioTransportistaExterno: normalizeViajeMoneda(v.monedaPrecioTransportistaExterno),
      otrosGastos: (v.otrosGastos ?? []).map(otroGastoDraftFromApi),
      pagosTransportista: (v.pagosTransportista ?? []).map(pagoTransportistaDraftFromApi),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
    setEstadoQuickId(null);
    setViajeEditHint(null);
    setFechaCargaError(null);
    setFechaDescargaError(null);
  }

  async function patchEstadoDesdeListado(v: Viaje, nuevoEstado: string) {
    if (nuevoEstado === v.estado) {
      setEstadoQuickId(null);
      return;
    }
    setSavingEstadoId(v.id);
    setError(null);
    try {
      const updated = await apiJson<Viaje>(`/api/viajes/${encodeURIComponent(v.id)}`, () => getToken(), {
        method: 'PATCH',
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      setRows((prev) => (prev ? prev.map((r) => (r.id === v.id ? updated : r)) : prev));
      setEstadoQuickId(null);
    } catch (e) {
      setError(friendlyError(e, 'viajes'));
    } finally {
      setSavingEstadoId(null);
    }
  }

  async function navigateToFacturacion(v: Viaje) {
    try {
      const facturasCliente = await apiJson<Factura[]>(
        `/api/facturacion/facturas?clienteId=${encodeURIComponent(v.clienteId)}`,
        () => getToken(),
      );
      // Si el viaje ya está vinculado a una factura, ir directamente a ella
      const yaVinculada = facturasCliente.find((f) => f.viajeIds.includes(v.id));
      if (yaVinculada) {
        navigate('/facturacion', { state: { expandFacturaId: yaVinculada.id } });
        return;
      }
      // Si el cliente tiene otras facturas, mostrar el modal de elección
      if (facturasCliente.length > 0) {
        setFacturarOpcionState({ viaje: v, facturas: facturasCliente });
        return;
      }
    } catch {
      // si falla la consulta, igualmente navegamos para no bloquear al usuario
    }
    navigate('/facturacion', {
      state: {
        newFacturaDraft: {
          clienteId: v.clienteId ?? '',
          viajeIds: [v.id],
        },
      },
    });
  }

  async function handleFacturarOpcionConfirm(opcion: 'nueva' | { facturaId: string }) {
    if (!facturarOpcionState) return;
    const { viaje, facturas } = facturarOpcionState;
    if (opcion === 'nueva') {
      setFacturarOpcionState(null);
      navigate('/facturacion', {
        state: {
          newFacturaDraft: {
            clienteId: viaje.clienteId ?? '',
            viajeIds: [viaje.id],
          },
        },
      });
      return;
    }
    // Agregar a factura existente
    const facturaTarget = facturas.find((f) => f.id === opcion.facturaId);
    if (!facturaTarget) return;
    setFacturarOpcionBusy(true);
    try {
      await apiJson(`/api/facturacion/facturas/${encodeURIComponent(opcion.facturaId)}`, () => getToken(), {
        method: 'PATCH',
        body: JSON.stringify({ viajeIds: [...facturaTarget.viajeIds, viaje.id] }),
      });
      setFacturarOpcionState(null);
      navigate('/facturacion', { state: { expandFacturaId: opcion.facturaId } });
    } catch (e) {
      setError(friendlyError(e, 'facturacion'));
    } finally {
      setFacturarOpcionBusy(false);
    }
  }

  function applyDraftModo(m: ViajeOperacionModo) {
    setDraft((p) =>
      p
        ? {
            ...p,
            operacionModo: m,
            ...(m === 'externo'
              ? { choferId: '', vehiculosRows: [] }
              : {
                  transportistaId: '',
                  choferExternoId: '',
                  vehiculoExternoId: '',
                  choferId: normalizarIdEnLista(p.choferId, choferesPropios),
                  vehiculosRows:
                    p.vehiculosRows.length > 0 ? p.vehiculosRows : [{ tipo: 'tractor', vehiculoId: '' }],
                }),
          }
        : p,
    );
  }

  async function saveInline(viajeId: string) {
    if (!draft) return;
    if (!draft.numero.trim()) {
      setError('Ingresá el número de viaje.');
      return;
    }
    const externo = draft.operacionModo === 'externo';
    if (externo && !draft.transportistaId.trim()) {
      setError('Seleccioná un transportista externo.');
      return;
    }
    const vids = vehiculoIdsDesdeRows(draft.vehiculosRows);
    if (!externo && vids.length === 0) {
      setError('Agregá al menos un vehículo al viaje (tipo y patente desde el maestro).');
      return;
    }
    if (
      !externo &&
      !flotaPropiaVehiculosListaValida(draft.choferId, vids, choferesPropios, vehiculosPropios)
    ) {
      setError('En flota propia, elegí chofer y vehículos de las listas (si no aparecen, cargá la página).');
      return;
    }
    const o = draft.origen.trim();
    const d = draft.destino.trim();
    if (o || d) {
      const [okO, okD] = await Promise.all([
        o ? esEtiquetaCiudadValida(draft.paisOrigen, o) : Promise.resolve(true),
        d ? esEtiquetaCiudadValida(draft.paisDestino, d) : Promise.resolve(true),
      ]);
      if (!okO || !okD) {
        setError('Origen y destino deben elegirse de la lista de ciudades (no se admite texto libre).');
        return;
      }
    }
    const fcError = !draft.fechaCarga.trim() ? 'Ingresá la fecha de carga.' : null;
    const fdError = !draft.fechaDescarga.trim() ? 'Ingresá la fecha de descarga.' : null;
    setFechaCargaError(fcError);
    setFechaDescargaError(fdError);
    if (fcError || fdError) return;

    const kmResolved = draft.kmRecorridos.trim()
      ? Number(draft.kmRecorridos.replace(',', '.'))
      : undefined;
    const litResolved = draft.litrosConsumidos.trim()
      ? Number(draft.litrosConsumidos.replace(',', '.'))
      : undefined;
    setSavingId(viajeId);
    setError(null);
    try {
      const updated = await apiJson<Viaje>(`/api/viajes/${encodeURIComponent(viajeId)}`, () => getToken(), {
        method: 'PATCH',
        body: JSON.stringify({
          numero: draft.numero.trim(),
          estado: draft.estado,
          clienteId: draft.clienteId || undefined,
          ...(externo
            ? {
                transportistaId: draft.transportistaId.trim(),
                choferId: draft.choferExternoId.trim() || null,
                vehiculoIds: draft.vehiculoExternoId.trim() ? [draft.vehiculoExternoId.trim()] : [],
              }
            : {
                transportistaId: null,
                choferId: draft.choferId.trim(),
                vehiculoIds: vids,
              }),
          origen: draft.origen.trim() || undefined,
          destino: draft.destino.trim() || undefined,
          fechaCarga: fechaHoraToIso(draft.fechaCarga, draft.horaCarga),
          fechaDescarga: fechaHoraToIso(draft.fechaDescarga, draft.horaDescarga),
          cargaIds: draft.cargaIds.map((x) => x.trim()).filter(Boolean),
          detalleCarga: draft.detalleCarga.trim() || undefined,
          observaciones: draft.observaciones.trim() || undefined,
          monto: parseCurrencyForMoneda(draft.monto, draft.monedaMonto),
          monedaMonto: draft.monedaMonto,
          kmRecorridos: kmResolved,
          litrosConsumidos: litResolved,
          precioTransportistaExterno: parseCurrencyForMoneda(
            draft.precioTransportistaExterno,
            draft.monedaPrecioTransportistaExterno,
          ),
          monedaPrecioTransportistaExterno: draft.monedaPrecioTransportistaExterno,
          otrosGastos: draft.otrosGastos.map(otroGastoDraftToApi).filter(Boolean),
          pagosTransportista: draft.pagosTransportista.map(pagoTransportistaDraftToApi).filter(Boolean),
        }),
      });
      setRows((prev) => (prev ? prev.map((r) => (r.id === viajeId ? updated : r)) : prev));
      cancelEdit();
    } catch (e) {
      setError(friendlyError(e, 'viajes'));
    } finally {
      setSavingId(null);
    }
  }

  const mostrarColumnaFacturarLote = clienteIdFiltroActivo.trim() !== '';
  /** Cliente + transp. externo + estado + recorrido + fechas + monto + ganancia bruta [+ acciones]. */
  const tableColSpanBase = 8;
  const tableColSpan = mostrarColumnaFacturarLote ? tableColSpanBase + 1 : tableColSpanBase;
  const mostrarCargandoListado = !error && (rows === null || listadoRefetching);
  const elegiblesEnPagina = (rows ?? []).filter(esElegibleFacturarLote);
  const todosElegiblesMarcados =
    elegiblesEnPagina.length > 0 &&
    elegiblesEnPagina.every((v) => idsFacturarSeleccion.includes(v.id));

  function formatFechaCargaCelda(iso: string | null | undefined) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '—';
    }
  }

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-vialto-charcoal">
        Viajes
      </h1>
      <p className="mt-2 text-vialto-steel">
        Cliente, transporte, estado, origen, destino, y por rango de fecha de carga o descarga.
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-h-10 items-center">
          {hayFiltrosColumnasActivos && (
            <button
              type="button"
              onClick={limpiarFiltrosColumnas}
              disabled={listadoRefetching}
              className="inline-flex h-10 items-center gap-2 px-4 border border-black/15 bg-white text-vialto-steel text-sm uppercase tracking-wider hover:bg-vialto-mist/80 hover:text-vialto-charcoal transition-colors disabled:opacity-50 disabled:pointer-events-none"
              aria-label={`Limpiar filtros (${cantidadFiltrosColumnasActivos} columna${cantidadFiltrosColumnasActivos !== 1 ? 's' : ''} filtrada${cantidadFiltrosColumnasActivos !== 1 ? 's' : ''})`}
            >
              Limpiar filtros
              <span
                className="inline-flex min-h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-full bg-vialto-fire px-1.5 font-[family-name:var(--font-ui)] text-[11px] font-semibold tabular-nums leading-none text-white"
                aria-hidden
              >
                {cantidadFiltrosColumnasActivos}
              </span>
            </button>
          )}
        </div>
        <div className="flex shrink-0 justify-end gap-2">
          <Link
            to="/viajes/nuevo"
            className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
          >
            Crear viaje
          </Link>
        </div>
      </div>

      {error && !editingId && (
        <p role="alert" className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      {mostrarColumnaFacturarLote && idsFacturarSeleccion.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded border border-black/10 bg-white px-4 py-3 shadow-sm">
          <p className="text-sm text-vialto-steel">
            <span className="font-medium text-vialto-charcoal">{idsFacturarSeleccion.length}</span>
            {' '}
            viaje{idsFacturarSeleccion.length !== 1 ? 's' : ''} seleccionado
            {idsFacturarSeleccion.length !== 1 ? 's' : ''}
          </p>
          <button
            type="button"
            onClick={facturarSeleccionMultiple}
            className="inline-flex h-10 items-center px-5 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
          >
            Facturar
          </button>
        </div>
      )}

      <div className="mt-8 overflow-x-auto rounded border border-black/5 bg-white shadow-sm">
        <table
          className="w-full text-left text-sm"
          aria-busy={mostrarCargandoListado}
        >
          <thead>
            <tr className="border-b border-black/10 bg-vialto-mist font-[family-name:var(--font-ui)] text-[15px] uppercase tracking-[0.2em] text-vialto-fire">
              {mostrarColumnaFacturarLote && (
                <th className="px-2 py-3 w-10 text-center align-middle">
                  <span className="sr-only">Seleccionar para facturación conjunta</span>
                  {elegiblesEnPagina.length > 0 ? (
                    <input
                      type="checkbox"
                      checked={todosElegiblesMarcados}
                      onChange={toggleSeleccionarTodosEnPagina}
                      className="accent-vialto-charcoal"
                      title="Marcar o desmarcar todos los viajes facturables en esta página"
                      aria-label="Marcar o desmarcar todos los viajes facturables en esta página"
                    />
                  ) : null}
                </th>
              )}
              <th scope="col" className="px-4 py-3 align-top min-w-[10rem]">
                <ViajesListadoHeaderFiltro
                  title="Cliente"
                  filterActive={!!clienteIdFiltroActivo.trim()}
                  filterSignature={clienteIdFiltroActivo}
                >
                  <ClienteSearchSelect
                    id="viajes-col-filtro-cliente"
                    clientes={clientes}
                    value={clienteIdFiltroActivo}
                    onChange={(id) => aplicarFiltroColumnaCliente(id)}
                    allowEmptyValue
                    emptyListChoiceLabel="Todos"
                    placeholderCerrado="Todos"
                    disabled={listadoRefetching}
                    aria-label="Filtrar listado por cliente"
                    inputClassName={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                      clienteIdFiltroActivo.trim() ? 'text-vialto-fire' : 'text-vialto-charcoal'
                    }`}
                  />
                </ViajesListadoHeaderFiltro>
              </th>
              <th scope="col" className="px-4 py-3 align-top min-w-[10rem]">
                <ViajesListadoHeaderFiltro
                  title="Transporte"
                  filterActive={!!transportistaIdFiltroActivo.trim()}
                  filterSignature={transportistaIdFiltroActivo}
                >
                  <TransportistaSearchSelect
                    id="viajes-col-filtro-transporte"
                    transportistas={transportistas}
                    value={transportistaIdFiltroActivo}
                    onChange={(id) => aplicarFiltroColumnaTransportista(id)}
                    placeholderCerrado="Todos"
                    emptyListChoiceLabel="Todos"
                    disabled={listadoRefetching}
                    aria-label="Filtrar listado por transporte"
                    inputClassName={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                      transportistaIdFiltroActivo.trim() ? 'text-vialto-fire' : 'text-vialto-charcoal'
                    }`}
                  />
                </ViajesListadoHeaderFiltro>
              </th>
              <th scope="col" className="px-4 py-3 align-top min-w-[11rem]">
                <ViajesListadoHeaderFiltro
                  title="Estado"
                  filterActive={!!estadoFiltro.trim()}
                  filterSignature={estadoFiltro}
                >
                  <select
                    value={estadoFiltro}
                    onChange={(e) => aplicarFiltroEstado(e.target.value)}
                    disabled={listadoRefetching}
                    className={`h-9 w-full min-w-[9rem] border border-black/15 bg-white px-2 text-sm ${
                      estadoFiltro.trim() ? 'text-vialto-fire' : 'text-vialto-charcoal'
                    }`}
                    aria-label="Filtrar listado por estado"
                  >
                    <option value="">Todos</option>
                    {VIAJE_ESTADOS_TODOS.map((est) => (
                      <option key={est} value={est} title={tooltipEstadoViaje(est)}>
                        {estadoViajeLabel[est] ?? est}
                      </option>
                    ))}
                  </select>
                </ViajesListadoHeaderFiltro>
              </th>
              <th scope="col" className="px-4 py-3 align-top min-w-[14rem]">
                <ViajesListadoHeaderFiltro
                  title="Origen — Destino"
                  filterActive={!!ubicacionFiltro.trim()}
                  filterSignature={`${tipoUbicacionFiltro}|${paisUbicacionFiltro}|${ubicacionFiltro}`}
                >
                  <div className="flex flex-col gap-2">
                    <select
                      value={tipoUbicacionFiltro}
                      onChange={(e) => {
                        const v = e.target.value;
                        aplicarTipoUbicacionFiltro(
                          v === 'origen' || v === 'destino' ? v : '',
                        );
                      }}
                      disabled={listadoRefetching}
                      className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                        tipoUbicacionFiltro && ubicacionFiltro.trim()
                          ? 'text-vialto-fire'
                          : 'text-vialto-charcoal'
                      }`}
                      aria-label="Filtrar por ciudad en origen o en destino"
                    >
                      <option value="">Sin filtro por ubicación</option>
                      <option value="origen">Origen</option>
                      <option value="destino">Destino</option>
                    </select>
                    {tipoUbicacionFiltro ? (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">
                          País
                        </span>
                        <PaisUbicacionSelect
                          value={paisUbicacionFiltro}
                          onChange={(p) => aplicarPaisUbicacionFiltro(p)}
                          className="h-8 w-full min-w-[140px] border border-black/15 bg-white px-2 text-xs text-vialto-charcoal"
                          aria-label="País para buscar la ciudad del filtro"
                        />
                        <span className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel">
                          Ciudad
                        </span>
                        <div className="min-w-[200px] w-full">
                          <CiudadCombobox
                            pais={paisUbicacionFiltro}
                            value={ubicacionFiltro}
                            onChange={(next) => aplicarUbicacionCiudadSeleccion(next)}
                            inputClassName={`h-9 w-full min-w-[200px] border border-black/15 bg-white px-2 text-sm ${
                              ubicacionFiltro.trim() ? 'text-vialto-fire' : 'text-vialto-charcoal'
                            }`}
                            disableBrowserAutocomplete
                            aria-label={
                              tipoUbicacionFiltro === 'origen'
                                ? 'Ciudad de origen (elegir de la lista)'
                                : 'Ciudad de destino (elegir de la lista)'
                            }
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </ViajesListadoHeaderFiltro>
              </th>
              <th scope="col" className="px-4 py-3 align-top min-w-[14rem]">
                <ViajesListadoHeaderFiltro
                  title="Carga — Descarga"
                  filterActive={
                    !!fechaDesdeFiltro.trim() || !!fechaHastaFiltro.trim()
                  }
                  filterSignature={`${tipoFechaFiltro}|${fechaDesdeFiltro}|${fechaHastaFiltro}`}
                >
                  <div className="flex flex-col gap-2">
                    <select
                      value={tipoFechaFiltro}
                      onChange={(e) => {
                        const v = e.target.value;
                        aplicarTipoFechaFiltro(
                          v === 'carga' || v === 'descarga' ? v : '',
                        );
                      }}
                      disabled={listadoRefetching}
                      className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${
                        tipoFechaFiltro &&
                        (fechaDesdeFiltro.trim() || fechaHastaFiltro.trim())
                          ? 'text-vialto-fire'
                          : 'text-vialto-charcoal'
                      }`}
                      aria-label="Filtrar por fecha de carga o de descarga"
                    >
                      <option value="">Sin filtro por fecha</option>
                      <option value="carga">Fecha de carga</option>
                      <option value="descarga">Fecha de descarga</option>
                    </select>
                    {tipoFechaFiltro ? (
                      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                        <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-[10px] uppercase tracking-wider text-vialto-steel">
                          Desde
                          <input
                            type="date"
                            value={fechaDesdeFiltro}
                            onChange={(e) => aplicarFechaDesdeFiltro(e.target.value)}
                            disabled={listadoRefetching}
                            className="h-9 w-full border border-black/15 bg-white px-2 text-sm"
                          />
                        </label>
                        <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-[10px] uppercase tracking-wider text-vialto-steel">
                          Hasta
                          <input
                            type="date"
                            value={fechaHastaFiltro}
                            onChange={(e) => aplicarFechaHastaFiltro(e.target.value)}
                            disabled={listadoRefetching}
                            className="h-9 w-full border border-black/15 bg-white px-2 text-sm"
                          />
                        </label>
                      </div>
                    ) : null}
                  </div>
                </ViajesListadoHeaderFiltro>
              </th>
              <th className="px-4 py-3 text-right">Monto a facturar</th>
              <ViajeGananciaBrutaColumnHeader />
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {mostrarCargandoListado && (
              <tr>
                <td colSpan={tableColSpan} className="px-4 py-8 text-vialto-steel">
                  Cargando…
                </td>
              </tr>
            )}
            {!mostrarCargandoListado && rows?.length === 0 && (
              <tr>
                <td colSpan={tableColSpan} className="px-4 py-8 text-vialto-steel">
                  Todavía no hay viajes cargados.
                </td>
              </tr>
            )}
            {!mostrarCargandoListado && rows && rows.length > 0 && rows.map((v) => {
              const nombreCliente = nombreClienteListadoViaje(v, clientes);
              const nombreTransp = nombreTransportistaExternoListadoViaje(v, transportistas);
              return (
              <Fragment key={v.id}>
              <tr className="border-b border-black/5 hover:bg-vialto-mist/80">
                {mostrarColumnaFacturarLote && (
                  <td className="px-2 py-3 align-middle text-center">
                    {esElegibleFacturarLote(v) ? (
                      <input
                        type="checkbox"
                        checked={idsFacturarSeleccion.includes(v.id)}
                        onChange={() => toggleFacturarLote(v.id)}
                        className="accent-vialto-charcoal"
                        aria-label={`Incluir viaje ${v.numero} en facturación conjunta`}
                      />
                    ) : null}
                  </td>
                )}
                <td className="px-4 py-3 max-w-[12rem] text-vialto-charcoal">
                  <span className="block truncate font-medium" title={nombreCliente}>
                    {nombreCliente}
                  </span>
                </td>
                <td className="px-4 py-3 max-w-[12rem] text-vialto-steel">
                  <span className="block truncate" title={nombreTransp}>
                    {nombreTransp}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-0.5 items-start">
                  {estadoQuickId === v.id ? (
                    <select
                      autoFocus
                      value={v.estado}
                      disabled={savingEstadoId === v.id}
                      onChange={(e) => void patchEstadoDesdeListado(v, e.target.value)}
                      onBlur={() => setEstadoQuickId(null)}
                      className="h-9 w-full min-w-[9rem] border border-black/15 bg-white px-2 text-sm disabled:opacity-60"
                      aria-label="Cambiar estado del viaje"
                    >
                      {estadosDisponiblesParaViaje(v, viajesConFactura).map((x) => (
                        <option key={x} value={x} title={tooltipEstadoViaje(x)}>
                          {estadoViajeLabel[x] ?? x}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <button
                      type="button"
                      title={tooltipEstadoViaje(v.estado)}
                      aria-label={`Estado ${estadoViajeLabel[v.estado] ?? v.estado}. Abrir selector para cambiar.`}
                      disabled={savingEstadoId === v.id}
                      onClick={() => {
                        if (savingEstadoId) return;
                        setEstadoQuickId(v.id);
                      }}
                      className={`inline-block rounded-sm border text-left font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-wider px-2 py-0.5 cursor-pointer hover:brightness-95 disabled:cursor-wait disabled:opacity-60 ${
                        estadoViajeBadgeClass[v.estado] ?? estadoViajeBadgeClassDefault
                      }`}
                    >
                      {savingEstadoId === v.id ? '…' : estadoViajeLabel[v.estado] ?? 'Sin clasificar'}
                    </button>
                  )}
                  {viajeEstadoEsFacturadoOCobrado(v.estado) && (
                    <span className="text-[10px] font-normal font-[family-name:var(--font-ui)] text-vialto-steel/75 tracking-wide">
                      Factura: {numeroFacturaVisibleViaje(v) || '—'}
                    </span>
                  )}
                  </div>
                </td>
                <td className="px-4 py-3 text-vialto-steel max-w-[220px]">
                  <ViajeOrigenDestinoLinea origen={v.origen} destino={v.destino} />
                </td>
                <td className="px-4 py-3 text-vialto-steel tabular-nums align-top">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span
                        className="block whitespace-nowrap"
                        title={v.fechaCarga ?? undefined}
                      >
                        {formatFechaCargaCelda(v.fechaCarga)}
                      </span>
                      <span
                        className="block whitespace-nowrap text-xs text-vialto-steel/90"
                        title={v.fechaDescarga ?? undefined}
                      >
                        {formatFechaCargaCelda(v.fechaDescarga)}
                      </span>
                    </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {textoMontoFacturarListado(v)}
                </td>
                <ViajeGananciaBrutaCelda viaje={v} />
                <td className="px-4 py-3 text-right">
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="inline-flex flex-wrap justify-end gap-1.5">
                        {viajePermiteAgregarGasto(v.estado) && (
                          <button
                            type="button"
                            onClick={() => setAgregarGastoViaje(v)}
                            className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist"
                          >
                            + Gasto
                          </button>
                        )}
                        {viajeRequierePagosTransportista(v) && v.estado !== 'cancelado' && (
                          <button
                            type="button"
                            onClick={() => setRegistrarPagoViaje(v)}
                            className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist"
                          >
                            + Pago
                          </button>
                        )}
                        {viajeEstadoPermiteBotonFacturar(v.estado) && (
                          <button
                            type="button"
                            onClick={() => void navigateToFacturacion(v)}
                            className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 bg-vialto-charcoal text-white hover:bg-vialto-graphite"
                          >
                            Facturar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => startEdit(v)}
                          className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist"
                        >
                          Editar
                        </button>
                      </div>
                      {(() => {
                        const s = calcularSaldoTransportista(v);
                        if (!s || s.totalAcordado === 0) return null;
                        return (
                          <span className={`text-[10px] tabular-nums ${s.pagado ? 'text-emerald-700' : 'text-red-700'}`}>
                            {s.pagado
                              ? '✓ Transportista pagado'
                              : `Saldo: ${formatViajeImporteForListado(s.saldo, s.moneda)}`}
                          </span>
                        );
                      })()}
                    </div>
                  </td>
              </tr>
              </Fragment>
            );})}
          </tbody>
        </table>
      </div>

      {meta && (
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-sm text-vialto-steel">
              Página {meta.page} de {meta.totalPages} · {meta.total} registros
            </p>
            <label className="text-xs uppercase tracking-wider text-vialto-steel flex items-center gap-2">
              Mostrar
              <select
                value={pageSize}
                disabled={listadoRefetching}
                onChange={(e) => {
                  setListadoRefetching(true);
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="h-8 border border-black/20 bg-white px-2 text-xs disabled:opacity-50"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </label>
          </div>
          <div className="inline-flex gap-2">
            <button
              type="button"
              disabled={!meta.hasPrev || listadoRefetching}
              onClick={() => {
                setListadoRefetching(true);
                setPage((p) => Math.max(1, p - 1));
              }}
              className="h-9 px-3 border border-black/20 text-xs uppercase tracking-wider disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={!meta.hasNext || listadoRefetching}
              onClick={() => {
                setListadoRefetching(true);
                setPage((p) => p + 1);
              }}
              className="h-9 px-3 border border-black/20 text-xs uppercase tracking-wider disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {editingId && draft && viajeEdicionSnapshot && (
        <ViajeEditModal
          open
          draft={draft}
          setDraft={setDraft}
          snapshotViaje={viajeEdicionSnapshot}
          opcionesCarga={opcionesCargaModal}
          clientes={clientes}
          choferes={choferes}
          transportistas={transportistas}
          vehiculos={vehiculos}
          choferesPropios={choferesPropios}
          vehiculosPropios={vehiculosPropios}
          viajesConFactura={viajesConFactura}
          onModoChange={applyDraftModo}
          ayudaFlota={ayudaFlotaListado}
          viajeEditHint={viajeEditHint}
          fechaCargaError={fechaCargaError}
          fechaDescargaError={fechaDescargaError}
          onDraftFechasPatch={(p) => {
            setDraft((prev) => (prev ? { ...prev, ...p } : prev));
            if (p.fechaCarga) setFechaCargaError(null);
            if (p.fechaDescarga) setFechaDescargaError(null);
          }}
          onClose={cancelEdit}
          onSave={() => void saveInline(editingId)}
          saving={savingId === editingId}
          error={error}
          onCargaCreada={(carga) => {
            setCargasCatalogo((prev) =>
              prev.some((x) => x.id === carga.id) ? prev : [...prev, carga],
            );
          }}
        />
      )}

      <FacturarOpcionModal
        open={facturarOpcionState != null}
        facturas={facturarOpcionState?.facturas ?? []}
        busy={facturarOpcionBusy}
        onNuevaFactura={() => void handleFacturarOpcionConfirm('nueva')}
        onAgregarAExistente={(facturaId) => void handleFacturarOpcionConfirm({ facturaId })}
        onClose={() => setFacturarOpcionState(null)}
      />

      <AgregarGastoModal
        open={agregarGastoViaje != null}
        viaje={agregarGastoViaje}
        onSuccess={(updated) => {
          setRows((prev) => (prev ? prev.map((r) => (r.id === updated.id ? updated : r)) : prev));
          if (editingId === updated.id) {
            setDraft((d) =>
              d
                ? {
                    ...d,
                    otrosGastos: (updated.otrosGastos ?? []).map(otroGastoDraftFromApi),
                  }
                : d,
            );
          }
          setAgregarGastoViaje(null);
        }}
        onClose={() => setAgregarGastoViaje(null)}
      />

      <RegistrarPagoTransportistaModal
        open={registrarPagoViaje != null}
        viaje={registrarPagoViaje}
        onSuccess={(updated) => {
          setRows((prev) => (prev ? prev.map((r) => (r.id === updated.id ? updated : r)) : prev));
          if (editingId === updated.id) {
            setDraft((d) =>
              d
                ? {
                    ...d,
                    pagosTransportista: (updated.pagosTransportista ?? []).map(
                      pagoTransportistaDraftFromApi,
                    ),
                  }
                : d,
            );
          }
          setRegistrarPagoViaje(null);
        }}
        onClose={() => setRegistrarPagoViaje(null)}
      />

    </div>
  );
}
