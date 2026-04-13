import { useAuth } from '@clerk/clerk-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EmpresaFilterBar } from '@/components/superadmin/EmpresaFilterBar';
import { CiudadCombobox } from '@/components/forms/CiudadCombobox';
import { PaisUbicacionSelect } from '@/components/forms/PaisUbicacionSelect';
import { ViajeKmLitrosDialog } from '@/components/viajes/ViajeKmLitrosDialog';
import { ViajeEstadoCelda } from '@/components/viajes/ViajeEstadoCelda';
import { ViajeFechaHoraFields } from '@/components/viajes/ViajeFechaHoraFields';
import { ViajeInlineEditForm } from '@/components/viajes/ViajeInlineEditForm';
import { useTenantsList } from '@/hooks/useTenantsList';
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
  normalizarIdEnLista,
  textoMontoFacturarListado,
  vehiculoIdsDesdeRows,
  vehiculosFlotaPropia,
} from '@/lib/viajesFlota';
import { esEtiquetaCiudadValida, inferirPaisDesdeUbicacion } from '@/lib/ciudades';
import {
  estadoMuestraKmLitros,
  draftKmLitrosVacios,
  parseKmLitrosOpcionales,
  viajeTieneKmYLitrosEnApi,
} from '@/lib/viajesEstados';
import type { Chofer, Cliente, ConEmpresa, Transportista, Vehiculo, Viaje } from '@/types/api';
import type {
  KmLitrosPrompt,
  SaveInlineKmOpts,
  ViajeInlineDraft,
} from '@/components/viajes/viajesSuperadminTypes';
import { estadoViajeLabel } from '@/lib/viajesEstados';
import { fechaHoraToIso, isoToFechaHora } from '@/lib/viajeFechaHora';

// ─── helpers ────────────────────────────────────────────────────────────────

