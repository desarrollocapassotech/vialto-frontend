import { Link } from "react-router-dom";
import { estadoViajeLabel } from "@/lib/viajesEstados";
import type {
  FinancieroDashboardResponse,
  FinancieroMargenAlerta,
  FinancieroMargenPorEntidad,
  FinancieroMargenPorRuta,
  FinancieroMoney,
} from "@/types/financieroDashboard";

function fmtMoney(n: number): string {
  return `$ ${Math.round(n).toLocaleString("es-AR")}`;
}

function fmtMoneyUSD(n: number): string {
  return `USD ${Math.round(n).toLocaleString("es-AR")}`;
}

function fmtMoneyDualCompact(money: FinancieroMoney): string {
  const parts: string[] = [];
  if (money.ARS !== 0) parts.push(fmtMoney(money.ARS));
  if (money.USD !== 0) parts.push(fmtMoneyUSD(money.USD));
  return parts.length > 0 ? parts.join(" · ") : "—";
}

function MoneyDual({ money }: { money: FinancieroMoney }) {
  if (money.ARS === 0 && money.USD === 0) return <span>—</span>;
  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      {money.ARS !== 0 && <span>{fmtMoney(money.ARS)}</span>}
      {money.USD !== 0 && <span className="text-xs opacity-75">{fmtMoneyUSD(money.USD)}</span>}
    </span>
  );
}

function StatTile({
  label,
  value,
  sub,
  linkTo,
}: {
  label: string;
  value: string;
  sub?: string;
  linkTo?: string;
}) {
  const inner = (
    <>
      <span className="font-[family-name:var(--font-ui)] text-xs uppercase tracking-[0.15em] text-white/80 lg:text-sm">
        {label}
      </span>
      <div>
        <span className="font-[family-name:var(--font-display)] text-2xl tracking-wide text-white lg:text-3xl">
          {value}
        </span>
        {sub && <p className="mt-1 text-[11px] text-white/40">{sub}</p>}
        {linkTo && (
          <span className="mt-1 flex justify-end font-[family-name:var(--font-ui)] text-[10px] uppercase tracking-[0.15em] text-white/40 transition-colors group-hover:text-white/80">
            Ver →
          </span>
        )}
      </div>
    </>
  );
  if (linkTo) {
    return (
      <Link
        to={linkTo}
        className="group flex min-h-[110px] flex-col justify-between bg-vialto-graphite p-5 transition-colors hover:bg-vialto-charcoal"
      >
        {inner}
      </Link>
    );
  }
  return <div className="flex min-h-[110px] flex-col justify-between bg-vialto-graphite p-5">{inner}</div>;
}

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-vialto-steel">{text}</p>;
}

// ── Margen ───────────────────────────────────────────────────────────────

export function MargenResumenPanel({
  data,
  loading,
}: {
  data: FinancieroDashboardResponse | null;
  loading: boolean;
}) {
  const listo = !loading && data?.margen !== undefined;
  const r = data?.margen?.resumen;
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="flex min-h-[110px] flex-col justify-between bg-vialto-graphite p-5">
        <span className="font-[family-name:var(--font-ui)] text-xs uppercase tracking-[0.15em] text-white/80 lg:text-sm">
          Facturado
        </span>
        <div className="text-right text-white">{listo && r ? <MoneyDual money={r.facturado} /> : "—"}</div>
      </div>
      <div className="flex min-h-[110px] flex-col justify-between bg-vialto-graphite p-5">
        <span className="font-[family-name:var(--font-ui)] text-xs uppercase tracking-[0.15em] text-white/80 lg:text-sm">
          Margen
        </span>
        <div className="text-right text-emerald-400">{listo && r ? <MoneyDual money={r.margen} /> : "—"}</div>
      </div>
    </div>
  );
}

