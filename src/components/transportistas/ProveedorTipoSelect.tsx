import { useState } from "react";
import { useTransportistaLabels } from "@/hooks/useTransportistaLabels";
import { useCategoriasProveedor } from "@/hooks/useCategoriasProveedor";
import {
  AYUDA_TIPO,
  proveedorTipoLabel,
  valorSelectTipo,
  type TipoProveedorElegido,
} from "@/lib/proveedorTipo";
import { marcarModalModificado } from "@/lib/descarteModal";

const CRUD_CLASS = "h-10 w-full border border-black/15 bg-white px-3 text-sm";

/**
 * Selector de tipo de proveedor: Transportista, Taller, los tipos propios que ya usó la
 * empresa (ej. "Combustible") y "Otro…", que habilita un campo para escribir uno nuevo.
 * Un tipo nuevo queda guardado con el proveedor y aparece en la lista la próxima vez.
 */
export function ProveedorTipoSelect({
  value,
  onChange,
  tenantId,
  selectClassName = CRUD_CLASS,
  inputClassName = CRUD_CLASS,
  error,
  mostrarAyuda = true,
}: {
  value: TipoProveedorElegido;
  onChange: (v: TipoProveedorElegido) => void;
  tenantId?: string;
  /** Default: mismo estilo que `CrudInput`/`CrudSelect` (páginas de alta/edición). */
  selectClassName?: string;
  inputClassName?: string;
  /** Marca el campo del tipo nuevo vacío (borde rojo). */
  error?: boolean;
  mostrarAyuda?: boolean;
}) {
  const labels = useTransportistaLabels(tenantId);
  const categorias = useCategoriasProveedor(tenantId);
  // "Otro…" elegido a mano: se muestra el campo aunque el texto coincida con una existente.
  // Una categoría guardada que (todavía) no está en la lista también muestra el campo.
  const [escribiendo, setEscribiendo] = useState(false);
  const seleccion = valorSelectTipo(value, categorias, escribiendo);
  const mostrarInput = seleccion === "nuevo";

  function elegir(v: string) {
    marcarModalModificado();
    if (v === "nuevo") {
      setEscribiendo(true);
      onChange({ tipo: "otro", categoria: "" });
    } else if (v.startsWith("cat:")) {
      setEscribiendo(false);
      onChange({ tipo: "otro", categoria: v.slice(4) });
    } else {
      setEscribiendo(false);
      onChange({ tipo: v as TipoProveedorElegido["tipo"], categoria: "" });
    }
  }

  return (
    <div className="grid gap-1.5">
      <select
        value={seleccion}
        onChange={(e) => elegir(e.target.value)}
        className={selectClassName}
        aria-label="Tipo de proveedor"
      >
        <option value="transportista">{proveedorTipoLabel("transportista", labels)}</option>
        <option value="taller">Taller</option>
        {categorias.map((c) => (
          <option key={c} value={`cat:${c}`}>
            {c}
          </option>
        ))}
        <option value="nuevo">Otro…</option>
      </select>
      {mostrarInput && (
        <input
          autoFocus
          type="text"
          maxLength={60}
          value={value.categoria}
          onChange={(e) => onChange({ tipo: "otro", categoria: e.target.value })}
          placeholder="¿Qué tipo de proveedor? Ej: Combustible, Gomería, Seguros"
          aria-label="Nuevo tipo de proveedor"
          className={`${inputClassName} ${error ? "border-red-400" : ""}`}
        />
      )}
      {mostrarAyuda && <span className="text-xs text-vialto-steel">{AYUDA_TIPO[value.tipo]}</span>}
    </div>
  );
}
