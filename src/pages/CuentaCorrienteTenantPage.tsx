import { useAuth } from '@clerk/clerk-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, FileDown, Plus, Truck, Users } from 'lucide-react';
import { SelectorOpcionesSheet, selectorTriggerClass } from '@/components/ui/SelectorOpcionesSheet';
import { useMaestroData } from '@/hooks/useMaestroData';
import { useTipoFlotaVisible } from '@/hooks/useTipoFlotaVisible';
import { useBreadcrumbOverride } from '@/hooks/useBreadcrumbOverride';
import { ListadoCuentasCc } from '@/components/cuenta-corriente/ListadoCuentasCc';
import { ClienteModal } from '@/components/viajes/ClienteModal';
import { TransportistaModal } from '@/components/viajes/TransportistaModal';
import { CuentaContraparteView } from '@/components/cuenta-corriente/CuentaContraparteView';
import { pageTitleClass } from '@/lib/listadoTabla';
import { friendlyError } from '@/lib/friendlyError';
import { descargarListadoDeudoresPdf, type TipoContraparte } from '@/lib/cuentaCorriente';
import type { Cliente, Transportista } from '@/types/api';

type QuickCreate = 'cliente' | 'transportista' | null;

const TABS: { id: TipoContraparte; label: string; icon: typeof Users }[] = [
  { id: 'cliente', label: 'Clientes', icon: Users },
  { id: 'proveedor', label: 'Proveedores', icon: Truck },
];

export function CuentaCorrienteTenantPage() {
  const { getToken } = useAuth();
  // Pestaña y cuenta abierta en la URL (`?tipo=proveedor&id=...`): el Atrás del navegador vuelve
  // al listado, y es el mismo link que usa el tablero del dashboard.
  const [searchParams, setSearchParams] = useSearchParams();
  const tipoElegido: TipoContraparte = searchParams.get('tipo') === 'proveedor' ? 'proveedor' : 'cliente';
  // Empresa solo de flota propia (Tenant.tipoFlota): no tiene transportistas,
  // así que no hay cuentas de proveedores — queda fijo en Clientes, sin selector.
  const { transportistaExternoVisible: hayProveedores } = useTipoFlotaVisible();
  const tipoContraparte: TipoContraparte = hayProveedores ? tipoElegido : 'cliente';
  const contraparteId = searchParams.get('id') ?? '';
  const [descargando, setDescargando] = useState(false);
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null);
  const maestro = useMaestroData();
  const maestroLoading = maestro.loading;

  // Se muestran de inmediato tras crearlos desde el select (antes de que termine el
  // refetch de `useMaestroData`), igual que en la creación de un viaje.
  const [sessionClientes, setSessionClientes] = useState<Cliente[]>([]);
  const clientes = useMemo(() => {
    const ids = new Set(maestro.clientes.map((c) => c.id));
    return [...maestro.clientes, ...sessionClientes.filter((c) => !ids.has(c.id))];
  }, [maestro.clientes, sessionClientes]);

  const [sessionTransportistas, setSessionTransportistas] = useState<Transportista[]>([]);
  const transportistas = useMemo(() => {
    const ids = new Set(maestro.transportistas.map((t) => t.id));
    return [...maestro.transportistas, ...sessionTransportistas.filter((t) => !ids.has(t.id))];
  }, [maestro.transportistas, sessionTransportistas]);

  const [quickCreate, setQuickCreate] = useState<QuickCreate>(null);
  const [saldosSlot, setSaldosSlot] = useState<HTMLDivElement | null>(null);
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
          <h1 className={pageTitleClass}>Cuenta corriente</h1>
          {/* Filtro rápido ("Sin imputar") al lado del título, como en Viajes. */}
          <div ref={setFiltrosRapidosSlot} className="flex min-w-0 items-center gap-2 empty:hidden" />
          <div ref={setLimpiarSlot} className="empty:hidden" />
        </div>
        <div className="flex flex-wrap gap-2">
          {!contraparteId && (
            <button
              type="button"
              onClick={() => setQuickCreate(tipoContraparte === 'cliente' ? 'cliente' : 'transportista')}
              className="inline-flex h-10 items-center gap-2 px-4 border border-black/20 text-vialto-steel text-sm uppercase tracking-wider hover:bg-vialto-mist"
            >
              <Plus className="h-4 w-4" />
              {tipoContraparte === 'cliente' ? 'Nuevo cliente' : 'Nuevo proveedor'}
            </button>
          )}
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
        </div>
      </div>

      {errorDescarga && (
        <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {errorDescarga}
        </p>
      )}

      {/* Pestañas Clientes / Proveedores: mismo estilo que Mantenimiento. */}
      {hayProveedores && (
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
      )}

      <div className="mt-6">
        {/* Siempre montada: los portales de CuentaContraparteView ya tienen dónde dibujar. */}
        <div className={contraparteId ? 'mb-6 flex flex-wrap items-end gap-3' : 'hidden'}>
          {/* Las tarjetas de saldo de la cuenta elegida se dibujan acá (portal desde CuentaContraparteView). */}
          <div ref={setSaldosSlot} className="flex flex-wrap gap-2" />
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
            saldosSlot={saldosSlot}
            accionesSlot={accionesSlot}
            limpiarFiltrosSlot={limpiarSlot}
            filtrosRapidosSlot={filtrosRapidosSlot}
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
          onClose={() => setQuickCreate(null)}
          onSaved={(t) => {
            setSessionTransportistas((prev) => [...prev, t]);
            setSearchParams(urlDe('proveedor', t.id));
            setQuickCreate(null);
            void maestro.refreshTransportistas();
          }}
        />
      )}
    </div>
  );
}
