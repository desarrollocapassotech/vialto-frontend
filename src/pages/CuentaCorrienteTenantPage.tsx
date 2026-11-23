import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, FileDown, Store, Users } from 'lucide-react';
import { SelectorOpcionesSheet, selectorTriggerClass } from '@/components/ui/SelectorOpcionesSheet';
import { useMaestroData } from '@/hooks/useMaestroData';
import { useProveedores } from '@/hooks/useProveedores';
import { useBreadcrumbOverride } from '@/hooks/useBreadcrumbOverride';
import { ListadoCuentasCc } from '@/components/cuenta-corriente/ListadoCuentasCc';
import { ClienteModal } from '@/components/viajes/ClienteModal';
import { TransportistaModal } from '@/components/viajes/TransportistaModal';
import { CuentaContraparteView } from '@/components/cuenta-corriente/CuentaContraparteView';
import { pageTitleClass } from '@/lib/listadoTabla';
import { friendlyError } from '@/lib/friendlyError';
import { apiJson } from '@/lib/api';
import { QUERY_TODOS_LOS_PROVEEDORES } from '@/lib/proveedorTipo';
import { descargarListadoDeudoresPdf, type TipoContraparte } from '@/lib/cuentaCorriente';
import type { Cliente, Transportista } from '@/types/api';

type QuickCreate = 'cliente' | 'transportista' | null;

const TABS: { id: TipoContraparte; label: string; icon: typeof Users }[] = [
  { id: 'cliente', label: 'Clientes', icon: Users },
  { id: 'proveedor', label: 'Proveedores', icon: Store },
];

type Props = {
  /**
   * Superadmin (`CuentaCorrienteSuperadminPage`): empresa elegida. Clientes y proveedores
   * se traen por plataforma; los saldos y movimientos, con `setTenantLecturaCc`.
   */
  tenantId?: string;
  /** Vista de solo lectura del superadmin: sin altas, cargas, imputaciones ni eliminar. */
  soloLectura?: boolean;
  /** Módulos de la empresa elegida (superadmin). */
  modulosEmpresa?: string[];
};

