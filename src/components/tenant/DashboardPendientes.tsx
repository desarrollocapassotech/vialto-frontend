import { CargandoVialto } from "@/components/shared/CargandoVialto";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";
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
  cantidad,
  resumen,
  verTodoTo,
  columnas,
  filas,
  vacio,
  loading,
}: {
  titulo: string;
  /** Total real (puede ser mayor que las filas mostradas). */
  cantidad: number;
  /** Línea chica debajo del título (ej. montos por moneda). */
  resumen?: string | null;
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
      cantidad={loading ? null : cantidad}
      resumen={resumen}
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

/** Marco común (también para bloques con contenido propio, ej. Mantenimiento o Combustible). */
export function DashboardPendientesMarco({
  titulo,
  cantidad,
  resumen,
  verTodoTo,
  children,
}: {
  titulo: string;
  cantidad?: number | null;
  resumen?: string | null;
  verTodoTo?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col border border-black/10 bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-black/10 px-4 py-3">
        <div className="min-w-0">
          <h3 className="font-[family-name:var(--font-ui)] text-xs uppercase tracking-[0.2em] text-vialto-steel">
            {titulo}
            {cantidad != null && cantidad > 0 && (
              <span className="ml-2 font-semibold text-vialto-charcoal">{cantidad}</span>
            )}
          </h3>
          {resumen && <p className="mt-0.5 text-xs text-vialto-steel">{resumen}</p>}
        </div>
        {verTodoTo && (
          <Link to={verTodoTo} className="shrink-0 text-xs text-vialto-fire hover:underline">
            Ver todo →
          </Link>
        )}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
