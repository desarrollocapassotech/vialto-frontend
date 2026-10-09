import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useFieldConfig } from "@/hooks/useFieldConfig";
import { useMaestroData } from "@/hooks/useMaestroData";
import { labelVehiculoTipo } from "@/lib/labels";

const MARGEN_PX = 8;
const DEMORA_MS = 250;

function fmtFecha(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}
const fmtNum = (n: number) => n.toLocaleString("es-AR");

/**
 * Patente (u otro contenido) que al pasar el cursor —o al enfocarla con teclado— muestra la
 * ficha del vehículo: los campos de `VehiculoViewModal` salvo km y pertenencia (pedido de Elias), ocultando los vacíos y los
 * que la empresa tiene deshabilitados en "detalle_vehiculo". Los datos salen de `useMaestroData`
 * (sin fetch extra). Si el vehículo no está en el maestro, solo muestra el contenido.
 */
export function VehiculoHoverCard({ vehiculoId, children }: { vehiculoId: string; children: ReactNode }) {
  const maestro = useMaestroData();
  const { isVisible } = useFieldConfig("vehiculos");
  const triggerRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; arriba: boolean } | null>(null);

  const vehiculo = maestro.vehiculos.find((v) => v.id === vehiculoId);

  function abrir() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (!r) return;
      const arriba = r.bottom > window.innerHeight * 0.6; // cerca del borde inferior: se abre hacia arriba
      setPos({ top: arriba ? r.top - MARGEN_PX : r.bottom + MARGEN_PX, left: r.left, arriba });
    }, DEMORA_MS);
  }
  function cerrar() {
    if (timer.current) clearTimeout(timer.current);
    setPos(null);
  }

  useEffect(() => {
    if (!pos) return;
    window.addEventListener("scroll", cerrar, true);
    return () => window.removeEventListener("scroll", cerrar, true);
  }, [pos]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Que no se salga de la pantalla por la derecha.
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el || !pos) return;
    const max = window.innerWidth - MARGEN_PX - el.offsetWidth;
    el.style.left = `${Math.max(MARGEN_PX, Math.min(pos.left, max))}px`;
  }, [pos]);

  if (!vehiculo) return <>{children}</>;

  const anio = vehiculo.año ?? vehiculo.anio;

  const campos: { campo: string; label: string; value: string | number | null | undefined }[] = [
    { campo: "tipo", label: "Tipo", value: labelVehiculoTipo(vehiculo.tipo) },
    { campo: "marca", label: "Marca", value: vehiculo.marca },
    { campo: "modelo", label: "Modelo", value: vehiculo.modelo },
    { campo: "anio", label: "Año", value: anio },
    { campo: "nroChasis", label: "N.° Chasis", value: vehiculo.nroChasis },
    { campo: "poliza", label: "Póliza", value: vehiculo.poliza },
    { campo: "vencimientoPoliza", label: "Vto. Póliza", value: fmtFecha(vehiculo.vencimientoPoliza) },
    { campo: "tara", label: "Tara (kg)", value: vehiculo.tara != null ? fmtNum(vehiculo.tara) : null },
    { campo: "precinto", label: "Precinto", value: vehiculo.precinto },
  ];
  const visibles = campos.filter(
    (c) => c.value != null && c.value !== "" && isVisible("detalle_vehiculo", c.campo),
  );

  return (
    <>
      <span
        ref={triggerRef}
        tabIndex={0}
        onMouseEnter={abrir}
        onMouseLeave={cerrar}
        onFocus={abrir}
        onBlur={cerrar}
        className="cursor-help underline decoration-black/25 decoration-dotted underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-vialto-fire/40"
      >
        {children}
      </span>
      {pos &&
        createPortal(
          <div
            ref={cardRef}
            role="tooltip"
            className="pointer-events-none fixed z-[200] w-72 rounded-md border border-black/10 bg-white p-4 text-left shadow-lg"
            style={{ top: pos.top, left: pos.left, transform: pos.arriba ? "translateY(-100%)" : undefined }}
          >
            <div className="flex items-baseline justify-between gap-2 border-b border-black/10 pb-2">
              <p className="font-[family-name:var(--font-display)] text-lg tracking-wide">{vehiculo.patente}</p>
              {!vehiculo.activo && (
                <span className="rounded-sm border border-gray-300/80 bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  Inactivo
                </span>
              )}
            </div>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              {visibles.map((c) => (
                <div key={c.campo} className="contents">
                  <dt className="text-xs uppercase tracking-[0.08em] text-vialto-steel">{c.label}</dt>
                  <dd className="min-w-0 break-words text-vialto-charcoal">{c.value}</dd>
                </div>
              ))}
            </dl>
          </div>,
          document.body,
        )}
    </>
  );
}
