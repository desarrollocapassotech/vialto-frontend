import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  LayoutDashboard,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import {
  COLUMNAS_DASHBOARD,
  TIPO_BLOQUE_LABEL,
  anchoBloqueDashboard,
  bloqueDashboard,
  bloquesDisponibles,
  bloquesRecomendados,
  clasesCeldaDashboard,
  filasDashboard,
  iconoBloque,
  ordenVisualDashboard,
  tamanoBloqueLabel,
  type DashboardBloqueTipo,
} from "@/lib/dashboardBloques";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import type { Tenant } from "@/types/api";

type TenantDashboard = Pick<
  Tenant,
  "modules" | "dashboardBloques" | "mantenimientoPlanesHabilitados" | "tipoFlota"
>;

const TINTE_TIPO: Record<DashboardBloqueTipo, string> = {
  tarjeta: "bg-orange-50 text-vialto-fire",
  pendientes: "bg-amber-50 text-amber-600",
  analisis: "bg-sky-50 text-sky-700",
};

const TIPOS: DashboardBloqueTipo[] = ["tarjeta", "pendientes", "analisis"];

/**
 * Editor visual del dashboard (Inicio de la empresa y ficha de superadmin): barra de
 * edición, grilla con los bloques que se arrastran para ordenar y se quitan con la X, y
 * panel lateral "Agregar bloques". Controlado: el orden vive en el padre (así el
 * dashboard pide los datos de un bloque recién agregado).
 */
