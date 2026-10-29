import * as XLSX from "xlsx";
import { fmtDateUtc } from "@/lib/fmtDateUtc";
import { hoyArgentinaIso } from "@/lib/facturaFechaEmision";
import type { LibroIvaComprobante, LibroIvaResultado, LibroIvaTxt } from "@/types/api";

/**
 * Libro IVA: Excel para conciliar y descarga de los TXT del Libro IVA Digital.
 * Los comprobantes ya vienen calculados del backend (`GET .../libro-iva/{ventas|compras}`);
 * acá solo se presentan. En el Excel las NC/ND de anulación van en negativo; en el TXT no
 * (lo arma el backend con el formato de ARCA).
 */

const LABEL_CBTE: Record<number, string> = {
  1: "Factura A",
  2: "Nota de Débito A",
  3: "Nota de Crédito A",
  6: "Factura B",
  7: "Nota de Débito B",
  8: "Nota de Crédito B",
  11: "Factura C",
  12: "Nota de Débito C",
  13: "Nota de Crédito C",
  19: "Factura E",
  20: "Nota de Débito E",
  21: "Nota de Crédito E",
  51: "Factura M",
  52: "Nota de Débito M",
  53: "Nota de Crédito M",
  60: "Líquido Producto A",
  61: "Líquido Producto B",
  201: "FCE A",
  206: "FCE B",
  211: "FCE C",
};

export function labelTipoComprobanteLibro(cbteTipo: number | null): string {
  if (cbteTipo == null) return "";
  return LABEL_CBTE[cbteTipo] ?? `Tipo ${cbteTipo}`;
}

/** Rango por defecto: el mes anterior completo (el Libro IVA se presenta por mes). */
export function rangoMesAnterior(): { desde: string; hasta: string } {
  const [y, m] = hoyArgentinaIso().split("-").map(Number);
  const anio = m === 1 ? y - 1 : y;
  const mes = m === 1 ? 12 : m - 1;
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const mm = String(mes).padStart(2, "0");
  return { desde: `${anio}-${mm}-01`, hasta: `${anio}-${mm}-${String(ultimo).padStart(2, "0")}` };
}

const FMT_IMPORTE = "#,##0.00";