function formatFechaCarga(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

// ─── componente ─────────────────────────────────────────────────────────────

export function ViajesSuperadminPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const tenants = useTenantsList();

  const [rows, setRows] = useState<ConEmpresa<Viaje>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtroEmpresa, setFiltroEmpresa] = useState('');

  // edición inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ViajeInlineDraft | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  // estado quick
  const [estadoQuickId, setEstadoQuickId] = useState<string | null>(null);
  const [savingEstadoId, setSavingEstadoId] = useState<string | null>(null);

  // entidades de referencia
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [choferes, setChoferes] = useState<Chofer[]>([]);
  const [transportistas, setTransportistas] = useState<Transportista[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);

  // dialog km/litros
  const [kmLitrosPrompt, setKmLitrosPrompt] = useState<KmLitrosPrompt | null>(null);
  const [kmLitrosKm, setKmLitrosKm] = useState('');
  const [kmLitrosLitros, setKmLitrosLitros] = useState('');
  const [kmLitrosFieldError, setKmLitrosFieldError] = useState<string | null>(null);
  const [viajeEditHint, setViajeEditHint] = useState<string | null>(null);

  const choferesPropios = useMemo(() => choferesFlotaPropia(choferes), [choferes]);
  const vehiculosPropios = useMemo(() => vehiculosFlotaPropia(vehiculos), [vehiculos]);

  // ── fetch viajes ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (!filtroEmpresa) { setRows(null); setError(null); return; }
    let cancelled = false;
    setRows(null);
    (async () => {
      try {
        const data = await apiJson<ConEmpresa<Viaje>[]>(
          `/api/platform/viajes?tenantId=${encodeURIComponent(filtroEmpresa)}`,
          () => getToken(),
        );
        if (!cancelled) { setRows(data); setError(null); }
      } catch (e) {
        if (!cancelled) { setRows(null); setError(friendlyError(e, 'plataforma')); }
      }
    })();
    return () => { cancelled = true; };
  }, [getToken, isLoaded, isSignedIn, filtroEmpresa]);

  // ── fetch referencias (clientes, choferes, transportistas, vehículos) ──────

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !filtroEmpresa) {
      setClientes([]); setChoferes([]); setTransportistas([]); setVehiculos([]);
      return;
    }
    let cancelled = false;
    const q = `tenantId=${encodeURIComponent(filtroEmpresa)}`;
    (async () => {
      try {
        const [c, ch, tr, vh] = await Promise.all([
          apiJson<Cliente[]>(`/api/platform/clientes?${q}`, () => getToken()),
          apiJson<Chofer[]>(`/api/platform/choferes?${q}`, () => getToken()),
          apiJson<Transportista[]>(`/api/platform/transportistas?${q}`, () => getToken()),
          apiJson<Vehiculo[]>(`/api/platform/vehiculos?${q}`, () => getToken()),
        ]);
        if (!cancelled) { setClientes(c); setChoferes(ch); setTransportistas(tr); setVehiculos(vh); }
      } catch {
        if (!cancelled) { setClientes([]); setChoferes([]); setTransportistas([]); setVehiculos([]); }
      }
    })();
    return () => { cancelled = true; };
  }, [filtroEmpresa, getToken, isLoaded, isSignedIn]);

  // normalizar IDs del draft cuando cambia la lista de referencias
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

  async function navigateToFacturacion(v: ConEmpresa<Viaje>) {
    if (filtroEmpresa) {
      try {
        const facturas = await apiJson<{ id: string; viajeId: string | null }[]>(
          `/api/platform/facturacion/facturas?tenantId=${encodeURIComponent(filtroEmpresa)}`,
          () => getToken(),
        );
        const existente = facturas.find((f) => f.viajeId === v.id);
        if (existente) {
          navigate('/facturacion', { state: { expandFacturaId: existente.id } });
          return;
        }
      } catch {
        // si falla la consulta, igualmente navegamos para no bloquear al usuario
      }
    }
    navigate('/facturacion', {
      state: {
        tenantId: filtroEmpresa,
        newFacturaDraft: {
          clienteId: v.clienteId ?? '',
          viajeId: v.id,
          importe: v.monto ?? 0,
        },
      },
    });
  }

  // ── edición inline ─────────────────────────────────────────────────────────

  function startEdit(v: ConEmpresa<Viaje>) {
    setEstadoQuickId(null);
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
      paisOrigen: inferirPaisDesdeUbicacion(v.origen ?? ''),
      paisDestino: inferirPaisDesdeUbicacion(v.destino ?? ''),
      origen: v.origen ?? '',
      destino: v.destino ?? '',
      fechaCarga: partesFc.fecha,
      horaCarga: partesFc.hora,
      fechaDescarga: partesFd.fecha,
      horaDescarga: partesFd.hora,
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
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
    setEstadoQuickId(null);
    setViajeEditHint(null);
  }

  // ── cambio de estado (quick, desde el badge) ───────────────────────────────

  async function patchEstadoDesdeListado(v: ConEmpresa<Viaje>, nuevoEstado: string) {
    if (!filtroEmpresa) { setError('Seleccioná una empresa.'); setEstadoQuickId(null); return; }
    if (nuevoEstado === v.estado) { setEstadoQuickId(null); return; }
    if (estadoMuestraKmLitros(nuevoEstado) && !viajeTieneKmYLitrosEnApi(v)) {
      setKmLitrosKm(v.kmRecorridos != null ? String(v.kmRecorridos) : '');
      setKmLitrosLitros(v.litrosConsumidos != null ? String(v.litrosConsumidos) : '');
      setKmLitrosPrompt({ kind: 'quick', viaje: v, nuevoEstado });
      setKmLitrosFieldError(null);
      setEstadoQuickId(null);
      return;
    }
    setSavingEstadoId(v.id);
    setError(null);
    try {
      const updated = await apiJson<ConEmpresa<Viaje>>(
        `/api/platform/viajes/${encodeURIComponent(v.id)}?tenantId=${encodeURIComponent(filtroEmpresa)}`,
        () => getToken(),
        { method: 'PATCH', body: JSON.stringify({ estado: nuevoEstado }) },
      );
      setRows((prev) => prev?.map((r) => (r.id === v.id ? updated : r)) ?? prev);
      setEstadoQuickId(null);
      if (nuevoEstado === 'facturado_sin_cobrar') navigateToFacturacion(v);
    } catch (e) {
      setError(friendlyError(e, 'plataforma'));
    } finally {
      setSavingEstadoId(null);
    }
  }

  async function patchEstadoConKmLitros(
    v: ConEmpresa<Viaje>,
    nuevoEstado: string,
    km?: number,
    litros?: number,
  ): Promise<boolean> {
    if (!filtroEmpresa) return false;
    setSavingEstadoId(v.id);
    setError(null);
    try {
      const body: Record<string, unknown> = { estado: nuevoEstado };
      if (km !== undefined) body.kmRecorridos = km;
      if (litros !== undefined) body.litrosConsumidos = litros;
      const updated = await apiJson<ConEmpresa<Viaje>>(
        `/api/platform/viajes/${encodeURIComponent(v.id)}?tenantId=${encodeURIComponent(filtroEmpresa)}`,
        () => getToken(),
        { method: 'PATCH', body: JSON.stringify(body) },
      );
      setRows((prev) => prev?.map((r) => (r.id === v.id ? updated : r)) ?? prev);
      setEstadoQuickId(null);
      if (nuevoEstado === 'facturado_sin_cobrar') navigateToFacturacion(v);
      return true;
    } catch (e) {
      setError(friendlyError(e, 'plataforma'));
      return false;
    } finally {
      setSavingEstadoId(null);
    }
  }

  // ── dialog km/litros ───────────────────────────────────────────────────────

  function confirmKmLitrosDialog() {
    const parsed = parseKmLitrosOpcionales(kmLitrosKm, kmLitrosLitros);
    if (!parsed.ok) { setKmLitrosFieldError(parsed.message); return; }
    setKmLitrosFieldError(null);
    if (!kmLitrosPrompt) return;

    if (kmLitrosPrompt.kind === 'quick') {
      const { viaje, nuevoEstado } = kmLitrosPrompt;
      void patchEstadoConKmLitros(viaje, nuevoEstado, parsed.km, parsed.litros).then(
        (ok) => { if (ok) setKmLitrosPrompt(null); },
      );
      return;
    }
    if (kmLitrosPrompt.kind === 'estado-draft') {
      const { nextEstado } = kmLitrosPrompt;
      setDraft((p) =>
        p ? {
          ...p,
          estado: nextEstado,
          kmRecorridos: parsed.km !== undefined ? String(parsed.km) : '',
          litrosConsumidos: parsed.litros !== undefined ? String(parsed.litros) : '',
        } : p,
      );
      setKmLitrosPrompt(null);
      return;
    }
    const viajeId = kmLitrosPrompt.viajeId;
    setKmLitrosPrompt(null);
    void saveInline(viajeId, { skipKmLitrosPrompt: true, kmRecorridos: parsed.km, litrosConsumidos: parsed.litros });
  }

  function cancelKmLitrosDialog() {
    setKmLitrosPrompt(null);
    setKmLitrosFieldError(null);
  }

  // ── guardar edición inline ─────────────────────────────────────────────────

  async function saveInline(viajeId: string, opts?: SaveInlineKmOpts) {
    if (!draft || !filtroEmpresa) { setError('Seleccioná una empresa para guardar.'); return; }
    if (!draft.numero.trim()) { setError('Ingresá el número de viaje.'); return; }

    const externo = draft.operacionModo === 'externo';
    if (externo && !draft.transportistaId.trim()) { setError('Seleccioná un transportista externo.'); return; }
    const vids = vehiculoIdsDesdeRows(draft.vehiculosRows);
    if (!externo && vids.length === 0) {
      setError('Agregá al menos un vehículo al viaje (tipo y patente desde el maestro).');
      return;
    }
    if (
      !externo &&
      !flotaPropiaVehiculosListaValida(draft.choferId, vids, choferesPropios, vehiculosPropios)
    ) {
      setError('En flota propia, elegí chofer y vehículos de las listas.');
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
        setError('Origen y destino deben elegirse de la lista de ciudades.');
        return;
      }
    }

    if (
      !opts?.skipKmLitrosPrompt &&
      estadoMuestraKmLitros(draft.estado) &&
      draftKmLitrosVacios(draft.kmRecorridos, draft.litrosConsumidos)
    ) {
      setKmLitrosKm(draft.kmRecorridos);
      setKmLitrosLitros(draft.litrosConsumidos);
      setKmLitrosPrompt({ kind: 'save', viajeId });
      setKmLitrosFieldError(null);
      return;
    }

    const kmResolved = opts?.skipKmLitrosPrompt
      ? opts.kmRecorridos
      : draft.kmRecorridos.trim() ? Number(draft.kmRecorridos.replace(',', '.')) : undefined;
    const litResolved = opts?.skipKmLitrosPrompt
      ? opts.litrosConsumidos
      : draft.litrosConsumidos.trim() ? Number(draft.litrosConsumidos.replace(',', '.')) : undefined;

    setSavingId(viajeId);
    setError(null);
    try {
      const updated = await apiJson<ConEmpresa<Viaje>>(
        `/api/platform/viajes/${encodeURIComponent(viajeId)}?tenantId=${encodeURIComponent(filtroEmpresa)}`,
        () => getToken(),
        {
          method: 'PATCH',
          body: JSON.stringify({
            numero: draft.numero.trim(),
            estado: draft.estado,
            clienteId: draft.clienteId || undefined,
            ...(externo
              ? { transportistaId: draft.transportistaId.trim(), choferId: null, vehiculoIds: [] }
              : {
                  transportistaId: null,
                  choferId: draft.choferId.trim(),
                  vehiculoIds: vids,
                }),
            origen: draft.origen.trim() || undefined,
            destino: draft.destino.trim() || undefined,
            fechaCarga: fechaHoraToIso(draft.fechaCarga, draft.horaCarga),
            fechaDescarga: fechaHoraToIso(draft.fechaDescarga, draft.horaDescarga),
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
          }),
        },
      );
      setRows((prev) => prev?.map((r) => (r.id === viajeId ? { ...r, ...updated } : r)) ?? prev);
      const wasFacturado = draft.estado === 'facturado_sin_cobrar';
      cancelEdit();
      if (wasFacturado) navigateToFacturacion(updated);
    } catch (e) {
      setError(friendlyError(e, 'plataforma'));
    } finally {
      setSavingId(null);
    }
  }

  // ── render ─────────────────────────────────────────────────────────────────

  const tableColSpan = editingId ? 5 : 6;

  return (
    <div className="w-full">
      <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-wide text-vialto-charcoal">
        Viajes
      </h1>
      <p className="mt-2 text-vialto-steel max-w-3xl">
        Elegí una empresa para listar viajes de esa org.
      </p>

      <div className="mt-6">
        <EmpresaFilterBar tenants={tenants} value={filtroEmpresa} onChange={setFiltroEmpresa} />
      </div>

      {/* Acciones */}
      <div className="mt-4 flex justify-end gap-2">
        {editingId ? (
          <>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={savingId === editingId}
              className="inline-flex h-10 items-center px-4 border border-black/20 bg-white text-vialto-charcoal text-sm uppercase tracking-wider hover:bg-vialto-mist disabled:opacity-60"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={() => saveInline(editingId)}
              disabled={savingId === editingId}
              className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite disabled:opacity-60"
            >
              {savingId === editingId ? 'Guardando…' : 'Modificar cambios'}
            </button>
          </>
        ) : (
          <Link
            to={filtroEmpresa ? `/viajes/nuevo?tenantId=${encodeURIComponent(filtroEmpresa)}` : '/viajes/nuevo'}
            className="inline-flex h-10 items-center px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
          >
            Crear viaje
          </Link>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      {/* Tabla */}
      <div className="mt-8 overflow-x-auto rounded border border-black/5 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-black/10 bg-vialto-mist font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-vialto-fire">
              <th className="px-4 py-3">Número</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Origen</th>
              <th className="px-4 py-3">Destino</th>
              <th className="px-4 py-3">Fecha de carga</th>
              <th className="px-4 py-3 text-right">Monto a facturar</th>
              {!editingId && <th className="px-4 py-3 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {!filtroEmpresa && (
              <tr>
                <td colSpan={tableColSpan} className="px-4 py-8 text-vialto-steel">
                  Seleccioná una empresa para ver los viajes.
                </td>
              </tr>
            )}
            {filtroEmpresa && rows === null && !error && (
              <tr>
                <td colSpan={tableColSpan} className="px-4 py-8 text-vialto-steel">Cargando…</td>
              </tr>
            )}
            {filtroEmpresa && rows?.length === 0 && !error && (
              <tr>
                <td colSpan={tableColSpan} className="px-4 py-8 text-vialto-steel">
                  No hay viajes registrados para esta empresa.
                </td>
              </tr>
            )}

            {filtroEmpresa && rows?.map((v) => (
              <Fragment key={v.id}>
                {/* ── fila resumen ── */}
                <tr className="border-b border-black/5 hover:bg-vialto-mist/80">

                  {/* Número */}
                  <td className="px-4 py-3 font-medium">
                    {draft && editingId === v.id ? draft.numero : v.numero}
                  </td>

                  {/* Estado */}
                  <td className="px-4 py-3">
                    <ViajeEstadoCelda
                      viajeId={v.id}
                      viajeEstado={v.estado}
                      isEditing={editingId === v.id}
                      draft={draft}
                      isQuickOpen={estadoQuickId === v.id}
                      isSavingEstado={savingEstadoId === v.id}
                      onDraftEstadoChange={(next) =>
                        setDraft((p) => (p ? { ...p, estado: next } : p))
                      }
                      onRequiereKmLitrosDraft={(next) => {
                        if (!draft) return;
                        setKmLitrosKm(draft.kmRecorridos);
                        setKmLitrosLitros(draft.litrosConsumidos);
                        setKmLitrosPrompt({ kind: 'estado-draft', nextEstado: next });
                        setKmLitrosFieldError(null);
                      }}
                      onQuickEstadoChange={(next) => void patchEstadoDesdeListado(v, next)}
                      onQuickOpen={() => { if (!savingEstadoId) setEstadoQuickId(v.id); }}
                      onQuickClose={() => setEstadoQuickId(null)}
                    />
                  </td>

                  {/* Origen */}
                  <td className={`px-4 py-3 text-vialto-steel ${editingId === v.id ? 'min-w-[220px]' : 'max-w-[160px] truncate'}`}>
                    {editingId === v.id && draft ? (
                      <div className="flex flex-col gap-1">
                        <PaisUbicacionSelect
                          value={draft.paisOrigen}
                          onChange={(p) => setDraft((prev) => prev ? { ...prev, paisOrigen: p, origen: '' } : prev)}
                          aria-label="País de origen"
                          className="h-8 w-full min-w-[140px] border border-black/15 bg-white px-2 text-xs"
                        />
                        <CiudadCombobox
                          pais={draft.paisOrigen}
                          value={draft.origen}
                          onChange={(next) => setDraft((prev) => prev ? { ...prev, origen: next } : prev)}
                          inputClassName="h-9 w-full min-w-[200px] border border-black/15 bg-white px-2 text-sm"
                        />
                      </div>
                    ) : (v.origen ?? '—')}
                  </td>

                  {/* Destino */}
                  <td className={`px-4 py-3 text-vialto-steel ${editingId === v.id ? 'min-w-[220px]' : 'max-w-[160px] truncate'}`}>
                    {editingId === v.id && draft ? (
                      <div className="flex flex-col gap-1">
                        <PaisUbicacionSelect
                          value={draft.paisDestino}
                          onChange={(p) => setDraft((prev) => prev ? { ...prev, paisDestino: p, destino: '' } : prev)}
                          aria-label="País de destino"
                          className="h-8 w-full min-w-[140px] border border-black/15 bg-white px-2 text-xs"
                        />
                        <CiudadCombobox
                          pais={draft.paisDestino}
                          value={draft.destino}
                          onChange={(next) => setDraft((prev) => prev ? { ...prev, destino: next } : prev)}
                          inputClassName="h-9 w-full min-w-[200px] border border-black/15 bg-white px-2 text-sm"
                        />
                      </div>
                    ) : (v.destino ?? '—')}
                  </td>

                  {/* Fecha de carga */}
                  <td className="px-4 py-3 text-vialto-steel whitespace-nowrap tabular-nums align-top">
                    {editingId === v.id && draft ? (
                      <ViajeFechaHoraFields
                        mode="cargaOnly"
                        fechaCarga={draft.fechaCarga}
                        horaCarga={draft.horaCarga}
                        fechaDescarga={draft.fechaDescarga}
                        horaDescarga={draft.horaDescarga}
                        onPatch={(p) => setDraft((prev) => (prev ? { ...prev, ...p } : prev))}
                        labelClassName="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.15em] text-vialto-steel"
                        inputClassName="h-8 w-full min-w-[8.5rem] border border-black/15 bg-white px-2 text-xs"
                      />
                    ) : formatFechaCarga(v.fechaCarga)}
                  </td>

                  {/* Monto */}
                  <td className="px-4 py-3 text-right tabular-nums">
                    {textoMontoFacturarListado(v)}
                  </td>

                  {/* Acciones */}
                  {!editingId && (
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => startEdit(v)}
                        className="text-xs uppercase tracking-wider px-2 py-1 border border-black/20 hover:bg-vialto-mist"
                      >
                        Editar
                      </button>
                    </td>
                  )}
                </tr>

                {/* ── fila de edición expandida ── */}
                {editingId === v.id && draft && (
                  <ViajeInlineEditForm
                    draft={draft}
                    setDraft={setDraft}
                    clientes={clientes}
                    choferes={choferes}
                    transportistas={transportistas}
                    vehiculos={vehiculos}
                    crearVehiculoHref={
                      filtroEmpresa
                        ? `/vehiculos/nuevo?tenantId=${encodeURIComponent(filtroEmpresa)}`
                        : '/vehiculos/nuevo'
                    }
                    inconsistenciaHint={viajeEditHint}
                    tableColSpan={tableColSpan}
                    saving={savingId === v.id}
                    formError={error}
                    onSave={() => saveInline(v.id)}
                    onCancel={cancelEdit}
                  />
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Dialog km/litros */}
      <ViajeKmLitrosDialog
        open={kmLitrosPrompt != null}
        title={
          kmLitrosPrompt?.kind === 'quick'
            ? `Cambiar a «${estadoViajeLabel[kmLitrosPrompt.nuevoEstado] ?? kmLitrosPrompt.nuevoEstado}»`
            : kmLitrosPrompt?.kind === 'estado-draft'
              ? `Estado «${estadoViajeLabel[kmLitrosPrompt.nextEstado] ?? kmLitrosPrompt.nextEstado}»`
              : 'Guardar viaje'
        }
        km={kmLitrosKm}
        litros={kmLitrosLitros}
        error={kmLitrosFieldError}
        busy={
          (kmLitrosPrompt?.kind === 'quick' && savingEstadoId === kmLitrosPrompt.viaje.id) ||
          (kmLitrosPrompt?.kind === 'save' && savingId === kmLitrosPrompt.viajeId)
        }
        onKmChange={setKmLitrosKm}
        onLitrosChange={setKmLitrosLitros}
        onConfirm={confirmKmLitrosDialog}
        onCancel={cancelKmLitrosDialog}
      />
    </div>
  );
}