/** Clientes y proveedores de otra empresa (superadmin), por las rutas de plataforma. */
function useCuentasEmpresa(tenantId: string | undefined) {
  const { getToken } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [proveedores, setProveedores] = useState<Transportista[]>([]);
  const [loading, setLoading] = useState(Boolean(tenantId));

  useEffect(() => {
    if (!tenantId) return;
    let cancelado = false;
    setLoading(true);
    const tid = encodeURIComponent(tenantId);
    Promise.all([
      apiJson<Cliente[]>(`/api/platform/clientes?tenantId=${tid}`, () => getToken()),
      apiJson<Transportista[]>(
        `/api/platform/transportistas?tenantId=${tid}&${QUERY_TODOS_LOS_PROVEEDORES}`,
        () => getToken(),
      ),
    ])
      .then(([c, p]) => {
        if (cancelado) return;
        setClientes(c);
        setProveedores(p);
      })
      .catch(() => {
        if (cancelado) return;
        setClientes([]);
        setProveedores([]);
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [tenantId, getToken]);

  return { clientes, proveedores, loading };
}

export function CuentaCorrienteTenantPage({ tenantId, soloLectura = false, modulosEmpresa }: Props = {}) {
  const { getToken } = useAuth();
  // Pestaña y cuenta abierta en la URL (`?tipo=proveedor&id=...`): el Atrás del navegador vuelve
  // al listado, y es el mismo link que usa el tablero del dashboard.
  const [searchParams, setSearchParams] = useSearchParams();
  // Proveedores de todo tipo (transportistas, talleres, otros): la pestaña está siempre,
  // también en empresas solo de flota propia.
  const tipoContraparte: TipoContraparte = searchParams.get('tipo') === 'proveedor' ? 'proveedor' : 'cliente';
  const contraparteId = searchParams.get('id') ?? '';
  const [descargando, setDescargando] = useState(false);
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null);
  const maestro = useMaestroData();
  const proveedoresApi = useProveedores();
  const otraEmpresa = useCuentasEmpresa(tenantId);
  const baseClientes = tenantId ? otraEmpresa.clientes : maestro.clientes;
  const baseProveedores = tenantId ? otraEmpresa.proveedores : proveedoresApi.proveedores;
  const maestroLoading = tenantId
    ? otraEmpresa.loading
    : tipoContraparte === 'cliente'
      ? maestro.loading
      : proveedoresApi.loading;

  // Se muestran de inmediato tras crearlos desde el select (antes de que termine el
  // refetch de `useMaestroData`), igual que en la creación de un viaje.
  const [sessionClientes, setSessionClientes] = useState<Cliente[]>([]);
  const clientes = useMemo(() => {
    const ids = new Set(baseClientes.map((c) => c.id));
    return [...baseClientes, ...sessionClientes.filter((c) => !ids.has(c.id))];
  }, [baseClientes, sessionClientes]);

  const [sessionTransportistas, setSessionTransportistas] = useState<Transportista[]>([]);
  const transportistas = useMemo(() => {
    const ids = new Set(baseProveedores.map((t) => t.id));
    return [...baseProveedores, ...sessionTransportistas.filter((t) => !ids.has(t.id))];
  }, [baseProveedores, sessionTransportistas]);

  const [quickCreate, setQuickCreate] = useState<QuickCreate>(null);
  const [accionesSlot, setAccionesSlot] = useState<HTMLDivElement | null>(null);
  const [limpiarSlot, setLimpiarSlot] = useState<HTMLDivElement | null>(null);
  const [filtrosRapidosSlot, setFiltrosRapidosSlot] = useState<HTMLDivElement | null>(null);

  async function handleDescargarListado() {
    setDescargando(true);
    setErrorDescarga(null);
    try {
      // Pestaña Clientes → pendientes de cobro; Proveedores → pendientes de pago.
      await descargarListadoDeudoresPdf(() => getToken(), tipoContraparte);
    } catch (e) {
      setErrorDescarga(friendlyError(e, 'cuentaCorriente'));
    } finally {
      setDescargando(false);
    }
  }

  const cuentas = tipoContraparte === 'cliente' ? clientes : transportistas;
  const contraparteNombre = contraparteId
    ? (cuentas.find((x) => x.id === contraparteId)?.nombre ?? null)
    : null;

  /** Link a la cuenta o al listado de una pestaña, sin perder otros parámetros de la URL. */
  function urlDe(tipo: TipoContraparte, id?: string) {
    const next = new URLSearchParams(searchParams);
    next.delete('id');
    next.delete('tipo');
    if (tipo === 'proveedor') next.set('tipo', tipo);
    if (id) next.set('id', id);
    return next;
  }

  const hrefListado = (() => {
    const qs = urlDe(tipoContraparte).toString();
    return qs ? `/cuenta-corriente?${qs}` : '/cuenta-corriente';
  })();
  // Cuenta abierta: su nombre en el breadcrumb, que es también el camino de vuelta al listado.
  useBreadcrumbOverride(
    contraparteNombre
      ? [
          { label: 'Inicio', to: '/' },
          { label: 'Cuenta corriente', to: hrefListado },
          { label: contraparteNombre },
        ]
      : null,
  );

  const [sectionSheetOpen, setSectionSheetOpen] = useState(false);
  const activeTabDef = TABS.find((t) => t.id === tipoContraparte);
  const ActiveIcon = activeTabDef?.icon;

  function elegirTipo(tipo: TipoContraparte) {
    setSectionSheetOpen(false);
    // También vuelve al listado si se toca la pestaña actual con una cuenta abierta.
    if (tipo === tipoContraparte && !contraparteId) return;
    setSearchParams(urlDe(tipo));
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4">
          {/* Embebida en superadmin, el título lo pone la página de superadmin. */}
          {!tenantId && <h1 className={pageTitleClass}>Cuenta corriente</h1>}
          {/* Filtro rápido ("Sin imputar") al lado del título, como en Viajes. */}
          <div ref={setFiltrosRapidosSlot} className="flex min-w-0 items-center gap-2 empty:hidden" />
          <div ref={setLimpiarSlot} className="empty:hidden" />
        </div>
        <div className="flex flex-wrap gap-2">
          {/* PDF del lado de la pestaña: pendientes de cobro (clientes) o de pago (proveedores). */}
          <button
            type="button"
            onClick={handleDescargarListado}
            disabled={descargando}
            className="inline-flex h-10 items-center gap-2 px-4 border border-black/20 text-vialto-steel text-sm uppercase tracking-wider hover:bg-vialto-mist disabled:opacity-50"
          >
            <FileDown className="h-4 w-4" />
            {descargando
              ? 'Generando…'
              : tipoContraparte === 'cliente'
                ? 'Pendientes de cobro'
                : 'Pendientes de pago'}
          </button>
          {/* Acción principal, negra y última a la derecha (como "Crear viaje"). */}
          {!contraparteId && !soloLectura && (
            <button
              type="button"
              onClick={() => setQuickCreate(tipoContraparte === 'cliente' ? 'cliente' : 'transportista')}
              className="inline-flex h-10 items-center gap-2 px-4 bg-vialto-charcoal text-white text-sm uppercase tracking-wider hover:bg-vialto-graphite"
            >
              {tipoContraparte === 'cliente' ? 'Nuevo cliente' : 'Nuevo proveedor'}
            </button>
          )}
        </div>
      </div>

      {errorDescarga && (
        <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {errorDescarga}
        </p>
      )}

      {/* Pestañas Clientes / Proveedores: mismo estilo que Mantenimiento. */}
      <div className="mt-6 border-b border-black/15">
          <div className="pb-3 lg:hidden">
            <button
              type="button"
              onClick={() => setSectionSheetOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={sectionSheetOpen}
              className={selectorTriggerClass}
            >
              <span className="font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.22em] text-vialto-steel">
                Sección
              </span>
              <span className="flex min-w-0 flex-1 items-center justify-end gap-2">
                {ActiveIcon && <ActiveIcon className="h-4 w-4 shrink-0 text-vialto-steel" strokeWidth={1.75} aria-hidden />}
                <span className="truncate font-[family-name:var(--font-ui)] text-sm uppercase tracking-wider text-vialto-charcoal">
                  {activeTabDef?.label}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-vialto-steel" strokeWidth={2} aria-hidden />
              </span>
            </button>
            <SelectorOpcionesSheet
              open={sectionSheetOpen}
              onClose={() => setSectionSheetOpen(false)}
              title="Elegir sección"
              options={TABS.map((t) => ({ id: t.id, label: t.label }))}
              activeId={tipoContraparte}
              onSelect={(id) => elegirTipo(id as TipoContraparte)}
            />
          </div>

          <nav className="-mb-px hidden gap-1 overflow-x-auto lg:flex" aria-label="Secciones de cuenta corriente">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => elegirTipo(tab.id)}
                className={[
                  'flex shrink-0 whitespace-nowrap items-center gap-2 px-5 py-2.5 font-[family-name:var(--font-ui)] text-xs font-semibold uppercase tracking-[0.18em] rounded-t-sm transition-colors border',
                  tipoContraparte === tab.id
                    ? 'border-black/15 border-t-2 border-t-vialto-fire border-b-vialto-mist bg-vialto-mist text-vialto-charcoal'
                    : 'border-transparent text-vialto-steel hover:text-vialto-charcoal hover:bg-black/[0.04]',
                ].join(' ')}
              >
                <tab.icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

      <div className="mt-6">
        {/* Siempre montada: los portales de CuentaContraparteView ya tienen dónde dibujar. */}
        <div className={contraparteId ? 'mb-6 flex flex-wrap items-end gap-3' : 'hidden'}>
          {/* Exportar / Nueva venta / Registrar cobro, a la derecha en la misma fila (portal). */}
          <div ref={setAccionesSlot} className="ml-auto flex empty:hidden" />
        </div>

        {!contraparteId ? (
          <ListadoCuentasCc
            key={tipoContraparte}
            tipoContraparte={tipoContraparte}
            cuentas={cuentas}
            cargandoCuentas={maestroLoading}
            onAbrir={(id) => setSearchParams(urlDe(tipoContraparte, id))}
            limpiarFiltrosSlot={limpiarSlot}
          />
        ) : contraparteNombre ? (
          <CuentaContraparteView
            key={`${tipoContraparte}-${contraparteId}`}
            tipoContraparte={tipoContraparte}
            contraparteId={contraparteId}
            contraparteNombre={contraparteNombre}
            proveedorTipo={
              tipoContraparte === 'proveedor'
                ? (transportistas.find((t) => t.id === contraparteId)?.tipo ?? null)
                : null
            }
            accionesSlot={accionesSlot}
            limpiarFiltrosSlot={limpiarSlot}
            filtrosRapidosSlot={filtrosRapidosSlot}
            soloLectura={soloLectura}
            otraEmpresa={Boolean(tenantId)}
            modulosEmpresa={modulosEmpresa}
          />
        ) : (
          <p className="text-vialto-steel">
            {maestroLoading
              ? 'Cargando…'
              : `No se encontró ese ${tipoContraparte === 'cliente' ? 'cliente' : 'proveedor'}.`}
          </p>
        )}
      </div>

      {quickCreate === 'cliente' && (
        <ClienteModal
          getToken={getToken}
          onClose={() => setQuickCreate(null)}
          onSaved={(c) => {
            setSessionClientes((prev) => [...prev, c]);
            setSearchParams(urlDe('cliente', c.id));
            setQuickCreate(null);
            void maestro.refreshClientes();
          }}
        />
      )}
      {quickCreate === 'transportista' && (
        <TransportistaModal
          getToken={getToken}
          elegirTipo
          onClose={() => setQuickCreate(null)}
          onSaved={(t) => {
            setSessionTransportistas((prev) => [...prev, t]);
            setSearchParams(urlDe('proveedor', t.id));
            setQuickCreate(null);
            void proveedoresApi.refresh();
            if (t.tipo === 'transportista') void maestro.refreshTransportistas();
          }}
        />
      )}
    </div>
  );
}
