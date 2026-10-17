import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";

/**
 * Piezas comunes de los modales de detalle de comprobantes (Factura y Liquidación):
 * bloque de cabecera compacto, filas de montos (una desplegable) y filas de viajes.
 */

/** Bloque de cabecera: destinatario, comprobante, fechas, CAE, anulación… en grilla compacta. */
export function DatosCabecera({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded border border-black/10 bg-vialto-mist/60 px-4 py-3 sm:grid-cols-3">
      {children}
    </div>
  );
}

/** Dato del bloque de cabecera: etiqueta chica, valor y una línea secundaria opcional. */
export function Dato({
  label,
  value,
  sub,
  sub2,
  className = "",
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  /** Segunda línea secundaria (ej. domicilio debajo del CUIT). */
  sub2?: string;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.18em] text-vialto-steel">
        {label}
      </p>
      <p
        className="truncate text-sm font-medium text-vialto-charcoal"
        title={typeof value === "string" ? value : undefined}
      >
        {value ?? "—"}
      </p>
      {sub && <p className="truncate text-xs text-vialto-steel">{sub}</p>}
      {sub2 && (
        <p className="truncate text-xs text-vialto-steel" title={sub2}>
          {sub2}
        </p>
      )}
    </div>
  );
}

/** Título + recuadro del detalle de montos. */
export function DetalleMontosCard({
  loading,
  titulo = "Detalle del comprobante",
  children,
}: {
  loading?: boolean;
  titulo?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-[family-name:var(--font-ui)] uppercase tracking-[0.2em] text-vialto-steel">
        {titulo}
      </p>
      <div className="min-h-[4rem] rounded border border-black/10 bg-white px-4 py-1">
        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner className="h-5 w-5" />
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

/** Fila de monto del detalle (label a la izquierda, importe alineado a la derecha). */
export function FilaMonto({
  label,
  value,
  muted,
  bold,
  separator,
}: {
  label: ReactNode;
  value: string;
  muted?: boolean;
  bold?: boolean;
  separator?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 ${
        separator
          ? "border-t border-black/10 pt-1.5 mt-0.5"
          : "border-b border-black/5 last:border-0 py-1.5"
      } ${bold ? "py-1.5" : ""}`}
    >
      <span
        className={`text-xs ${
          muted
            ? "text-vialto-steel"
            : bold
              ? "font-medium text-vialto-charcoal"
              : "text-vialto-charcoal"
        }`}
      >
        {label}
      </span>
      <span
        className={`text-sm tabular-nums ${
          bold
            ? "font-semibold text-vialto-charcoal"
            : muted
              ? "text-vialto-steel"
              : "text-vialto-charcoal"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Fila de monto que se despliega para mostrar lo que la compone (ej. los viajes del bruto
 * o del neto). Abierta, el total lo reemplazan los importes de cada línea del detalle.
 */
export function FilaMontoDesplegable({
  label,
  resumen,
  value,
  children,
}: {
  label: string;
  /** Texto chico al lado del label (ej. "1 viaje"). */
  resumen?: string;
  value: string;
  children: ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div className="border-b border-black/5">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="flex w-full cursor-pointer items-baseline justify-between gap-4 py-1.5 text-left hover:bg-vialto-mist/40"
      >
        <span className="inline-flex items-center gap-1.5 text-xs text-vialto-charcoal">
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 self-center text-vialto-steel transition-transform ${
              abierto ? "rotate-180" : ""
            }`}
            strokeWidth={2}
            aria-hidden
          />
          {label}
          {resumen && <span className="text-vialto-steel">({resumen})</span>}
        </span>
        {!abierto && (
          <span className="text-sm tabular-nums text-vialto-charcoal">{value}</span>
        )}
      </button>
      {abierto && <div className="pb-1.5">{children}</div>}
    </div>
  );
}

export type ViajeDetalleItem = {
  key: string;
  viajeId: string;
  numero: string;
  fechaCarga?: string | null;
  origen?: string | null;
  destino?: string | null;
  /** Línea extra opcional (ej. "ID Propio 2: …"). */
  extra?: string | null;
  importe: string;
};

/**
 * Lista de viajes dentro de una fila desplegable: sin recuadro propio, así el importe de
 * cada viaje queda alineado con los demás montos. Tocar un viaje abre su detalle.
 */
export function ViajesDetalleLista({
  items,
  vacio,
  loadingViajeId,
  onVerViaje,
  fmtFecha,
}: {
  items: ViajeDetalleItem[];
  /** Texto si no hay viajes con detalle. */
  vacio: string;
  loadingViajeId?: string | null;
  onVerViaje: (viajeId: string) => void;
  fmtFecha: (iso: string) => string;
}) {
  if (items.length === 0) {
    return <p className="pl-5 text-xs text-vialto-steel">{vacio}</p>;
  }
  return (
    <div className="max-h-52 divide-y divide-black/5 overflow-y-auto">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          disabled={loadingViajeId === it.viajeId}
          onClick={() => onVerViaje(it.viajeId)}
          className="flex w-full items-baseline justify-between gap-4 py-1.5 pl-5 text-left hover:bg-vialto-mist/40 focus:outline-none focus-visible:bg-vialto-mist disabled:cursor-wait disabled:opacity-60"
        >
          <span className="min-w-0">
            <span className="block text-xs text-vialto-charcoal">
              Viaje #{it.numero}
              {it.fechaCarga && (
                <span className="ml-1.5 text-vialto-steel">{fmtFecha(it.fechaCarga)}</span>
              )}
            </span>
            {(it.origen || it.destino) && (
              <span className="block truncate text-[11px] text-vialto-steel">
                {it.origen ?? "—"} → {it.destino ?? "—"}
              </span>
            )}
            {it.extra && (
              <span className="block text-[11px] text-vialto-steel">{it.extra}</span>
            )}
          </span>
          <span className="shrink-0 text-sm tabular-nums text-vialto-charcoal">
            {it.importe}
          </span>
        </button>
      ))}
    </div>
  );
}
