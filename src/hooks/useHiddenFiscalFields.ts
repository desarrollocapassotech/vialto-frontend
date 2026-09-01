import { useMemo } from "react";
import { useFieldConfig } from "@/hooks/useFieldConfig";

export function useHiddenFiscalFields(missingFields: string[]) {
  const { isVisible: isClienteVisible } = useFieldConfig("clientes");
  const { isVisible: isTransportistaVisible } = useFieldConfig("transportistas");

  const hiddenFields = useMemo(() => {
    const hidden: string[] = [];
    
    // Validaciones de Cliente
    if (missingFields.includes("Cliente: CUIT") && !isClienteVisible("edicion_cliente", "idFiscal")) {
      hidden.push("Cliente (ID Fiscal)");
    }
    if (missingFields.includes("Cliente: domicilio") && !isClienteVisible("edicion_cliente", "direccion")) {
      hidden.push("Cliente (Domicilio)");
    }
    if (missingFields.includes("Cliente: condición de IVA (país Argentina + campo AFIP)") && !isClienteVisible("edicion_cliente", "condicionIvaTributaria")) {
      hidden.push("Cliente (Condición frente al IVA)");
    }

    // Validaciones de Transportista
    if (missingFields.includes("Transportista: CUIT") && !isTransportistaVisible("edicion_transportista", "idFiscal")) {
      hidden.push("Transportista (ID Fiscal)");
    }
    if (missingFields.includes("Transportista: domicilio") && !isTransportistaVisible("edicion_transportista", "domicilio")) {
      hidden.push("Transportista (Domicilio)");
    }
    if (missingFields.includes("Transportista: condición de IVA (país Argentina + campo AFIP)") && !isTransportistaVisible("edicion_transportista", "condicionIvaTributaria")) {
      hidden.push("Transportista (Condición frente al IVA)");
    }
    
    return hidden;
  }, [missingFields, isClienteVisible, isTransportistaVisible]);

  return hiddenFields;
}

/** Formatea los mensajes técnicos de ARCA a strings amigables para el usuario. */
export function formatMissingFiscalField(field: string): string {
  switch (field) {
    case "Transportista: CUIT":
      return "Transportista (ID Fiscal)";
    case "Transportista: domicilio":
      return "Transportista (Domicilio)";
    case "Transportista: condición de IVA (país Argentina + campo AFIP)":
      return "Transportista (Condición frente al IVA)";
      
    case "Cliente: CUIT":
      return "Cliente (ID Fiscal)";
    case "Cliente: domicilio":
      return "Cliente (Domicilio)";
    case "Cliente: condición de IVA (país Argentina + campo AFIP)":
      return "Cliente (Condición frente al IVA)";
      
    default:
      // Fallback genérico para cualquier otro campo (ej. "Cliente: nombre")
      return field
        .replace("Transportista: ", "Transportista (")
        .replace("Cliente: ", "Cliente (")
        + (field.includes(":") ? ")" : "");
  }
}
