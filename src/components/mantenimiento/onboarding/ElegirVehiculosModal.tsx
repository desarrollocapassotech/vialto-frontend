import { useMemo, useState } from "react";
import { ViewModalShell, viewModalBtnGhost, viewModalBtnPrimary } from "@/components/ui/ViewModalShell";
import { useConfirmarDescarte } from "@/hooks/useConfirmarDescarte";
import { useFieldConfig } from "@/hooks/useFieldConfig";
import { camposVehiculo } from "@/lib/vehiculoCampos";
import { fmtKm } from "@/lib/mantenimientoLabels";
import type { Vehiculo } from "@/types/api";

const TH = "sticky top-0 z-10 bg-white px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-vialto-steel whitespace-nowrap";
const TD = "px-3 py-2 whitespace-nowrap";

/**
 * Selector de vehículos de un plan (asistente de Mantenimiento): tabla con los datos de cada
 * vehículo que la empresa tiene habilitados (`detalle_vehiculo`), buscador y marcar todos.
 * Si se tildó o destildó algo, Cancelar / × piden confirmación.
 */
export function ElegirVehiculosModal({
  titulo,
  vehiculos,
  inicial,
  onAceptar,
  onClose,
}: {
  titulo: string;
  vehiculos: Vehiculo[];
  inicial: Set<string>;
  onAceptar: (ids: Set<string>) => void;
  onClose: () => void;
}) {
  const { isVisible } = useFieldConfig("vehiculos");
  const [ids, setIds] = useState(() => new Set(inicial));
  const [busqueda, setBusqueda] = useState("");
  const descarte = useConfirmarDescarte(onClose);

  // Columnas: los campos habilitados que tengan dato en algún vehículo (sin columnas vacías).
  const columnas = useMemo(() => {
    const conDato = new Set<string>();
    for (const v of vehiculos) {
      for (const c of camposVehiculo(v)) if (c.value != null && c.value !== "") conDato.add(c.campo);
    }
    const base = vehiculos[0] ? camposVehiculo(vehiculos[0]) : [];
    return base.filter((c) => conDato.has(c.campo) && isVisible("detalle_vehiculo", c.campo)).map((c) => ({ campo: c.campo, label: c.label }));
  }, [vehiculos, isVisible]);
  const verKm = isVisible("detalle_vehiculo", "kmActual") && vehiculos.some((v) => v.kmActual > 0);

  const q = busqueda.trim().toLowerCase();
  const visibles = q
    ? vehiculos.filter((v) =>
        [v.patente, ...camposVehiculo(v).map((c) => c.value)].some((x) => String(x ?? "").toLowerCase().includes(q)),
      )
    : vehiculos;
  const todosVisibles = visibles.length > 0 && visibles.every((v) => ids.has(v.id));

  function alternar(id: string) {
    descarte.marcarModificado(); // el click en la fila no dispara un evento nativo
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function alternarVisibles() {
    setIds((prev) => {
      const next = new Set(prev);
      for (const v of visibles) {
        if (todosVisibles) next.delete(v.id);
        else next.add(v.id);
      }
      return next;
    });
  }

  const footer = (
    <>
      <span className="mr-auto text-xs text-vialto-steel">
        {ids.size} de {vehiculos.length} elegidos
      </span>
      <button type="button" onClick={descarte.solicitarCierre} className={viewModalBtnGhost}>
        Cancelar
      </button>
      <button
        type="button"
        onClick={() => {
          onAceptar(ids);
          onClose();
        }}
        className={viewModalBtnPrimary}
      >
        Listo
      </button>
    </>
  );

  return (
    <ViewModalShell
      title={titulo}
      onClose={descarte.solicitarCierre}
      descarte={descarte}
      footer={footer}
      maxWidthClass="sm:max-w-7xl"
      scrollBody
    >
      <div className="grid gap-3">
        <input
          type="search"
          autoFocus
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar patente, marca, modelo, tipo…"
          aria-label="Buscar vehículos"
          data-descarte-ignorar
          className="h-10 w-full border border-black/15 bg-white px-3 text-sm"
        />
        {visibles.length === 0 ? (
          <p className="text-sm text-vialto-steel">No hay vehículos que coincidan.</p>
        ) : (
          <div className="max-h-[55vh] overflow-auto border border-black/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/10">
                  <th className={`${TH} w-10`}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-vialto-charcoal"
                      checked={todosVisibles}
                      onChange={alternarVisibles}
                      aria-label={q ? `Marcar los ${visibles.length} que coinciden` : "Marcar todos"}
                      title={q ? `Marcar los ${visibles.length} que coinciden` : "Marcar todos"}
                    />
                  </th>
                  <th className={TH}>Patente</th>
                  {columnas.map((c) => (
                    <th key={c.campo} className={TH}>
                      {c.label}
                    </th>
                  ))}
                  {verKm && <th className={`${TH} text-right`}>Km actual</th>}
                </tr>
              </thead>
              <tbody>
                {visibles.map((v) => {
                  const valores = new Map(camposVehiculo(v).map((c) => [c.campo, c.value]));
                  const sel = ids.has(v.id);
                  return (
                    <tr
                      key={v.id}
                      onClick={() => alternar(v.id)}
                      className={`cursor-pointer border-b border-black/5 ${sel ? "bg-orange-50/60" : "hover:bg-vialto-mist/60"}`}
                    >
                      <td className={TD}>
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-vialto-charcoal"
                          checked={sel}
                          onChange={() => alternar(v.id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Elegir ${v.patente}`}
                        />
                      </td>
                      <td className={`${TD} font-medium text-vialto-charcoal`}>{v.patente}</td>
                      {columnas.map((c) => (
                        <td key={c.campo} className={`${TD} text-vialto-steel`}>
                          {valores.get(c.campo) ?? "—"}
                        </td>
                      ))}
                      {verKm && <td className={`${TD} text-right tabular-nums`}>{v.kmActual > 0 ? fmtKm(v.kmActual) : "—"}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ViewModalShell>
  );
}