function fmtAlicuota(pct: number): string {
  return `${pct.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
}

/** Genera y descarga el Excel del Libro IVA (una fila por comprobante + fila de totales). */
export function descargarLibroIvaExcel(resultado: LibroIvaResultado) {
  const esCompras = resultado.tipo === "compras";
  const comprobantes = resultado.comprobantes;
  // Una columna de neto y una de IVA por cada alícuota que aparece en el período.
  const alicuotas = [...new Set(comprobantes.flatMap((c) => c.alicuotas.map((a) => a.pct)))].sort(
    (a, b) => b - a,
  );
  const signo = (c: LibroIvaComprobante) => (c.anulacion ? -1 : 1);

  const encabezado = [
    "Fecha",
    "Tipo",
    "Punto de venta",
    "Número",
    esCompras ? "Transportista" : "Cliente",
    "CUIT / Documento",
    ...alicuotas.flatMap((p) => [`Neto ${fmtAlicuota(p)}`, `IVA ${fmtAlicuota(p)}`]),
    "No gravado",
    "Exento",
    "Otros tributos",
    "Total",
    ...(esCompras ? ["Comisión", "IVA comisión"] : []),
    "Moneda",
    "Tipo de cambio",
    "CAE",
    "Origen",
    "Fuera del TXT",
    "Observaciones",
  ];

  const filas = comprobantes.map((c) => {
    const s = signo(c);
    const porPct = new Map(c.alicuotas.map((a) => [a.pct, a]));
    return [
      fmtDateUtc(c.fecha),
      labelTipoComprobanteLibro(c.cbteTipo),
      c.ptoVenta ?? "",
      c.cbteNro ?? c.numeroTexto,
      c.contraparte,
      c.docTipo === 99 ? "" : c.docNro,
      ...alicuotas.flatMap((p): Array<number | string> => {
        const a = porPct.get(p);
        return a ? [a.neto * s, a.iva * s] : ["", ""];
      }),
      c.noGravado * s,
      c.exento * s,
      c.otrosTributos * s,
      c.total * s,
      ...(esCompras
        ? [c.comision != null ? c.comision * s : "", c.ivaComision != null ? c.ivaComision * s : ""]
        : []),
      c.moneda === "PES" ? "ARS" : c.moneda === "DOL" ? "USD" : c.moneda,
      c.cotizacion ?? "",
      c.cae ?? "",
      c.prueba ? "Prueba (homologación)" : c.origen === "arca" ? "ARCA" : "Manual",
      c.incompleto ?? "",
      c.observaciones.join(" "),
    ];
  });

  // Totales en pesos (los comprobantes en otra moneda no se suman acá).
  const enPesos = comprobantes.filter((c) => c.moneda === "PES");
  const suma = (f: (c: LibroIvaComprobante) => number) =>
    Math.round(enPesos.reduce((s, c) => s + f(c) * signo(c), 0) * 100) / 100;
  const totales = [
    "TOTAL (ARS)",
    "",
    "",
    "",
    `${comprobantes.length} comprobante${comprobantes.length === 1 ? "" : "s"}`,
    "",
    ...alicuotas.flatMap((p) => [
      suma((c) => c.alicuotas.find((a) => a.pct === p)?.neto ?? 0),
      suma((c) => c.alicuotas.find((a) => a.pct === p)?.iva ?? 0),
    ]),
    suma((c) => c.noGravado),
    suma((c) => c.exento),
    suma((c) => c.otrosTributos),
    suma((c) => c.total),
    ...(esCompras ? [suma((c) => c.comision ?? 0), suma((c) => c.ivaComision ?? 0)] : []),
  ];

  const ws = XLSX.utils.aoa_to_sheet([encabezado, ...filas, [], totales]);
  // Formato de importe en las columnas de montos (desde la de Neto hasta Comisión/IVA comisión).
  const primeraMonto = 6;
  const ultimaMonto = primeraMonto + alicuotas.length * 2 + 3 + (esCompras ? 2 : 0);
  const filasConMontos = filas.length + 3;
  for (let r = 1; r < filasConMontos; r++) {
    for (let col = primeraMonto; col <= ultimaMonto; col++) {
      const celda = ws[XLSX.utils.encode_cell({ r, c: col })];
      if (celda && typeof celda.v === "number") celda.z = FMT_IMPORTE;
    }
  }
  ws["!cols"] = encabezado.map((h, i) => ({
    wch: i === 4 ? 32 : h === "Observaciones" || h === "Fuera del TXT" ? 50 : Math.max(12, h.length + 2),
  }));

  const titulo = esCompras ? "Libro IVA Compras" : "Libro IVA Ventas";
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, titulo);
  const prueba = resultado.esPrueba ? "_prueba" : "";
  XLSX.writeFile(
    wb,
    `${esCompras ? "libro_iva_compras" : "libro_iva_ventas"}_${resultado.desde}_${resultado.hasta}${prueba}.xlsx`,
  );
}

/** Descarga los TXT tal cual los armó el backend (bytes ANSI, sin re-codificar). */
export function descargarLibroIvaTxt(txt: LibroIvaTxt) {
  txt.archivos.forEach((archivo, i) => {
    const binario = atob(archivo.contenidoBase64);
    const bytes = new Uint8Array(binario.length);
    for (let j = 0; j < binario.length; j++) bytes[j] = binario.charCodeAt(j);
    const url = URL.createObjectURL(new Blob([bytes], { type: "text/plain" }));
    // Un pequeño intervalo entre archivos: algunos navegadores frenan descargas simultáneas.
    setTimeout(() => {
      const a = document.createElement("a");
      a.href = url;
      a.download = archivo.nombre;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, i * 400);
  });
}
