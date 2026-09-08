import type { PaisCodigo } from "./types";

export type PaisOpcion = {
  codigo: PaisCodigo;
  etiqueta: string;
};

/**
 * Lista de países disponibles en el buscador. Para agregar uno nuevo:
 * 1) ampliar `PaisCodigo` en types.ts
 * 2) añadir entrada aquí
 * 3) implementar `buscarXxx` y registrarlo en `buscarCiudades.ts`
 */
export const PAISES_SOPORTADOS: readonly PaisOpcion[] = [
  { codigo: "AR", etiqueta: "Argentina" },
  { codigo: "UY", etiqueta: "Uruguay" },
  { codigo: "PY", etiqueta: "Paraguay" },
  { codigo: "CL", etiqueta: "Chile" },
  { codigo: "BR", etiqueta: "Brasil" },
] as const;

export function esPaisSoportado(c: string): c is PaisCodigo {
  return c === "AR" || c === "UY" || c === "PY" || c === "CL" || c === "BR";
}

/**
 * Resuelve un valor de país guardado (código o texto libre, ej. "Argentina"
 * tal como lo trae una importación de Excel) al código de 2 letras que
 * esperan los selects de país. Devuelve "" si no reconoce nada.
 *
 * Bug real encontrado en QA (ago 2026): la importación masiva guarda `pais`
 * como texto libre (lo que venga en la columna del Excel), no como código —
 * los formularios de edición de Cliente/Transportista solo aceptaban el
 * código exacto (`esPaisSoportado`), así que un transportista importado con
 * "Argentina" en la columna País aparecía con el select de país vacío al
 * editar. Como el campo "Condición IVA" (numérico, solo AR) vs "Condición
 * tributaria" (texto, resto de países) se decide según el país seleccionado,
 * el select vacío hacía que se mostrara el campo de texto en vez del select
 * numérico — el valor de Condición IVA seguía en memoria, pero no se veía,
 * y se perdía si se guardaba sin querer.
 */
const DIACRITICOS = /[̀-ͯ]/g;
const sinAcentos = (s: string) => s.toLowerCase().normalize("NFD").replace(DIACRITICOS, "");

export function paisCodigoDesdeTexto(valor: string): PaisCodigo | "" {
  const v = valor.trim();
  if (!v) return "";
  if (esPaisSoportado(v)) return v;
  const normalizado = sinAcentos(v);
  const match = PAISES_SOPORTADOS.find(
    (p) => sinAcentos(p.etiqueta) === normalizado,
  );
  return match?.codigo ?? "";
}

type IdFiscalInfo = { label: string; placeholder: string };

const ID_FISCAL_POR_PAIS: Record<PaisCodigo, IdFiscalInfo> = {
  AR: { label: "CUIT / CUIL", placeholder: "30-71234567-8" },
  UY: { label: "RUT", placeholder: "21 234567 0001" },
  PY: { label: "RUC", placeholder: "80001234-5" },
  CL: { label: "RUT", placeholder: "12.345.678-9" },
  BR: { label: "CNPJ / CPF", placeholder: "12.345.678/0001-90" },
};

const ID_FISCAL_DEFAULT: IdFiscalInfo = {
  label: "ID Fiscal",
  placeholder: "CUIT / RUT / RUC / NIF",
};

export function idFiscalPorPais(pais: PaisCodigo | ""): IdFiscalInfo {
  return pais ? ID_FISCAL_POR_PAIS[pais] : ID_FISCAL_DEFAULT;
}

// ── Condición tributaria ──────────────────────────────────────────────────────

export type CondicionSelectInfo = {
  type: "select";
  label: string;
  options: readonly { value: number; label: string }[];
};
export type CondicionTextInfo = {
  type: "text";
  label: string;
  placeholder: string;
};
export type CondicionInfo = CondicionSelectInfo | CondicionTextInfo;

const CONDICION_IVA_AR: CondicionSelectInfo = {
  type: "select",
  label: "Condición frente al IVA",
  options: [
    { value: 1, label: "IVA Responsable Inscripto" },
    { value: 6, label: "Responsable Monotributo" },
    { value: 4, label: "IVA Sujeto Exento" },
    { value: 5, label: "Consumidor Final" },
  ],
};

const CONDICION_DEFAULT: CondicionTextInfo = {
  type: "text",
  label: "Condición tributaria",
  placeholder: "Ej: Régimen General, Monotributo, etc.",
};

