import { Link } from "react-router-dom";
import { EstadoVencimientoBadge } from "@/components/mantenimiento/MantenimientoBadges";
import { fmtFaltan, fmtFecha } from "@/lib/mantenimientoLabels";
import type { FilaVencimiento } from "@/types/mantenimiento";

/** Los próximos vencimientos (vencidos y próximos) para la pestaña Mantenimiento del panel. */
export function ProximosVencimientosLista({
  filas,
  hayPlanes,
}: {
  filas: FilaVencimiento[];
  /** Sin asignaciones: invita a configurar en vez de decir "nada vencido". */
  hayPlanes: boolean;
}) {
  return (
    <div className="border border-black/10 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-3">
        <h3 className="font-[family-name:var(--font-ui)] text-xs uppercase tracking-[0.2em] text-vialto-steel">
          Próximos vencimientos
        </h3>
        {hayPlanes && (
          <Link to="/mantenimiento?tab=vencimientos" className="text-xs text-vialto-fire hover:underline">
            Ver todos →
          </Link>
        )}
      </div>
      {!hayPlanes ? (
        <p className="px-4 py-6 text-sm text-vialto-steel">
          Todavía no configuraste Mantenimiento.{" "}
          <Link to="/mantenimiento" className="font-medium text-vialto-fire hover:underline">
            Configuralo en un par de minutos →
          </Link>
        </p>
      ) : filas.length === 0 ? (
        <p className="px-4 py-6 text-sm text-vialto-steel">Nada vencido ni por vencer.</p>
      ) : (
        <ul className="divide-y divide-black/5">
          {filas.map((f) => (
            <li key={f.vehiculoPlanId} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm">
              <EstadoVencimientoBadge estado={f.estado} />
              <span className="font-medium text-vialto-charcoal">{f.vehiculo.patente}</span>
              <span className="min-w-0 flex-1 truncate text-vialto-charcoal">{f.plan.nombre}</span>
              <span className={f.estado === "vencido" ? "text-red-700" : "text-amber-800"}>{fmtFaltan(f)}</span>
              {f.fechaEstimada && <span className="text-xs text-vialto-steel">{fmtFecha(f.fechaEstimada)}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
