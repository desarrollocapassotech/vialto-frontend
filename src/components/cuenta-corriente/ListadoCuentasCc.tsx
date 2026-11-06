import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import { Wallet } from 'lucide-react';
import { ListadoDatos } from '@/components/listado/ListadoDatos';
import { ListadoFiltroCampo } from '@/components/listado/ListadoFiltroCampo';
import { LimpiarFiltrosPortal } from '@/components/listado/LimpiarFiltrosButton';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { TituloOrdenable, ViajesListadoHeaderFiltro } from '@/components/viajes/ViajesListadoHeaderFiltro';
import { friendlyError } from '@/lib/friendlyError';
import {
  fetchSaldosCuentas,
  fmtSaldoCc,
  type SaldoPorMoneda,
  type TipoContraparte,
} from '@/lib/cuentaCorriente';
import { hoyArgentinaIso } from '@/lib/facturaFechaEmision';
import { fechaDiaYmd, fmtDateUtc } from '@/lib/fmtDateUtc';
import { listadoTablaHeadRowClass, listadoTablaThClass } from '@/lib/listadoTabla';
import { compararValorOrden, useOrdenColumna, type OrdenDir } from '@/lib/ordenListado';

type Cuenta = { id: string; nombre: string };
type DatosCuenta = { saldos: SaldoPorMoneda[]; proximoVencimiento: string | null };
type Fila = Cuenta & DatosCuenta;