export function DashboardEditor({
  tenant,
  orden,
  onOrden,
  renderBloque,
  onGuardar,
  onCancelar,
  guardando,
  hayCambios,
}: {
  tenant: TenantDashboard;
  /** Orden visual (ya acomodado con `ordenVisualDashboard`). */
  orden: string[];
  onOrden: (orden: string[]) => void;
  /** Lo que se ve de cada bloque: el bloque real (Inicio) o una vista previa (superadmin). */
  renderBloque: (id: string) => ReactNode;
  onGuardar: () => void;
  onCancelar?: () => void;
  guardando: boolean;
  hayCambios: boolean;
}) {
  const [panelAbierto, setPanelAbierto] = useState(false);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [recienAgregado, setRecienAgregado] = useState<string | null>(null);

  const sensors = useSensors(
    // Un pequeño margen para que un click (ej. en la X) no arranque un arrastre.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const celdas = useMemo(() => filasDashboard(orden).flat(), [orden]);
  const recomendados = useMemo(
    () => ordenVisualDashboard(bloquesRecomendados(tenant)),
    [tenant],
  );
  const esRecomendado =
    orden.length === recomendados.length && orden.every((id, i) => id === recomendados[i]);

  useEffect(() => {
    if (!recienAgregado) return;
    const t = window.setTimeout(() => setRecienAgregado(null), 1600);
    document
      .getElementById(`bloque-${recienAgregado}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    return () => window.clearTimeout(t);
  }, [recienAgregado]);

  function onDragStart(e: DragStartEvent) {
    setArrastrando(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setArrastrando(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const desde = orden.indexOf(String(active.id));
    const hasta = orden.indexOf(String(over.id));
    if (desde < 0 || hasta < 0) return;
    onOrden(ordenVisualDashboard(arrayMove(orden, desde, hasta)));
  }

  function agregar(id: string) {
    onOrden(ordenVisualDashboard([...orden, id]));
    setRecienAgregado(id);
  }

  return (
    <div className="space-y-4">
      {/* Barra de edición: queda pegada arriba (debajo del header de la app) al hacer scroll. */}
      <div className="sticky top-[4.5rem] z-20 flex flex-col gap-3 border border-vialto-charcoal bg-vialto-charcoal px-4 py-3 text-white shadow-lg sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-vialto-fire">
            <LayoutDashboard className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Personalizando el panel</p>
            <p className="text-xs text-white/70">
              Arrastrá los bloques para moverlos, quitá los que no uses con la ✕ y sumá nuevos.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPanelAbierto(true)}
            className="inline-flex h-9 items-center gap-1.5 border border-white/30 px-3 text-sm hover:bg-white/10"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Agregar bloques
          </button>
          <button
            type="button"
            disabled={esRecomendado || guardando}
            onClick={() => onOrden(recomendados)}
            title="Vuelve al set de bloques recomendado para los módulos de la empresa"
            className="inline-flex h-9 items-center gap-1.5 px-2 text-sm text-white/80 hover:text-white disabled:opacity-40"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Recomendado
          </button>
          {onCancelar && (
            <button
              type="button"
              disabled={guardando}
              onClick={onCancelar}
              className="inline-flex h-9 items-center px-3 text-sm text-white/80 hover:text-white disabled:opacity-40"
            >
              Cancelar
            </button>
          )}
          <button
            type="button"
            disabled={!hayCambios || guardando || orden.length === 0}
            onClick={onGuardar}
            title={orden.length === 0 ? "Dejá al menos un bloque" : undefined}
            className="inline-flex h-9 items-center gap-1.5 bg-vialto-fire px-4 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-40"
          >
            {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Guardar cambios
          </button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setArrastrando(null)}
      >
        <SortableContext items={orden} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {celdas.map(({ id, span }) => (
              <CeldaEditable
                key={id}
                id={id}
                span={span}
                destacada={recienAgregado === id}
                puedeQuitar={orden.length > 1}
                onQuitar={() => onOrden(ordenVisualDashboard(orden.filter((x) => x !== id)))}
              >
                {renderBloque(id)}
              </CeldaEditable>
            ))}
            <button
              type="button"
              onClick={() => setPanelAbierto(true)}
              className="col-span-2 flex min-h-[148px] flex-col items-center justify-center gap-2 border-2 border-dashed border-black/15 bg-white/60 text-sm font-medium text-vialto-steel transition-colors hover:border-vialto-fire hover:bg-white hover:text-vialto-fire lg:col-span-1 lg:min-h-[168px]"
            >
              <span className="flex h-10 w-10 items-center justify-center border-2 border-current">
                <Plus className="h-5 w-5" aria-hidden />
              </span>
              Agregar bloque
            </button>
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {arrastrando ? <FichaArrastre id={arrastrando} /> : null}
        </DragOverlay>
      </DndContext>

      {panelAbierto && (
        <PanelAgregarBloques
          tenant={tenant}
          orden={orden}
          onAgregar={agregar}
          onCerrar={() => setPanelAbierto(false)}
        />
      )}
    </div>
  );
}

function CeldaEditable({
  id,
  span,
  destacada,
  puedeQuitar,
  onQuitar,
  children,
}: {
  id: string;
  span: number;
  destacada: boolean;
  puedeQuitar: boolean;
  onQuitar: () => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const label = bloqueDashboard(id)?.label ?? id;
  return (
    <div
      ref={setNodeRef}
      id={`bloque-${id}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`relative min-w-0 scroll-mt-40 ${clasesCeldaDashboard(id, span)} ${
        isDragging ? "z-10 opacity-30" : ""
      }`}
    >
      {/* El bloque se ve tal cual, pero sin clicks: en edición todo el bloque se agarra. */}
      <div className="pointer-events-none h-full select-none [&>*]:h-full" aria-hidden>
        {children}
      </div>
      <div
        {...attributes}
        {...listeners}
        aria-label={`Mover ${label}`}
        aria-roledescription="bloque movible"
        className={`absolute inset-0 cursor-grab touch-none border-2 border-dashed outline-none transition-colors active:cursor-grabbing focus-visible:border-solid focus-visible:border-vialto-fire ${
          destacada
            ? "border-solid border-vialto-fire bg-vialto-fire/10"
            : "border-vialto-fire/35 hover:border-vialto-fire hover:bg-vialto-fire/[0.04]"
        }`}
      />
      <div className="absolute right-2 top-2 flex gap-1">
        <span
          className="pointer-events-none flex h-8 w-8 items-center justify-center bg-vialto-charcoal text-white shadow"
          aria-hidden
        >
          <GripVertical className="h-4 w-4" />
        </span>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onClick={onQuitar}
          disabled={!puedeQuitar}
          aria-label={`Quitar ${label}`}
          title={puedeQuitar ? `Quitar "${label}"` : "Tiene que quedar al menos un bloque"}
          className="flex h-8 w-8 items-center justify-center border border-black/10 bg-white text-rose-600 shadow transition-colors hover:bg-rose-600 hover:text-white disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-rose-600"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

/** Lo que sigue al puntero mientras se arrastra: una ficha liviana con el nombre del bloque. */
function FichaArrastre({ id }: { id: string }) {
  const def = bloqueDashboard(id);
  const Icono = iconoBloque(id);
  return (
    <div className="inline-flex max-w-xs cursor-grabbing items-center gap-3 border-2 border-vialto-fire bg-white px-4 py-3 shadow-2xl">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center ${TINTE_TIPO[def?.tipo ?? "tarjeta"]}`}>
        <Icono className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <span className="text-sm font-semibold text-vialto-charcoal">{def?.label ?? id}</span>
    </div>
  );
}

/** Mini esquema de cuántas de las 4 columnas ocupa un bloque. */
function EsquemaAncho({ id }: { id: string }) {
  const ancho = anchoBloqueDashboard(id);
  return (
    <span className="inline-flex gap-0.5" aria-hidden>
      {Array.from({ length: COLUMNAS_DASHBOARD }, (_, i) => (
        <span key={i} className={`h-2 w-3 ${i < ancho ? "bg-vialto-fire" : "bg-black/10"}`} />
      ))}
    </span>
  );
}

function sinAcentos(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function PanelAgregarBloques({
  tenant,
  orden,
  onAgregar,
  onCerrar,
}: {
  tenant: TenantDashboard;
  orden: string[];
  onAgregar: (id: string) => void;
  onCerrar: () => void;
}) {
  useLockBodyScroll(true);
  const [busqueda, setBusqueda] = useState("");
  const q = sinAcentos(busqueda.trim());
  const libres = bloquesDisponibles(tenant).filter((b) => !orden.includes(b.id));
  const visibles = libres.filter(
    (b) => !q || sinAcentos(`${b.label} ${b.ayuda} ${b.modulo}`).includes(q),
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCerrar]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Agregar bloques">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onCerrar}
        className="absolute inset-0 bg-black/30 animate-[fadeIn_150ms_ease-out]"
      />
      <div className="relative flex h-full w-full max-w-md flex-col border-l border-black/10 bg-vialto-mist shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-black/10 bg-white px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-vialto-charcoal">Agregar bloques</h2>
            <p className="text-xs text-vialto-steel">
              Tocá un bloque para sumarlo al panel. Después lo podés arrastrar adonde quieras.
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex h-9 w-9 shrink-0 items-center justify-center text-vialto-steel hover:bg-vialto-mist hover:text-vialto-charcoal"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="border-b border-black/10 bg-white px-5 py-3">
          <label className="flex h-10 items-center gap-2 border border-black/15 bg-white px-3 focus-within:border-vialto-fire">
            <Search className="h-4 w-4 text-vialto-steel" aria-hidden />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar (ej. combustible, facturas…)"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              autoFocus
            />
          </label>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-4">
          {libres.length === 0 ? (
            <p className="py-10 text-center text-sm text-vialto-steel">
              Ya tenés en el panel todos los bloques disponibles para tus módulos.
            </p>
          ) : visibles.length === 0 ? (
            <p className="py-10 text-center text-sm text-vialto-steel">
              Ningún bloque coincide con “{busqueda.trim()}”.
            </p>
          ) : (
            TIPOS.map((tipo) => {
              const deTipo = visibles.filter((b) => b.tipo === tipo);
              if (deTipo.length === 0) return null;
              return (
                <section key={tipo}>
                  <h3 className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-vialto-steel">
                    {TIPO_BLOQUE_LABEL[tipo]}
                    <span className="bg-black/[0.06] px-1.5 py-0.5 text-[10px] tabular-nums">{deTipo.length}</span>
                  </h3>
                  <ul className="space-y-2">
                    {deTipo.map((b) => {
                      const Icono = iconoBloque(b.id);
                      return (
                        <li key={b.id}>
                          <button
                            type="button"
                            onClick={() => onAgregar(b.id)}
                            className="group flex w-full items-start gap-3 border border-black/10 bg-white p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-vialto-fire/50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-vialto-fire"
                          >
                            <span className={`flex h-10 w-10 shrink-0 items-center justify-center ${TINTE_TIPO[b.tipo]}`}>
                              <Icono className="h-5 w-5" aria-hidden />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold text-vialto-charcoal">{b.label}</span>
                              <span className="mt-0.5 block text-xs leading-snug text-vialto-steel">{b.ayuda}</span>
                              <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-vialto-steel">
                                <span className="bg-vialto-mist px-1.5 py-0.5">{b.modulo}</span>
                                <span className="inline-flex items-center gap-1.5">
                                  <EsquemaAncho id={b.id} />
                                  {tamanoBloqueLabel(b.id)}
                                </span>
                              </span>
                            </span>
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-black/10 text-vialto-steel transition-colors group-hover:border-vialto-fire group-hover:bg-vialto-fire group-hover:text-white">
                              <Plus className="h-4 w-4" aria-hidden />
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/** Vista previa de un bloque (superadmin no puede ver los datos reales de la empresa). */
export function BloqueVistaPrevia({ id }: { id: string }) {
  const def = bloqueDashboard(id);
  const tipo = def?.tipo ?? "tarjeta";
  const Icono = iconoBloque(id);
  const alto = tipo === "tarjeta" ? "min-h-[148px]" : tipo === "pendientes" ? "min-h-[220px]" : "min-h-[180px]";
  return (
    <div className={`flex h-full flex-col border border-black/10 bg-white p-4 shadow-sm ${alto}`}>
      <div className="flex items-start gap-3 pr-20">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center ${TINTE_TIPO[tipo]}`}>
          <Icono className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-snug text-vialto-charcoal">{def?.label ?? id}</p>
          <p className="text-[11px] uppercase tracking-[0.12em] text-vialto-steel">
            {TIPO_BLOQUE_LABEL[tipo]} · {def?.modulo}
          </p>
        </div>
      </div>
      {/* Esqueleto que sugiere el contenido: un número, filas de tabla o un gráfico. */}
      <div className="mt-auto pt-4">
        {tipo === "tarjeta" ? (
          <span className="block h-8 w-28 bg-black/[0.06]" />
        ) : tipo === "pendientes" ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="block h-3 bg-black/[0.05]" style={{ width: `${90 - i * 12}%` }} />
            ))}
          </div>
        ) : (
          <div className="flex h-20 items-end gap-2">
            {[40, 65, 50, 80, 55, 70, 45, 90].map((h, i) => (
              <span key={i} className="flex-1 bg-black/[0.06]" style={{ height: `${h}%` }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
