/**
 * Choferes/Vehículos/Productos no son flags del Tenant: son campos de Viajes
 * (tenant-field-config) que se prenden/apagan desde "Configuración por empresa" →
 * General. Además de los viajes, ocultan la pestaña de Base de datos y las
 * hojas/columnas de la planilla de importación.
 */
export const SWITCHES_ENTIDAD_VIAJES: readonly {
  campos: readonly string[];
  label: string;
  ayuda: string;
}[] = [
  {
    // Los dos campos de chofer de Viajes (flota propia / externo) van juntos.
    campos: ["choferId", "choferExternoId"],
    label: "Choferes",
    ayuda:
      "Apagado: no se cargan choferes en los viajes y se ocultan la pestaña Choferes de Base de datos (salvo con Combustible o Stock) y su hoja en la importación.",
  },
  {
    campos: ["vehiculosRows"],
    label: "Vehículos",
    ayuda:
      "Apagado: no se cargan vehículos en los viajes y se ocultan la pestaña Vehículos de Base de datos y su hoja en la importación.",
  },
  {
    campos: ["productoItems"],
    label: "Productos",
    ayuda:
      "Apagado: no se cargan productos en los viajes y se ocultan la pestaña Productos de Base de datos (salvo con Stock) y sus columnas en la importación.",
  },
];

/** Se excluyen de la lista "Campos visibles" de Viajes (se manejan en General). */
export const CAMPOS_SWITCH_ENTIDAD: ReadonlySet<string> = new Set(
  SWITCHES_ENTIDAD_VIAJES.flatMap((s) => s.campos),
);

export const FORMULARIO_SWITCH_ENTIDAD = "alta_viaje";