export function condicionTributariaPorPais(
  pais: PaisCodigo | "",
): CondicionInfo {
  if (pais === "AR") return CONDICION_IVA_AR;
  return CONDICION_DEFAULT;
}

/**
 * Valida el formato del identificador fiscal según el país.
 * Retorna un mensaje de error o null si el valor es válido (o vacío).
 */
export function validarIdFiscal(
  pais: PaisCodigo | "",
  valor: string,
): string | null {
  if (!valor) return null;

  switch (pais) {
    case "AR": {
      // Solo dígitos y guiones: XX-XXXXXXXX-X o XXXXXXXXXXX
      if (!/^[\d-]+$/.test(valor))
        return "El CUIT/CUIL solo puede contener dígitos y guiones.";
      const d = valor.replace(/-/g, "");
      if (d.length !== 11)
        return `El CUIT/CUIL debe tener 11 dígitos (se ingresaron ${d.length}).`;
      break;
    }
    case "UY": {
      // Solo dígitos y espacios: XX XXXXXX XXXX
      if (!/^[\d\s]+$/.test(valor))
        return "El RUT solo puede contener dígitos y espacios.";
      const d = valor.replace(/\s/g, "");
      if (d.length !== 12)
        return `El RUT debe tener 12 dígitos (se ingresaron ${d.length}).`;
      break;
    }
    case "PY": {
      // Solo dígitos y guiones: XXXXXXXX-X
      if (!/^[\d-]+$/.test(valor))
        return "El RUC solo puede contener dígitos y guiones.";
      const d = valor.replace(/-/g, "");
      if (d.length < 5 || d.length > 10)
        return `El RUC debe tener entre 5 y 10 dígitos (se ingresaron ${d.length}).`;
      break;
    }
    case "CL": {
      // Dígitos, puntos y guión: 12.345.678-9 o 12345678-9
      const rut = valor.replace(/[.\s]/g, "").toUpperCase();
      if (!/^\d{7,8}-[\dK]$/.test(rut))
        return "El RUT debe tener el formato 12.345.678-9 (7 u 8 dígitos más dígito verificador).";
      break;
    }
    case "BR": {
      // Solo dígitos y separadores estándar: . / -
      if (!/^[\d./-]+$/.test(valor))
        return "El CNPJ/CPF solo puede contener dígitos y separadores (., /, -).";
      const d = valor.replace(/\D/g, "");
      if (d.length !== 11 && d.length !== 14)
        return `El CNPJ/CPF debe tener 11 dígitos (CPF) o 14 dígitos (CNPJ) (se ingresaron ${d.length}).`;
      break;
    }
    default:
      break;
  }
  return null;
}

/** Heurística para edición de viajes ya guardados (solo texto, sin campo país en BD). */
export function inferirPaisDesdeUbicacion(texto: string): PaisCodigo {
  const t = texto.trim().toLowerCase();

  // 1. Detección explícita por nombre del país (más rápido y directo)
  if (t.includes("uruguay")) return "UY";
  if (t.includes("paraguay")) return "PY";
  if (t.includes("chile")) return "CL";
  if (t.includes("brasil")) return "BR";

  // 2. Detección por ciudades internacionales frecuentes (sin el país explícito)
  const ciudadesUY = [
    "punta del este",
    "montevideo",
    "colonia",
    "paysandú",
    "paysandu",
    "salto",
    "maldonado",
    "fray bentos",
  ];
  if (ciudadesUY.some((c) => t.includes(c))) return "UY";

  const ciudadesPY = [
    "asunción",
    "asuncion",
    "ciudad del este",
    "encarnación",
    "encarnacion",
  ];
  if (ciudadesPY.some((c) => t.includes(c))) return "PY";

  const ciudadesCL = [
    "santiago",
    "valparaíso",
    "valparaiso",
    "concepción",
    "concepcion",
    "iquique",
    "antofagasta",
  ];
  if (ciudadesCL.some((c) => t.includes(c))) return "CL";

  const ciudadesBR = [
    "são paulo",
    "sao paulo",
    "río de janeiro",
    "rio de janeiro",
    "porto alegre",
    "uruguaiana",
    "foz do iguaçu",
    "foz do iguacu",
  ];
  if (ciudadesBR.some((c) => t.includes(c))) return "BR";

  // 3. Fallback por defecto si no coincide con nada
  return "AR";
}