const TITULO_VENCIMIENTO = 'Próximo vencimiento sin imputar';

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
  const [datos, setDatos] = useState<Map<string, DatosCuenta> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cuentaFiltroId, setCuentaFiltroId] = useState('');
  const { orden, ordenColumna } = useOrdenColumna<string>(undefined, { nombre: 'texto', vencimiento: 'fecha' });

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelado = false;
    setDatos(null);
    fetchSaldosCuentas(() => getToken(), tipoContraparte)
      .then((r) => {
        if (cancelado) return;
        setDatos(new Map(r.map((x) => [x.contraparteId, x])));
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
    () =>
      cuentas.map((c) => {
        const d = datos?.get(c.id);
        return { ...c, saldos: d?.saldos ?? [], proximoVencimiento: d?.proximoVencimiento ?? null };
      }),
    [cuentas, datos],
  );

  // Una columna por moneda, nunca sumadas. Pesos primero; el resto, alfabético.
  const monedas = useMemo(() => {
    const presentes = [...new Set(filas.flatMap((f) => f.saldos.map((s) => s.moneda)))];
    return presentes.sort((a, b) => (a === 'ARS' ? -1 : b === 'ARS' ? 1 : a.localeCompare(b, 'es')));
  }, [filas]);
  const columnasSaldo = monedas.length > 0 ? monedas : ['ARS'];

  const visibles = useMemo(() => {
    const filtradas = cuentaFiltroId ? filas.filter((f) => f.id === cuentaFiltroId) : filas;
    const porNombre = (a: Fila, b: Fila) => compararValorOrden(a.nombre, b.nombre, 'asc');
    // Las monedas se comparan por separado, en orden: sin convertir entre ellas.
    const porSaldos = (a: Fila, b: Fila, lista: string[], dir: OrdenDir): number => {
      const [moneda, ...resto] = lista;
      if (!moneda) return porNombre(a, b);
      return compararValorOrden(saldoEn(a, moneda), saldoEn(b, moneda), dir, () => porSaldos(a, b, resto, dir));
    };
    return [...filtradas].sort((a, b) => {
      // Sin elegir columna: primero el vencimiento más viejo y al final las cuentas sin vencimiento;
      // a igual vencimiento (o sin ninguno), primero las que más deben.
      if (!orden) {
        return compararValorOrden(fechaDiaYmd(a.proximoVencimiento), fechaDiaYmd(b.proximoVencimiento), 'asc', () =>
          porSaldos(a, b, columnasSaldo, 'desc'),
        );
      }
      if (orden.by === 'nombre') return compararValorOrden(a.nombre, b.nombre, orden.dir);
      if (orden.by === 'vencimiento') {
        return compararValorOrden(fechaDiaYmd(a.proximoVencimiento), fechaDiaYmd(b.proximoVencimiento), orden.dir, () =>
          porNombre(a, b),
        );
      }
      return porSaldos(a, b, [orden.by, ...columnasSaldo.filter((m) => m !== orden.by)], orden.dir);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filas, cuentaFiltroId, orden, columnasSaldo.join('|')]);

  const opcionesCuenta = useMemo(() => cuentas.map((c) => ({ value: c.id, label: c.nombre })), [cuentas]);
  const filtroActivo = !!cuentaFiltroId;
  const selectFiltro = (
    <SearchableSelect
      value={cuentaFiltroId}
      onChange={setCuentaFiltroId}
      options={opcionesCuenta}
      placeholder="Todos"
      searchPlaceholder={`Buscar ${titulo.toLowerCase()}…`}
      triggerClassName={filtroActivo ? 'text-vialto-fire' : ''}
      ariaLabel={`Filtrar por ${titulo.toLowerCase()}`}
    />
  );

  return (
    <div>
      <LimpiarFiltrosPortal
        slot={limpiarFiltrosSlot}
        visible={filtroActivo}
        onClick={() => setCuentaFiltroId('')}
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
          {
            id: 'vencimiento',
            header: TITULO_VENCIMIENTO,
            cell: (f: Fila) => {
              const vto = fechaDiaYmd(f.proximoVencimiento);
              // Rojo si ya pasó, igual que el vencimiento de `ImputarPagoModal`.
              const vencido = !!vto && vto < hoyArgentinaIso();
              return (
                <span className={`tabular-nums ${!vto ? 'text-vialto-steel' : vencido ? 'font-medium text-red-700' : ''}`}>
                  {vto ? fmtDateUtc(vto) : '—'}
                </span>
              );
            },
          },
        ]}
        rows={error ? [] : datos == null || cargandoCuentas ? null : visibles}
        rowKey={(f) => f.id}
        emptyMessage={
          error
            ? 'No se pudieron cargar los saldos.'
            : filtroActivo
              ? `Ningún ${titulo.toLowerCase()} coincide con el filtro.`
              : `Todavía no hay ${esCliente ? 'clientes' : 'proveedores'}.`
        }
        activeFilterCount={filtroActivo ? 1 : 0}
        onClearFilters={() => setCuentaFiltroId('')}
        filters={
          <ListadoFiltroCampo label={titulo} active={filtroActivo}>
            {selectFiltro}
          </ListadoFiltroCampo>
        }
        tableHead={
          <tr className={listadoTablaHeadRowClass}>
            <th scope="col" className={listadoTablaThClass}>
              <ViajesListadoHeaderFiltro
                title={titulo}
                filterActive={filtroActivo}
                filterSignature={cuentaFiltroId}
                onClear={() => setCuentaFiltroId('')}
                orden={ordenColumna('nombre')}
              >
                {selectFiltro}
              </ViajesListadoHeaderFiltro>
            </th>
            {columnasSaldo.map((moneda) => (
              <th key={moneda} scope="col" className={listadoTablaThClass}>
                <TituloOrdenable title={`Saldo ${moneda}`} orden={{ ...ordenColumna(moneda), tipo: 'numero' }} />
              </th>
            ))}
            <th scope="col" className={listadoTablaThClass}>
              <TituloOrdenable title={TITULO_VENCIMIENTO} orden={ordenColumna('vencimiento')} />
            </th>
            <th scope="col" className={`${listadoTablaThClass} text-right`}>
              Acciones
            </th>
          </tr>
        }
        tableColSpan={columnasSaldo.length + 3}
        rowActions={(f: Fila) => [
          { id: 'ver', label: 'Ver cuenta', icon: Wallet, onClick: () => onAbrir(f.id) },
        ]}
        rowActionsSubtitle={(f: Fila) => f.nombre}
      />
    </div>
  );
}
