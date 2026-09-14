import { useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { formatCurrencyArFromNumber } from '@/lib/currencyMask';
import { friendlyError } from '@/lib/friendlyError';
import { fetchTablero, type TableroCcResponse, type TableroItem, type TipoContraparte } from '@/lib/cuentaCorriente';

type Props = {
  onSeleccionarContraparte: (tipo: TipoContraparte, id: string, nombre: string | null) => void;
  /** Rango del selector de período del dashboard — filtra los cargos por fecha de generación. */
  desde?: string;
  hasta?: string;
};

function fmtMoneyLine(totales: { moneda: string; total: number }[]): string {
  if (totales.length === 0) return '—';
  return totales.map((t) => `${t.moneda} ${formatCurrencyArFromNumber(t.total)}`).join(' · ');
}

/** Mismo estilo de tarjeta oscura que ya usan Financiero/Combustible/Stock en el dashboard. */
function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex min-h-[110px] flex-col justify-between bg-vialto-graphite p-5">
      <span className="font-[family-name:var(--font-ui)] text-xs uppercase tracking-[0.15em] text-white/80 lg:text-sm">
        {label}
      </span>
      <div>
        <span className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-white lg:text-3xl">
          {value}
        </span>
        {sub && <p className="mt-1 text-[11px] text-white/40">{sub}</p>}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-vialto-steel">{text}</p>;
}

/** Mismo estilo de tabla clara que ya usa Financiero (`MargenAlertasList`) para listados dentro del dashboard. */
function ItemsTabla({
  titulo,
  items,
  onClick,
}: {
  titulo: string;
  items: TableroItem[];
  onClick: Props['onSeleccionarContraparte'];
}) {
  if (items.length === 0) return null;
  return (
    <div className="overflow-x-auto bg-white border border-black/10 p-4">
      <p className="mb-2 font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-vialto-steel">
        {titulo} ({items.length})
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/10">
            <th className="pb-2 text-left font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
              Contraparte
            </th>
            <th className="pb-2 text-left font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
              Vencimiento
            </th>
            <th className="pb-2 text-right font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
              Pendiente
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr
              key={it.id}
              className="cursor-pointer border-b border-black/5 last:border-0 hover:bg-vialto-mist"
              onClick={() => onClick(it.tipoContraparte, it.contraparteId, it.contraparteNombre)}
            >
              <td className="py-2 font-medium text-vialto-charcoal">{it.contraparteNombre ?? '—'}</td>
              <td className="py-2 text-vialto-charcoal">
                {it.fechaVencimiento
                  ? new Date(it.fechaVencimiento).toLocaleDateString('es-AR')
                  : '—'}
              </td>
              <td className="py-2 text-right tabular-nums text-vialto-charcoal">
                {formatCurrencyArFromNumber(it.pendiente)} {it.moneda}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SeccionGrupo({
  titulo,
  grupo,
  onClick,
}: {
  titulo: string;
  grupo: { cobrar: TableroItem[]; pagar: TableroItem[] };
  onClick: Props['onSeleccionarContraparte'];
}) {
  if (grupo.cobrar.length === 0 && grupo.pagar.length === 0) return null;
  return (
    <div>
      <p className="mb-2 font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-vialto-steel">
        {titulo}
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <ItemsTabla titulo="A cobrar" items={grupo.cobrar} onClick={onClick} />
        <ItemsTabla titulo="A pagar" items={grupo.pagar} onClick={onClick} />
      </div>
    </div>
  );
}

export function TableroCuentaCorriente({ onSeleccionarContraparte, desde, hasta }: Props) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [data, setData] = useState<TableroCcResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetchTablero(() => getToken(), { desde, hasta });
        if (!cancelled) {
          setData(res);
          setError(null);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(friendlyError(e, 'cuentaCorriente'));
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, isSignedIn, desde, hasta]);

  if (error) {
    return (
      <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2">
        {error}
      </p>
    );
  }

  const listo = !loading && data !== null;

  const vacio =
    listo &&
    data!.vencidos.cobrar.length === 0 &&
    data!.vencidos.pagar.length === 0 &&
    data!.proximosVencimientos.cobrar.length === 0 &&
    data!.proximosVencimientos.pagar.length === 0 &&
    data!.sinVencimiento.cobrar.length === 0 &&
    data!.sinVencimiento.pagar.length === 0;

  return (
    <div className="flex flex-col gap-4">
      {loading && (
        <p className="flex items-center gap-1.5 text-xs text-vialto-steel">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-vialto-steel border-t-transparent" />
          Actualizando…
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <StatTile
          label="Por cobrar (pendiente)"
          value={listo ? fmtMoneyLine(data!.totales.porCobrarPendiente) : '—'}
        />
        <StatTile
          label="Por pagar (pendiente)"
          value={listo ? fmtMoneyLine(data!.totales.porPagarPendiente) : '—'}
        />
      </div>

      {listo && vacio ? (
        <EmptyState text="No hay cargos pendientes de cobro ni de pago." />
      ) : listo ? (
        <>
          <SeccionGrupo titulo="Vencidos" grupo={data!.vencidos} onClick={onSeleccionarContraparte} />
          <SeccionGrupo
            titulo="Próximos a vencer"
            grupo={data!.proximosVencimientos}
            onClick={onSeleccionarContraparte}
          />
          <SeccionGrupo
            titulo="Sin vencimiento configurado"
            grupo={data!.sinVencimiento}
            onClick={onSeleccionarContraparte}
          />
        </>
      ) : null}
    </div>
  );
}
