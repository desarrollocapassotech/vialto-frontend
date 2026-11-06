import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import { Eye } from 'lucide-react';
import { ListadoDatos } from '@/components/listado/ListadoDatos';
import { ListadoFiltroCampo } from '@/components/listado/ListadoFiltroCampo';
import { LimpiarFiltrosPortal } from '@/components/listado/LimpiarFiltrosButton';
import { TituloOrdenable, ViajesListadoHeaderFiltro } from '@/components/viajes/ViajesListadoHeaderFiltro';
import { friendlyError } from '@/lib/friendlyError';
import {
  fetchSaldosCuentas,
  fmtSaldoCc,
  type SaldoPorMoneda,
  type TipoContraparte,
} from '@/lib/cuentaCorriente';
import { listadoTablaHeadRowClass, listadoTablaThClass } from '@/lib/listadoTabla';
import { compararValorOrden, useOrdenColumna, type OrdenDir } from '@/lib/ordenListado';

type Cuenta = { id: string; nombre: string };
type Fila = Cuenta & { saldos: SaldoPorMoneda[] };

/** Sin acentos ni mayúsculas: "Martín" se encuentra escribiendo "martin". */
const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const saldoEn = (f: Fila, moneda: string) => f.saldos.find((s) => s.moneda === moneda)?.saldo ?? null;

type Props = {
  tipoContraparte: TipoContraparte;
  cuentas: Cuenta[];
  /** Maestros todavía cargando: el listado espera para no mostrarse vacío. */
  cargandoCuentas: boolean;
  onAbrir: (id: string) => void;
  /** Junto al título de la página: ahí va "Limpiar filtros" (regla global). */
  limpiarFiltrosSlot?: HTMLElement | null;
};

