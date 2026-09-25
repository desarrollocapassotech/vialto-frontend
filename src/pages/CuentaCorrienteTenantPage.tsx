import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileDown } from 'lucide-react';
import { useMaestroData } from '@/hooks/useMaestroData';
import { ClienteSearchSelect, TransportistaSearchSelect } from '@/components/forms/MaestroSearchSelects';
import { ClienteModal } from '@/components/viajes/ClienteModal';
import { TransportistaModal } from '@/components/viajes/TransportistaModal';
import { CuentaContraparteView } from '@/components/cuenta-corriente/CuentaContraparteView';
import { pageTitleClass } from '@/lib/listadoTabla';
import { friendlyError } from '@/lib/friendlyError';
import { descargarListadoDeudoresPdf, type TipoContraparte } from '@/lib/cuentaCorriente';
import type { Cliente, Transportista } from '@/types/api';

type QuickCreate = 'cliente' | 'transportista' | null;

function toggleButtonClass(active: boolean): string {
  return `h-10 px-4 text-sm uppercase tracking-wider border ${
    active
      ? 'bg-vialto-charcoal text-white border-vialto-charcoal'
      : 'border-black/20 text-vialto-steel hover:bg-vialto-mist'
  }`;
}

export function CuentaCorrienteTenantPage() {
  const { getToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tipoContraparte, setTipoContraparte] = useState<TipoContraparte>('cliente');
  const [contraparteId, setContraparteId] = useState('');
  const [contraparteNombre, setContraparteNombre] = useState<string | null>(null);
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

  async function handleDescargarListado() {
    setDescargando(true);
    setErrorDescarga(null);
    try {
      await descargarListadoDeudoresPdf(() => getToken());
    } catch (e) {
      setErrorDescarga(friendlyError(e, 'cuentaCorriente'));
    } finally {
      setDescargando(false);
    }
  }

  // Deep link desde el tablero del dashboard: `/cuenta-corriente?tipo=cliente&id=...`
  useEffect(() => {
    const tipo = searchParams.get('tipo');
    const id = searchParams.get('id');
    if ((tipo === 'cliente' || tipo === 'proveedor') && id) {
      setTipoContraparte(tipo);
      setContraparteId(id);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('tipo');
          next.delete('id');
          return next;
        },
        { replace: true },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!contraparteId) {
      setContraparteNombre(null);
      return;
    }
    const lista = tipoContraparte === 'cliente' ? clientes : transportistas;
    setContraparteNombre(lista.find((x) => x.id === contraparteId)?.nombre ?? null);
  }, [contraparteId, tipoContraparte, clientes, transportistas]);

  function elegirTipo(tipo: TipoContraparte) {
    setTipoContraparte(tipo);
    setContraparteId('');
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className={pageTitleClass}>Cuenta corriente</h1>
        <button
          type="button"
          onClick={handleDescargarListado}
          disabled={descargando}
          className="inline-flex h-10 items-center gap-2 px-4 border border-black/20 text-vialto-steel text-sm uppercase tracking-wider hover:bg-vialto-mist disabled:opacity-50"
        >
          <FileDown className="h-4 w-4" />
          {descargando ? 'Generando…' : 'Descargar listado de deudores'}
        </button>
      </div>

      {errorDescarga && (
        <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
          {errorDescarga}
        </p>
      )}

      <div className="mt-6">
        <div className="mb-6 flex flex-wrap items-end gap-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => elegirTipo('cliente')}
              className={toggleButtonClass(tipoContraparte === 'cliente')}
            >
              Clientes
            </button>
            <button
              type="button"
              onClick={() => elegirTipo('proveedor')}
              className={toggleButtonClass(tipoContraparte === 'proveedor')}
            >
              Proveedores
            </button>
          </div>
          <div className="w-full sm:w-80">
            {tipoContraparte === 'cliente' ? (
              <ClienteSearchSelect
                clientes={clientes}
                value={contraparteId}
                onChange={setContraparteId}
                loading={maestroLoading}
                onNuevo={() => setQuickCreate('cliente')}
              />
            ) : (
              <TransportistaSearchSelect
                transportistas={transportistas}
                value={contraparteId}
                onChange={setContraparteId}
                onNuevo={() => setQuickCreate('transportista')}
              />
            )}
          </div>
        </div>

        {contraparteId && contraparteNombre ? (
          <CuentaContraparteView
            key={`${tipoContraparte}-${contraparteId}`}
            tipoContraparte={tipoContraparte}
            contraparteId={contraparteId}
            contraparteNombre={contraparteNombre}
          />
        ) : (
          <p className="text-vialto-steel">
            Elegí un {tipoContraparte === 'cliente' ? 'cliente' : 'proveedor'} para ver su cuenta.
          </p>
        )}
      </div>

      {quickCreate === 'cliente' && (
        <ClienteModal
          getToken={getToken}
          onClose={() => setQuickCreate(null)}
          onSaved={(c) => {
            setSessionClientes((prev) => [...prev, c]);
            setContraparteId(c.id);
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
            setContraparteId(t.id);
            setQuickCreate(null);
            void maestro.refreshTransportistas();
          }}
        />
      )}
    </div>
  );
}
