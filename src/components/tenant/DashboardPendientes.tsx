import { CargandoVialto } from "@/components/shared/CargandoVialto";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { formatMoney, formatMoneyUSD } from "@/lib/dashboardFormato";
import { CeldaAccionesFila } from "@/components/ui/AccionesFila";
import type { AccionOpcion } from "@/components/ui/AccionesOpcionesSheet";
import { clickFilaAcciones } from "@/lib/accionesFila";
import { useTablaDashboard, type ColumnaOrdenable } from "@/hooks/useTablaDashboard";
import { PaginacionCompacta } from "@/components/listado/PaginacionCompacta";
import { TituloOrdenable } from "@/components/viajes/ViajesListadoHeaderFiltro";
import type { TipoOrden, ValorOrden } from "@/lib/ordenListado";

export type PendienteFila = {
  id: string;
  celdas: ReactNode[];
  /**
   * Valor por el que ordena cada columna, en el mismo orden que `columnas` (lo que se ve,
   * sin formato: la fecha ISO, el monto como número). Sin esto la columna no ordena.
   */
  orden?: ValorOrden[];
  acciones: AccionOpcion[];
};

/** Título de la columna; `tipo` define el tooltip del orden (A a Z / menor a mayor / fecha). */
export type PendienteColumna = string | { titulo: string; tipo?: TipoOrden };

/**
 * Bloque de "Pendientes" del dashboard: título, cantidad, "Ver todo →" y una tabla
 * corta con el formato de acciones de las grillas (ícono + click en la fila).
 */
export function DashboardPendientes({
  titulo,
  icono,
  tono,
  cantidad,
  montos,
  etiquetaMontos,
  verTodoTo,
  columnas,
  filas,
  vacio,
  loading,
}: {
  titulo: string;
  icono?: LucideIcon;
  tono?: PendientesTono;
  /** Total real (puede ser mayor que las filas mostradas). */
  cantidad: number;
  /** Plata en juego por moneda (se muestra grande en una franja debajo del título). */
  montos?: { ARS: number; USD: number } | null;
  etiquetaMontos?: string;
  verTodoTo?: string;
  columnas: PendienteColumna[];
  filas: PendienteFila[];
  vacio: string;
  loading?: boolean;
}) {
  // Orden con click en el título (columnas con valor de orden) + de a 5 por página.
  const cols = columnas.map((c) => (typeof c === "string" ? { titulo: c } : c));
  const ordenables = Object.fromEntries(
    cols.map((c, i) => [String(i), { tipo: c.tipo, valor: (f: PendienteFila) => f.orden?.[i] }]),
  ) as Record<string, ColumnaOrdenable<PendienteFila>>;
  const tabla = useTablaDashboard(filas, ordenables);
  const paginacion = tabla.paginacion;
  const visibles = tabla.visibles;
  const columnaOrdena = (i: number) => filas.some((f) => f.orden?.[i] != null);
  return (
    <DashboardPendientesMarco
      titulo={titulo}
      icono={icono}
      tono={tono}
      cantidad={loading ? null : cantidad}
      montos={loading ? null : montos}
      etiquetaMontos={etiquetaMontos}
      verTodoTo={cantidad > 0 ? verTodoTo : undefined}
    >
      {loading ? (
        <CargandoVialto mensaje={`Cargando ${titulo.toLowerCase()}…`} chico />
      ) : visibles.length === 0 ? (
        <p className="px-4 py-6 text-sm text-vialto-steel">{vacio}</p>
      ) : (
        <div className="overflow-x-auto px-4 pb-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10">
                {cols.map((c, i) => (
                  <th
                    key={c.titulo}
                    className="py-2 text-left font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel"
                  >
                    {columnaOrdena(i) ? (
                      <TituloOrdenable title={c.titulo} orden={tabla.ordenColumna(String(i))} />
                    ) : (
                      c.titulo
                    )}
                  </th>
                ))}
                <th className="py-2 text-right font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((f) => (
                <tr
                  key={f.id}
                  className="cursor-pointer border-b border-black/5 last:border-0 hover:bg-vialto-mist/40"
                  onClick={() => clickFilaAcciones(f.acciones, () => {})}
                >
                  {f.celdas.map((c, i) => (
                    <td key={i} className="h-8 py-1 pr-3 text-vialto-charcoal">
                      {c}
                    </td>
                  ))}
                  <CeldaAccionesFila options={f.acciones} />
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pb-1">
            <PaginacionCompacta paginacion={paginacion} />
          </div>
        </div>
      )}
    </DashboardPendientesMarco>
  );
}