/** Cuentas de un lado con su saldo por moneda: click en la fila abre la cuenta. */
export function ListadoCuentasCc({ tipoContraparte, cuentas, cargandoCuentas, onAbrir, limpiarFiltrosSlot }: Props) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const esCliente = tipoContraparte === 'cliente';
  const titulo = esCliente ? 'Cliente' : 'Proveedor';
  const [saldos, setSaldos] = useState<Map<string, SaldoPorMoneda[]> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nombreFiltro, setNombreFiltro] = useState('');
  const { orden, ordenColumna } = useOrdenColumna<string>(undefined, { nombre: 'texto' });

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelado = false;
    setSaldos(null);
    fetchSaldosCuentas(() => getToken(), tipoContraparte)
      .then((r) => {
        if (cancelado) return;
        setSaldos(new Map(r.map((x) => [x.contraparteId, x.saldos])));
        setError(null);
      })
      .catch((e) => {
        if (!cancelado) setError(friendlyError(e, 'cuentaCorriente'));
      });
    return () => {
      cancelado = true;
    };
  }, [getToken, isLoaded, isSignedIn, tipoContraparte]);

  const filas = useMemo<Fila[]>(
    () => cuentas.map((c) => ({ ...c, saldos: saldos?.get(c.id) ?? [] })),
    [cuentas, saldos],
  );

  // Una columna por moneda, nunca sumadas. Pesos primero; el resto, alfabético.
  const monedas = useMemo(() => {
    const presentes = [...new Set(filas.flatMap((f) => f.saldos.map((s) => s.moneda)))];
    return presentes.sort((a, b) => (a === 'ARS' ? -1 : b === 'ARS' ? 1 : a.localeCompare(b, 'es')));
  }, [filas]);
  const columnasSaldo = monedas.length > 0 ? monedas : ['ARS'];

  const visibles = useMemo(() => {
    const q = normalizar(nombreFiltro.trim());
    const filtradas = q ? filas.filter((f) => normalizar(f.nombre).includes(q)) : filas;
    const porNombre = (a: Fila, b: Fila) => compararValorOrden(a.nombre, b.nombre, 'asc');
    // Las monedas se comparan por separado, en orden: sin convertir entre ellas.
    const porSaldos = (a: Fila, b: Fila, lista: string[], dir: OrdenDir): number => {
      const [moneda, ...resto] = lista;
      if (!moneda) return porNombre(a, b);
      return compararValorOrden(saldoEn(a, moneda), saldoEn(b, moneda), dir, () => porSaldos(a, b, resto, dir));
    };
    return [...filtradas].sort((a, b) => {
      // Sin elegir columna: primero los que más deben, y al final las cuentas sin saldo.
      if (!orden) return porSaldos(a, b, columnasSaldo, 'desc');
      if (orden.by === 'nombre') return compararValorOrden(a.nombre, b.nombre, orden.dir);
      return porSaldos(a, b, [orden.by, ...columnasSaldo.filter((m) => m !== orden.by)], orden.dir);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, nombreFiltro, orden, columnasSaldo.join('|')]);

  const filtroActivo = !!nombreFiltro.trim();
  const inputFiltro = (
    <input
      type="text"
      value={nombreFiltro}
      onChange={(e) => setNombreFiltro(e.target.value)}
      placeholder="Buscar…"
      className={`h-9 w-full border border-black/15 bg-white px-2 text-sm ${filtroActivo ? 'text-vialto-fire' : 'text-vialto-charcoal'}`}
      aria-label={`Filtrar por ${titulo.toLowerCase()}`}
    />
  );

  return (
    <div>
      <LimpiarFiltrosPortal
        slot={limpiarFiltrosSlot}
        visible={filtroActivo}
        onClick={() => setNombreFiltro('')}
        soloDesktop
      />
      {error && (
        <p className="mb-4 text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
      )}
      <ListadoDatos
        columns={[
          {
            id: 'nombre',
            header: titulo,
            primary: true,
            cell: (f: Fila) => <span className="font-medium">{f.nombre}</span>,
          },
          ...columnasSaldo.map((moneda) => ({
            id: `saldo-${moneda}`,
            header: `Saldo ${moneda}`,
            cell: (f: Fila) => {
              const saldo = saldoEn(f, moneda);
              return (
                <span className={`tabular-nums ${saldo == null ? 'text-vialto-steel' : saldo < 0 ? 'text-emerald-700' : ''}`}>
                  {saldo == null ? '—' : fmtSaldoCc(saldo)}
                </span>
              );
            },
          })),
        ]}
        rows={error ? [] : saldos == null || cargandoCuentas ? null : visibles}
        rowKey={(f) => f.id}
        emptyMessage={
          error
            ? 'No se pudieron cargar los saldos.'
            : filtroActivo
              ? `Ningún ${titulo.toLowerCase()} coincide con el filtro.`
              : `Todavía no hay ${esCliente ? 'clientes' : 'proveedores'}.`
        }
        activeFilterCount={filtroActivo ? 1 : 0}
        onClearFilters={() => setNombreFiltro('')}
        filters={
          <ListadoFiltroCampo label={titulo} active={filtroActivo}>
            {inputFiltro}
          </ListadoFiltroCampo>
        }
        tableHead={
          <tr className={listadoTablaHeadRowClass}>
            <th scope="col" className={listadoTablaThClass}>
              <ViajesListadoHeaderFiltro
                title={titulo}
                filterActive={filtroActivo}
                filterSignature={nombreFiltro}
                onClear={() => setNombreFiltro('')}
                orden={ordenColumna('nombre')}
              >
                {inputFiltro}
              </ViajesListadoHeaderFiltro>
            </th>
            {columnasSaldo.map((moneda) => (
              <th key={moneda} scope="col" className={listadoTablaThClass}>
                <TituloOrdenable title={`Saldo ${moneda}`} orden={{ ...ordenColumna(moneda), tipo: 'numero' }} />
              </th>
            ))}
            <th scope="col" className={`${listadoTablaThClass} text-right`}>
              Acciones
            </th>
          </tr>
        }
        tableColSpan={columnasSaldo.length + 2}
        rowActions={(f: Fila) => [
          { id: 'ver', label: 'Ver cuenta', icon: Eye, onClick: () => onAbrir(f.id) },
        ]}
        rowActionsSubtitle={(f: Fila) => f.nombre}
      />
    </div>
  );
}
