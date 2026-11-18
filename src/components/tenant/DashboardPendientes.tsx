import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { CeldaAccionesFila } from "@/components/ui/AccionesFila";
import type { AccionOpcion } from "@/components/ui/AccionesOpcionesSheet";
import { clickFilaAcciones } from "@/lib/accionesFila";

/** Filas que se muestran en un bloque de pendientes; el resto, con "Ver todo →". */
export const PENDIENTES_MAX_FILAS = 6;

export type PendienteFila = {
  id: string;
  celdas: ReactNode[];
  acciones: AccionOpcion[];
};

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
  columnas: string[];
  filas: PendienteFila[];
  vacio: string;
  loading?: boolean;
}) {
  const visibles = filas.slice(0, PENDIENTES_MAX_FILAS);
  return (
    <DashboardPendientesMarco
      titulo={titulo}
      cantidad={loading ? null : cantidad}
      resumen={resumen}
      verTodoTo={cantidad > 0 ? verTodoTo : undefined}
    >
      {loading ? (
        <p className="px-4 py-6 text-sm text-vialto-steel">Cargando…</p>
      ) : visibles.length === 0 ? (
        <p className="px-4 py-6 text-sm text-vialto-steel">{vacio}</p>
      ) : (
        <div className="overflow-x-auto px-4 pb-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/10">
                {columnas.map((c) => (
                  <th
                    key={c}
                    className="py-2 text-left font-normal text-[11px] uppercase tracking-[0.15em] text-vialto-steel"
                  >
                    {c}
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