export type PendientesTono = "alerta" | "aviso";

const TONO: Record<PendientesTono, { icono: string; badge: string; franja: string }> = {
  alerta: {
    icono: "bg-rose-50 text-rose-600",
    badge: "bg-rose-600 text-white",
    franja: "border-rose-100 bg-rose-50/60",
  },
  aviso: {
    icono: "bg-amber-50 text-amber-600",
    badge: "bg-amber-500 text-white",
    franja: "border-amber-100 bg-amber-50/60",
  },
};

/**
 * Marco común (también para bloques con contenido propio, ej. Mantenimiento): ícono del
 * tema, título, cantidad en un badge y, si hay plata en juego, el monto grande en una franja.
 */
export function DashboardPendientesMarco({
  titulo,
  icono: Icono,
  tono = "aviso",
  cantidad,
  montos,
  etiquetaMontos = "Total pendiente",
  verTodoTo,
  children,
}: {
  titulo: string;
  icono?: LucideIcon;
  /** alerta = rojo (vencido, pérdida); aviso = ámbar (algo por hacer). */
  tono?: PendientesTono;
  /** null = cargando (no se muestra el badge). */
  cantidad?: number | null;
  /** Monto en juego por moneda; sin montos (o en 0) no se muestra la franja. */
  montos?: { ARS: number; USD: number } | null;
  etiquetaMontos?: string;
  verTodoTo?: string;
  children: ReactNode;
}) {
  const estilo = TONO[tono];
  const hayMontos = !!montos && (montos.ARS !== 0 || montos.USD !== 0);
  const principal = !montos ? "" : montos.ARS !== 0 ? formatMoney(montos.ARS) : formatMoneyUSD(montos.USD);
  const secundario = montos && montos.ARS !== 0 && montos.USD !== 0 ? formatMoneyUSD(montos.USD) : null;
  return (
    <div className="flex h-full flex-col border border-black/10 bg-white shadow-sm">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        {Icono && (
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center ${estilo.icono}`}>
            <Icono className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
          </span>
        )}
        <h3 className="min-w-0 flex-1 text-sm font-semibold leading-snug text-vialto-charcoal">{titulo}</h3>
        {cantidad != null && cantidad > 0 && (
          <span
            className={`inline-flex h-6 min-w-6 shrink-0 items-center justify-center px-2 text-xs font-bold tabular-nums ${estilo.badge}`}
            title={`${cantidad} pendiente${cantidad === 1 ? "" : "s"}`}
          >
            {cantidad}
          </span>
        )}
        {verTodoTo && (
          <Link
            to={verTodoTo}
            className="inline-flex shrink-0 items-center text-xs font-medium text-vialto-steel transition-colors hover:text-vialto-fire"
          >
            Ver todo
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}
      </div>
      {hayMontos && (
        <div className={`mx-4 mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 border px-3 py-2 ${estilo.franja}`}>
          <span className="w-full text-[11px] font-medium uppercase tracking-[0.12em] text-vialto-steel">
            {etiquetaMontos}
          </span>
          <span className="font-[family-name:var(--font-display)] text-2xl leading-none tracking-wide text-vialto-charcoal">
            {principal}
          </span>
          {secundario && (
            <span className="font-[family-name:var(--font-display)] text-lg leading-none tracking-wide text-vialto-charcoal/70">
              + {secundario}
            </span>
          )}
        </div>
      )}
      <div className="min-h-0 flex-1 border-t border-black/10">{children}</div>
    </div>
  );
}

