import { useEffect, useState } from "react";
import {
  ViewModalShell,
  viewModalBtnGhost,
  viewModalBtnPrimary,
} from "@/components/ui/ViewModalShell";
import { CrudFieldLabel, CrudInput } from "@/components/crud/CrudFields";
import { ErrorPieModal } from "@/components/shared/ErrorPieModal";
import { AmbienteTestBadge } from "@/components/liquidaciones/AmbienteTestBadge";
import { apiJson } from "@/lib/api";
import { friendlyError } from "@/lib/friendlyError";
import { useToast } from "@/lib/toast";
import { descargarLibroIvaExcel, descargarLibroIvaTxt, rangoMesAnterior } from "@/lib/libroIva";
import type { LibroIvaResultado, LibroIvaTipo, LibroIvaTxt } from "@/types/api";

type Formato = "excel" | "txt";

/**
 * Exportar el Libro IVA (Ventas desde Facturas, Compras desde Liquidaciones): rango de fechas
 * + formato — Excel para conciliar o los TXT para importar en el Libro IVA Digital de ARCA.
 * Si algún comprobante no pudo entrar al TXT, se listan acá con el motivo.
 * Es un modal de opciones de exportación: no pide confirmación al cerrar.
 */
export function LibroIvaExportModal({
  tipo,
  url,
  tenantId,
  ambientePrueba,
  getToken,
  onClose,
}: {
  tipo: LibroIvaTipo;
  /** Endpoint sin query, ej. `/api/facturacion/libro-iva/ventas`. El TXT es `${url}/txt`. */
  url: string;
  /** Solo superadmin (pantalla embebida): empresa elegida. */
  tenantId?: string;
  /**
   * Configuración ARCA en homologación: el backend arma el libro solo con comprobantes de
   * prueba (en producción, solo con los reales). Acá solo se muestra el badge en el título.
   */
  ambientePrueba: boolean;
  getToken: () => Promise<string | null>;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const inicial = rangoMesAnterior();
  const [desde, setDesde] = useState(inicial.desde);
  const [hasta, setHasta] = useState(inicial.hasta);
  const [formato, setFormato] = useState<Formato>("excel");
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [excluidos, setExcluidos] = useState<LibroIvaTxt["excluidos"] | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !generando) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [generando, onClose]);

  const titulo = tipo === "ventas" ? "Libro IVA Ventas" : "Libro IVA Compras";

  async function generar() {
    const errs: Record<string, string> = {};
    if (!desde) errs.desde = "Ingresá la fecha desde.";
    if (!hasta) errs.hasta = "Ingresá la fecha hasta.";
    if (desde && hasta && hasta < desde) errs.hasta = "La fecha hasta no puede ser anterior a desde.";
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const qs = new URLSearchParams({ desde, hasta });
    if (tenantId) qs.set("tenantId", tenantId);
    setError(null);
    setExcluidos(null);
    setGenerando(true);
    try {
      if (formato === "excel") {
        const resultado = await apiJson<LibroIvaResultado>(`${url}?${qs}`, () => getToken());
        if (resultado.comprobantes.length === 0) {
          setError("No hay comprobantes en ese rango de fechas.");
          return;
        }
        descargarLibroIvaExcel(resultado);
        showToast(`${titulo} descargado (${resultado.comprobantes.length} comprobantes).`, "success");
        onClose();
        return;
      }
      const txt = await apiJson<LibroIvaTxt>(`${url}/txt?${qs}`, () => getToken());
      descargarLibroIvaTxt(txt);
      if (txt.excluidos.length > 0) {
        // Se queda abierto para que se vea qué no entró y por qué.
        setExcluidos(txt.excluidos);
        return;
      }
      showToast("Archivos del Libro IVA Digital descargados.", "success");
      onClose();
    } catch (e) {
      setError(friendlyError(e, tipo === "ventas" ? "facturacion" : "arca"));
    } finally {
      setGenerando(false);
    }
  }

  return (
    <ViewModalShell
      title={
        <span className="inline-flex items-center gap-2">
          {titulo}
          <AmbienteTestBadge ambiente={ambientePrueba ? "homologacion" : null} />
        </span>
      }
      onClose={generando ? () => {} : onClose}
      footer={
        <>
          <ErrorPieModal error={error} fieldErrors={fieldErrors} />
          <button
            type="button"
            onClick={onClose}
            disabled={generando}
            className={`${viewModalBtnGhost} disabled:opacity-50`}
          >
            {excluidos ? "Cerrar" : "Cancelar"}
          </button>
          <button
            type="button"
            onClick={() => void generar()}
            disabled={generando}
            className={viewModalBtnPrimary}
          >
            {generando ? "Generando…" : "Descargar"}
          </button>
        </>
      }
    >
      <div className="grid gap-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <CrudFieldLabel required>Desde</CrudFieldLabel>
            <CrudInput
              type="date"
              value={desde}
              error={fieldErrors.desde}
              onChange={(e) => setDesde(e.target.value)}
              disabled={generando}
            />
          </label>
          <label className="grid gap-1.5">
            <CrudFieldLabel required>Hasta</CrudFieldLabel>
            <CrudInput
              type="date"
              value={hasta}
              error={fieldErrors.hasta}
              onChange={(e) => setHasta(e.target.value)}
              disabled={generando}
            />
          </label>
        </div>

        <fieldset className="grid gap-2" disabled={generando}>
          <CrudFieldLabel>Formato</CrudFieldLabel>
          <OpcionFormato
            checked={formato === "excel"}
            onChange={() => setFormato("excel")}
            titulo="Excel para conciliar"
            detalle=""
          />
          <OpcionFormato
            checked={formato === "txt"}
            onChange={() => setFormato("txt")}
            titulo="TXT para el Libro IVA Digital"
            detalle=""
          />
        </fieldset>


        {excluidos && (
          <div className="rounded border border-amber-300/80 bg-amber-50 px-3 py-3 text-sm text-amber-950">
            <p className="font-medium">
              Se descargaron los archivos, pero {excluidos.length}{" "}
              {excluidos.length === 1 ? "comprobante no entró" : "comprobantes no entraron"} al TXT:
            </p>
            <ul className="mt-2 max-h-48 list-disc space-y-1 overflow-y-auto pl-5 text-xs">
              {excluidos.map((e, i) => (
                <li key={i}>
                  <span className="font-medium">{e.comprobante}</span>: {e.motivo}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs">
              Corregilos en la factura o liquidación y volvé a descargar, o cargalos a mano en ARCA.
              En el Excel sí aparecen.
            </p>
          </div>
        )}
      </div>
    </ViewModalShell>
  );
}

function OpcionFormato({
  checked,
  onChange,
  titulo,
  detalle,
}: {
  checked: boolean;
  onChange: () => void;
  titulo: string;
  detalle: string;
}) {
  return (
    <label
      className={[
        "flex cursor-pointer items-start gap-3 rounded border px-3 py-2.5",
        checked ? "border-vialto-fire/60 bg-vialto-mist" : "border-black/15 bg-white",
      ].join(" ")}
    >
      <input type="radio" checked={checked} onChange={onChange} className="mt-1 h-4 w-4" />
      <span>
        <span className="block text-sm font-medium text-vialto-charcoal">{titulo}</span>
        <span className="block text-xs text-vialto-steel">{detalle}</span>
      </span>
    </label>
  );
}
