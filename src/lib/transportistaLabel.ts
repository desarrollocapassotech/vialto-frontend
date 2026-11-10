import type { Tenant } from "@/types/api";
import { labelEnFrase } from "@/lib/productoLabel";

/**
 * Cómo llama cada empresa al transportista externo (`Tenant.transportistaLabel` /
 * `transportistaLabelPlural`, ej. "Fletero" / "Fleteros"), configurable desde
 * superadmin ("Configuración por empresa" → General). Mismo mecanismo que el label
 * de "Producto" (`lib/productoLabel.ts`).
 *
 * Hoy se aplica en: pestaña de Base de datos, alta/edición de viaje (incluye el
 * "Transporte / Porteador" del tipo de flota) y detalle del viaje. En componentes,
 * leerlo con `useTransportistaLabels(tenantId)` (`hooks/useTransportistaLabels.ts`).
 */
export interface TransportistaLabels {
  singular: string;
  plural: string;
  /** true = la empresa configuró un nombre propio (no es el default). */
  propio: boolean;
}

export const TRANSPORTISTA_LABELS_DEFAULT: TransportistaLabels = {
  singular: "Transportista",
  plural: "Transportistas",
  propio: false,
};

export function transportistaLabels(
  tenant: Pick<Tenant, "transportistaLabel" | "transportistaLabelPlural"> | null | undefined,
): TransportistaLabels {
  const singular = tenant?.transportistaLabel?.trim();
  if (!singular) return TRANSPORTISTA_LABELS_DEFAULT;
  return {
    singular,
    plural: tenant?.transportistaLabelPlural?.trim() || singular,
    propio: true,
  };
}

/**
 * Label del "Transporte / Porteador" del alta de viaje (tipo de flota y selector):
 * con nombre propio, ese nombre; sin configurar, el texto de siempre.
 */
export function labelTransporteViaje(labels: TransportistaLabels): string {
  return labels.propio ? labels.singular : "Transporte / Porteador";
}

/** El label en medio de una frase ("Elegí un fletero…"). */
export function transportistaEnFrase(label: string): string {
  return labelEnFrase(label);
}