function MargenEntidadTable({
  items,
  columnaNombre,
}: {
  items: FinancieroMargenPorEntidad[];
  columnaNombre: string;
}) {
  if (items.length === 0) return <EmptyState text="Sin viajes con margen calculado en el período." />;
  return (
    <div className="overflow-x-auto bg-white border border-black/10 p-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/10">
            <th className="pb-2 text-left font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
              {columnaNombre}
            </th>
            <th className="pb-2 text-right font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
              Viajes
            </th>
            <th className="pb-2 text-right font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
              Facturado
            </th>
            <th className="pb-2 text-right font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
              Margen
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-b border-black/5 last:border-0">
              <td className="py-2 font-medium text-vialto-charcoal">{it.nombre}</td>
              <td className="py-2 text-right text-vialto-charcoal">{it.cantViajes}</td>
              <td className="py-2 text-right text-vialto-charcoal">
                <MoneyDual money={it.facturado} />
              </td>
              <td className="py-2 text-right text-vialto-charcoal">
                <MoneyDual money={it.margen} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MargenPorClienteTable({ items }: { items: FinancieroMargenPorEntidad[] }) {
  return <MargenEntidadTable items={items} columnaNombre="Cliente" />;
}

export function MargenPorTransportistaTable({ items }: { items: FinancieroMargenPorEntidad[] }) {
  return <MargenEntidadTable items={items} columnaNombre="Transportista" />;
}

export function MargenPorRutaTable({
  items,
  columnaClave,
}: {
  items: FinancieroMargenPorRuta[];
  columnaClave: string;
}) {
  if (items.length === 0) return <EmptyState text="Sin datos en el período seleccionado." />;
  return (
    <div className="overflow-x-auto bg-white border border-black/10 p-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/10">
            <th className="pb-2 text-left font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
              {columnaClave}
            </th>
            <th className="pb-2 text-right font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
              Viajes
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.clave} className="border-b border-black/5 last:border-0">
              <td className="py-2 text-vialto-charcoal">{it.clave}</td>
              <td className="py-2 text-right text-vialto-charcoal">{it.cantViajes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MargenAlertasList({
  alertas,
  onViewViaje,
  loadingViajeId,
}: {
  alertas: FinancieroMargenAlerta[];
  onViewViaje?: (id: string) => void;
  loadingViajeId?: string | null;
}) {
  if (alertas.length === 0) {
    return <EmptyState text="Sin viajes con margen bajo o negativo en el período." />;
  }
  return (
    <div className="overflow-x-auto bg-white border border-black/10 p-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/10">
            <th className="pb-2 text-left font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
              Viaje
            </th>
            <th className="pb-2 text-left font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
              Cliente
            </th>
            <th className="pb-2 text-left font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
              Transportista
            </th>
            <th className="pb-2 text-right font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
              Facturado
            </th>
            <th className="pb-2 text-right font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
              Margen
            </th>
            <th className="pb-2 text-right font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {alertas.map((a) => (
            <tr key={a.viajeId} className="border-b border-black/5 last:border-0">
              <td className="py-2 font-medium text-vialto-charcoal">{a.numero || a.viajeId.slice(0, 8)}</td>
              <td className="py-2 text-vialto-charcoal">{a.clienteNombre}</td>
              <td className="py-2 text-vialto-charcoal">{a.transportistaNombre ?? "—"}</td>
              <td className="py-2 text-right text-vialto-charcoal">
                {a.moneda === "USD" ? fmtMoneyUSD(a.facturado) : fmtMoney(a.facturado)}
              </td>
              <td className={`py-2 text-right ${a.margen < 0 ? "text-rose-600" : "text-amber-700"}`}>
                {a.moneda === "USD" ? fmtMoneyUSD(a.margen) : fmtMoney(a.margen)}
              </td>
              <td className="py-2 text-right">
                {onViewViaje ? (
                  <button
                    type="button"
                    disabled={loadingViajeId === a.viajeId}
                    onClick={() => onViewViaje(a.viajeId)}
                    className="inline-flex items-center whitespace-nowrap text-xs uppercase tracking-wider text-vialto-steel hover:text-vialto-fire disabled:cursor-wait disabled:opacity-60"
                  >
                    {loadingViajeId === a.viajeId ? "Cargando…" : "Ver viaje →"}
                  </button>
                ) : (
                  <Link
                    to={`/viajes?viaje=${encodeURIComponent(a.viajeId)}`}
                    className="inline-flex items-center whitespace-nowrap text-xs uppercase tracking-wider text-vialto-steel hover:text-vialto-fire"
                  >
                    Ver viaje →
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Viajes (funnel) ──────────────────────────────────────────────────────

export function ViajesFunnelPanel({
  data,
  loading,
  onViewViaje,
  loadingViajeId,
}: {
  data: FinancieroDashboardResponse | null;
  loading: boolean;
  onViewViaje?: (id: string) => void;
  loadingViajeId?: string | null;
}) {
  const funnel = data?.viajesFunnel;
  if (loading || !funnel) return <EmptyState text="Cargando…" />;

  function renderVerViajeAction(id: string) {
    const cargando = loadingViajeId === id;
    if (onViewViaje) {
      return (
        <button
          type="button"
          disabled={cargando}
          onClick={() => onViewViaje(id)}
          className="inline-flex items-center whitespace-nowrap text-xs uppercase tracking-wider text-vialto-steel hover:text-vialto-fire disabled:cursor-wait disabled:opacity-60"
        >
          {cargando ? "Cargando…" : "Ver viaje →"}
        </button>
      );
    }
    return (
      <Link
        to={`/viajes?viaje=${encodeURIComponent(id)}`}
        className="inline-flex items-center whitespace-nowrap text-xs uppercase tracking-wider text-vialto-steel hover:text-vialto-fire"
      >
        Ver viaje →
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {funnel.porEstado.map((e) => (
          <StatTile
            key={e.estado}
            label={estadoViajeLabel[e.estado] ?? e.estado}
            value={String(e.cantidad)}
            linkTo={`/viajes?estado=${encodeURIComponent(e.estado)}`}
          />
        ))}
        <StatTile
          label="Liquidados"
          value={String(funnel.liquidados.cantidad)}
          sub={fmtMoneyDualCompact(funnel.liquidados.montoTotal)}
          linkTo="/viajes?pagoTransportista=pagado"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-white border border-black/10 p-4">
          <p className="mb-2 font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-vialto-steel">
            Finalizados sin liquidar al transportista
          </p>
          <p className="mb-3 text-2xl font-[family-name:var(--font-display)] text-vialto-charcoal">
            {funnel.sinLiquidar.cantidad}
          </p>
          {funnel.sinLiquidar.items.length === 0 ? (
            <EmptyState text="Sin viajes pendientes de liquidar." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/10">
                    <th className="pb-2 text-left font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
                      Viaje
                    </th>
                    <th className="pb-2 text-left font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
                      Transportista
                    </th>
                    <th className="pb-2 text-right font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {funnel.sinLiquidar.items.map((it) => (
                    <tr key={it.id} className="border-b border-black/5 last:border-0">
                      <td className="py-2 font-medium text-vialto-charcoal">
                        {it.numero || it.id.slice(0, 8)}
                      </td>
                      <td className="py-2 text-vialto-charcoal">{it.transportistaNombre ?? "—"}</td>
                      <td className="py-2 text-right">{renderVerViajeAction(it.id)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white border border-black/10 p-4">
          <p className="mb-2 font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-vialto-steel">
            Finalizados sin facturar al cliente
          </p>
          <p className="mb-3 text-2xl font-[family-name:var(--font-display)] text-vialto-charcoal">
            {funnel.sinFacturar.cantidad}
          </p>
          {funnel.sinFacturar.items.length === 0 ? (
            <EmptyState text="Sin viajes pendientes de facturar." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/10">
                    <th className="pb-2 text-left font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
                      Viaje
                    </th>
                    <th className="pb-2 text-left font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
                      Cliente
                    </th>
                    <th className="pb-2 text-right font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {funnel.sinFacturar.items.map((it) => (
                    <tr key={it.id} className="border-b border-black/5 last:border-0">
                      <td className="py-2 font-medium text-vialto-charcoal">
                        {it.numero || it.id.slice(0, 8)}
                      </td>
                      <td className="py-2 text-vialto-charcoal">{it.clienteNombre}</td>
                      <td className="py-2 text-right">{renderVerViajeAction(it.id)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Liquidaciones ────────────────────────────────────────────────────────

export function LiquidacionesPanel({
  data,
  loading,
}: {
  data: FinancieroDashboardResponse | null;
  loading: boolean;
}) {
  const liq = data?.liquidaciones;
  if (loading || !liq) return <EmptyState text="Cargando…" />;

  const acordadoTotal: FinancieroMoney = { ARS: 0, USD: 0 };
  const pagadoTotal: FinancieroMoney = { ARS: 0, USD: 0 };
  const pendienteTotal: FinancieroMoney = { ARS: 0, USD: 0 };
  let cantViajesTotal = 0;
  for (const t of liq.aPagarPorTransportista) {
    acordadoTotal.ARS += t.acordado.ARS;
    acordadoTotal.USD += t.acordado.USD;
    pagadoTotal.ARS += t.pagado.ARS;
    pagadoTotal.USD += t.pagado.USD;
    pendienteTotal.ARS += t.pendiente.ARS;
    pendienteTotal.USD += t.pendiente.USD;
    cantViajesTotal += t.cantViajes;
  }

  const liquidoTotal = liq.rankingPorLiquidado.reduce((s, t) => s + t.liquido, 0);
  const cantLiquidacionesTotal = liq.rankingPorLiquidado.reduce((s, t) => s + t.cantLiquidaciones, 0);
  const brutoTotal = liq.cvlpPorPeriodo.reduce((s, p) => s + p.bruto, 0);
  const comisionTotal = liq.cvlpPorPeriodo.reduce((s, p) => s + p.comision, 0);
  const gastosAdminTotal = liq.cvlpPorPeriodo.reduce((s, p) => s + p.gastosAdmin, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatTile label="Transportistas" value={String(liq.aPagarPorTransportista.length)} />
        <StatTile label="Viajes" value={String(cantViajesTotal)} />
        <StatTile label="Liquidaciones CVLP" value={String(cantLiquidacionesTotal)} />
        <StatTile label="Períodos" value={String(liq.cvlpPorPeriodo.length)} />
      </div>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
        <div className="flex min-h-[90px] flex-col justify-between bg-vialto-graphite p-5">
          <span className="font-[family-name:var(--font-ui)] text-xs uppercase tracking-[0.15em] text-white/80 lg:text-sm">
            Acordado
          </span>
          <div className="text-right text-white">
            <MoneyDual money={acordadoTotal} />
          </div>
        </div>
        <div className="flex min-h-[90px] flex-col justify-between bg-vialto-graphite p-5">
          <span className="font-[family-name:var(--font-ui)] text-xs uppercase tracking-[0.15em] text-white/80 lg:text-sm">
            Pagado
          </span>
          <div className="text-right text-emerald-400">
            <MoneyDual money={pagadoTotal} />
          </div>
        </div>
        <div className="flex min-h-[90px] flex-col justify-between bg-vialto-graphite p-5">
          <span className="font-[family-name:var(--font-ui)] text-xs uppercase tracking-[0.15em] text-white/80 lg:text-sm">
            Pendiente
          </span>
          <div className="text-right text-rose-400">
            <MoneyDual money={pendienteTotal} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatTile label="Bruto (CVLP)" value={fmtMoney(brutoTotal)} />
        <StatTile label="Comisión" value={fmtMoney(comisionTotal)} />
        <StatTile label="Gastos admin." value={fmtMoney(gastosAdminTotal)} />
        <StatTile label="Líquido total" value={fmtMoney(liquidoTotal)} />
      </div>
    </div>
  );
}

// ── Facturación ──────────────────────────────────────────────────────────

export function FacturacionPanel({
  data,
  loading,
}: {
  data: FinancieroDashboardResponse | null;
  loading: boolean;
}) {
  const fac = data?.facturacion;
  if (loading || !fac) return <EmptyState text="Cargando…" />;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <StatTile label="Factura A" value={String(fac.porTipoComprobante.A.cantidad)} sub={fmtMoney(fac.porTipoComprobante.A.monto)} />
        <StatTile label="Factura B" value={String(fac.porTipoComprobante.B.cantidad)} sub={fmtMoney(fac.porTipoComprobante.B.monto)} />
        <StatTile
          label="Sin ARCA"
          value={String(fac.porTipoComprobante.sinArca.cantidad)}
          sub={fmtMoney(fac.porTipoComprobante.sinArca.monto)}
        />
        <StatTile
          label="Pendientes de emitir"
          value={String(fac.pendientesEmitir.cantidad)}
          linkTo="/viajes?estado=finalizado_sin_facturar"
        />
      </div>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
        <div className="flex min-h-[90px] flex-col justify-between bg-vialto-graphite p-5">
          <span className="font-[family-name:var(--font-ui)] text-xs uppercase tracking-[0.15em] text-white/80 lg:text-sm">
            Facturado
          </span>
          <div className="text-right text-white">
            <MoneyDual money={fac.facturadoVsCobrado.facturado} />
          </div>
        </div>
        <div className="flex min-h-[90px] flex-col justify-between bg-vialto-graphite p-5">
          <span className="font-[family-name:var(--font-ui)] text-xs uppercase tracking-[0.15em] text-white/80 lg:text-sm">
            Cobrado
          </span>
          <div className="text-right text-emerald-400">
            <MoneyDual money={fac.facturadoVsCobrado.cobrado} />
          </div>
        </div>
        <div className="flex min-h-[90px] flex-col justify-between bg-vialto-graphite p-5">
          <span className="font-[family-name:var(--font-ui)] text-xs uppercase tracking-[0.15em] text-white/80 lg:text-sm">
            Pendiente de cobro (total)
          </span>
          <div className="text-right text-amber-400">
            <MoneyDual money={fac.facturadoVsCobrado.pendienteCobro} />
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 font-[family-name:var(--font-ui)] text-[11px] uppercase tracking-[0.2em] text-vialto-steel">
          Ranking de clientes por facturación
        </p>
        {fac.rankingClientes.length === 0 ? (
          <EmptyState text="Sin facturas emitidas en el período." />
        ) : (
          <div className="overflow-x-auto bg-white border border-black/10 p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/10">
                  <th className="pb-2 text-left font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
                    Cliente
                  </th>
                  <th className="pb-2 text-right font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
                    Facturado
                  </th>
                  <th className="pb-2 text-right font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
                    Cobrado
                  </th>
                  <th className="pb-2 text-right font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
                    Facturas
                  </th>
                </tr>
              </thead>
              <tbody>
                {fac.rankingClientes.map((c) => (
                  <tr key={c.clienteId} className="border-b border-black/5 last:border-0">
                    <td className="py-2 font-medium text-vialto-charcoal">{c.nombre}</td>
                    <td className="py-2 text-right text-vialto-charcoal">
                      <MoneyDual money={c.facturado} />
                    </td>
                    <td className="py-2 text-right text-emerald-700">
                      <MoneyDual money={c.cobrado} />
                    </td>
                    <td className="py-2 text-right text-vialto-charcoal">{c.cantFacturas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

