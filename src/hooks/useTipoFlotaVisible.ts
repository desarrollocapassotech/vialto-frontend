import { useFieldConfig } from "@/hooks/useFieldConfig";

/**
 * Qué tipos de flota usa la empresa, según las opciones de pertenencia del
 * chofer ("Flota propia" / "Transportista externo") que el superadmin
 * configura en Campos por empresa → Choferes.
 *
 * Una empresa que solo trabaja con flota propia (Transportista externo
 * deshabilitado) no ve la pestaña Transportistas ni la opción "Transporte
 * externo" al cargar un viaje.
 */
export function useTipoFlotaVisible() {
  const { isVisible } = useFieldConfig("choferes");
  return {
    flotaPropiaVisible: isVisible("alta_chofer", "flotaPropia"),
    transportistaExternoVisible: isVisible("alta_chofer", "transportistaExterno"),
  };
}
